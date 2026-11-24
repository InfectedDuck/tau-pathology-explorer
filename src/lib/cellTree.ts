import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Real cell morphologies (NeuroMorpho.Org reconstructions, see
 * public/models/ATTRIBUTION.md) shipped as compact branch trees and turned
 * into tube meshes here. Keeping the tree at runtime lets the shader retract
 * dendrites from their tips, tint tau burden outward from the soma and keep
 * hair-thin branches visible at any zoom.
 */
export interface CellTreeJson {
  id: string
  label: string
  unit: string
  source: { db: string; nmoId: number; name: string; archive: string; pmid: string; doi: string; cite: string; license: string }
  somaRadius: number
  count: number
  /** micrometres x10, relative to the soma centre */
  pos: number[]
  /** micrometres x100 */
  rad: number[]
  /** SWC type: 1 soma, 2 axon, 3 basal dendrite, 4 apical dendrite, 7 glial process */
  type: number[]
  parent: number[]
}

export interface CellTree {
  id: string
  count: number
  /** micrometres */
  pos: Float32Array
  rad: Float32Array
  type: Uint8Array
  parent: Int32Array
  children: number[][]
  /** path length from the soma (um) */
  dist: Float32Array
  /** longest path to a tip below this node (um) */
  height: Float32Array
  maxDist: number
  somaRadius: number
  min: THREE.Vector3
  max: THREE.Vector3
}

export const SWC_SOMA = 1
export const SWC_AXON = 2
export const SWC_BASAL = 3
export const SWC_APICAL = 4

export function parseCellTree(json: CellTreeJson): CellTree {
  const n = json.count
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) pos[i] = json.pos[i] / 10
  const rad = Float32Array.from(json.rad, (v) => v / 100)
  const type = Uint8Array.from(json.type)
  const parent = Int32Array.from(json.parent)
  const children: number[][] = Array.from({ length: n }, () => [])
  const seg = (a: number, b: number) =>
    Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2])
  // nodes are stored parent-before-child (depth-first), so one pass each way is enough
  const dist = new Float32Array(n)
  let maxDist = 0
  for (let i = 1; i < n; i++) {
    children[parent[i]].push(i)
    dist[i] = dist[parent[i]] + seg(i, parent[i])
    if (dist[i] > maxDist) maxDist = dist[i]
  }
  const height = new Float32Array(n)
  for (let i = n - 1; i > 0; i--) {
    const p = parent[i]
    height[p] = Math.max(height[p], height[i] + seg(i, p))
  }
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    min.min(v)
    max.max(v)
  }
  return { id: json.id, count: n, pos, rad, type, parent, children, dist, height, maxDist: maxDist || 1, somaRadius: json.somaRadius, min, max }
}

const cache = new Map<string, Promise<CellTree>>()

/** Cached loader — pass the promise to React's `use()` inside a Suspense boundary. */
export function loadCellTree(id: string): Promise<CellTree> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`/models/cells/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`cell model ${id}: HTTP ${r.status}`)
        return r.json() as Promise<CellTreeJson>
      })
      .then(parseCellTree)
    cache.set(id, p)
  }
  return p
}

export interface CellGeometryOptions {
  /** sides per tube ring */
  radial?: number
  radiusScale?: number
  /** floor for the displayed radius (um) */
  minRadius?: number
  /** extra trunk thickness next to the soma, as a fraction of the soma radius */
  flare?: number
  /** pyramidal apex stretch of the soma (must match buildSomaGeometry) */
  somaApex?: number
  /** rings per stored segment; 2 rounds off the kinks for close-ups */
  subdiv?: 1 | 2
  /** colour per SWC type; `default` covers the rest */
  colors: Partial<Record<number | 'default', THREE.ColorRepresentation>>
  /** only these SWC types (default: every neurite) */
  types?: number[]
}

export type RadiusOptions = Pick<CellGeometryOptions, 'radiusScale' | 'minRadius' | 'flare'>

/** Displayed radius of a node: stored radius, floored, plus a flare that blends trunks into the soma. */
export function displayRadius(tree: CellTree, i: number, o: RadiusOptions): number {
  const base = Math.max(o.minRadius ?? 0.25, tree.rad[i] * (o.radiusScale ?? 1))
  const flare = (o.flare ?? 0.4) * tree.somaRadius * Math.exp(-tree.dist[i] / (0.9 * tree.somaRadius))
  return base + flare
}

/** Soma surface radius along a unit direction: a lumpy sphere stretched towards the apical dendrite (+Y). */
export function somaRadiusAt(R: number, apex: number, x: number, y: number, z: number): number {
  const up = Math.max(0, y)
  const lumps = 1 + 0.045 * Math.sin(x * 5.1 + 1.3) * Math.cos(z * 4.3 + 0.4) + 0.035 * Math.sin(y * 6.2 + x * 2.0)
  return R * (1 + apex * Math.pow(up, 2.2) + apex * 0.18 * (1 - Math.abs(y))) * lumps
}

/**
 * Tube mesh for every neurite. Each tube follows the main path through
 * branch points (side branches bud off from inside it), so trunks stay
 * seamless. Attributes beyond position/normal/color:
 *  aRadius  displayed tube radius (um) — the shader collapses or widens along the normal
 *  aHeight  longest path to a tip below (um) — drives retraction from the tips
 *  aDist    normalised path distance from the soma — drives the tau-burden front
 *  aPart    SWC type of the branch (for compartment highlighting)
 */
export function buildNeuriteGeometry(tree: CellTree, o: CellGeometryOptions): THREE.BufferGeometry {
  const radial = o.radial ?? 6
  const subdiv = o.subdiv ?? 1
  const apex = o.somaApex ?? 0
  const { pos, parent, children, type, dist, height, maxDist } = tree
  const P: number[] = []
  const N: number[] = []
  const C: number[] = []
  const R: number[] = []
  const H: number[] = []
  const D: number[] = []
  const T: number[] = []
  const I: number[] = []
  const col = new THREE.Color()
  const tan = new THREE.Vector3()
  const nor = new THREE.Vector3()
  const bin = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const cos = Array.from({ length: radial }, (_, j) => Math.cos((j / radial) * Math.PI * 2))
  const sin = Array.from({ length: radial }, (_, j) => Math.sin((j / radial) * Math.PI * 2))
  const segLen = (a: number, b: number) => dist[a] - dist[b]

  // the child that carries on the parent's tube: the one leading to the farthest tip
  const principal = new Int32Array(tree.count).fill(-1)
  for (let i = 0; i < tree.count; i++) {
    let best = -1
    let bestH = -1
    for (const c of children[i]) {
      const h = height[c] + segLen(c, i)
      if (h > bestH) {
        bestH = h
        best = c
      }
    }
    principal[i] = best
  }

  for (let i = 1; i < tree.count; i++) {
    const par = parent[i]
    if (par !== 0 && principal[par] === i) continue // carried by its parent's tube
    if (o.types && !o.types.includes(type[i])) continue

    // ring centres along the path: x, y, z, radius, height, distance
    let rings: number[][] = [[], [], [], [], [], []]
    const push = (x: number, y: number, z: number, r: number, h: number, d: number) => {
      rings[0].push(x)
      rings[1].push(y)
      rings[2].push(z)
      rings[3].push(r)
      rings[4].push(h)
      rings[5].push(d)
    }
    let node = i
    if (par === 0) {
      // start on the soma surface rather than at its centre
      for (;;) {
        const len = Math.hypot(pos[node * 3], pos[node * 3 + 1], pos[node * 3 + 2])
        const outside = len > 1e-6 && len > 0.92 * somaRadiusAt(tree.somaRadius, apex, pos[node * 3] / len, pos[node * 3 + 1] / len, pos[node * 3 + 2] / len)
        if (outside || principal[node] < 0) break
        node = principal[node]
      }
      const len = Math.hypot(pos[node * 3], pos[node * 3 + 1], pos[node * 3 + 2]) || 1
      const ux = pos[node * 3] / len
      const uy = pos[node * 3 + 1] / len
      const uz = pos[node * 3 + 2] / len
      const start = Math.min(len * 0.98, 0.86 * somaRadiusAt(tree.somaRadius, apex, ux, uy, uz))
      push(ux * start, uy * start, uz * start, displayRadius(tree, node, o), height[node] + (len - start), Math.max(0, dist[node] - (len - start)) / maxDist)
    } else {
      // side branch: bud from the branch point with the child's calibre
      push(pos[par * 3], pos[par * 3 + 1], pos[par * 3 + 2], displayRadius(tree, i, o), height[i] + segLen(i, par), dist[par] / maxDist)
    }
    for (let n = node; n >= 0; n = principal[n]) {
      push(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2], displayRadius(tree, n, o), height[n], dist[n] / maxDist)
    }

    // real reconstructions step in calibre from point to point; ease those steps out
    for (let pass = 0; pass < 2; pass++) {
      const r = rings[3]
      let prev = r[0]
      for (let k = 1; k < r.length - 1; k++) {
        const cur = r[k]
        r[k] = 0.25 * prev + 0.5 * cur + 0.25 * r[k + 1]
        prev = cur
      }
    }

    if (subdiv === 2 && rings[0].length > 2) {
      // 4-point interpolating subdivision: passes through the original centres
      const K0 = rings[0].length
      const out: number[][] = [[], [], [], [], [], []]
      for (let k = 0; k < K0; k++) {
        for (let a = 0; a < 6; a++) out[a].push(rings[a][k])
        if (k === K0 - 1) break
        const k0 = Math.max(0, k - 1)
        const k3 = Math.min(K0 - 1, k + 2)
        for (let a = 0; a < 3; a++) out[a].push((-rings[a][k0] + 9 * rings[a][k] + 9 * rings[a][k + 1] - rings[a][k3]) / 16)
        for (let a = 3; a < 6; a++) out[a].push((rings[a][k] + rings[a][k + 1]) / 2)
      }
      rings = out
    }
    const [cx, cy, cz, cr, ch, cd] = rings

    col.set(o.colors[type[i]] ?? o.colors.default ?? '#ffffff')
    const base = P.length / 3
    const K = cx.length
    for (let k = 0; k < K; k++) {
      const a = Math.min(K - 1, k + 1)
      const b = Math.max(0, k - 1)
      tan.set(cx[a] - cx[b], cy[a] - cy[b], cz[a] - cz[b])
      if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0)
      tan.normalize()
      if (k === 0) {
        nor.set(1, 0, 0)
        if (Math.abs(tan.x) > 0.9) nor.set(0, 1, 0)
      }
      // parallel transport: keep the previous normal, re-orthogonalised
      nor.addScaledVector(tan, -nor.dot(tan))
      if (nor.lengthSq() < 1e-10) nor.set(tan.y, -tan.x, 0)
      nor.normalize()
      bin.crossVectors(tan, nor)
      for (let j = 0; j < radial; j++) {
        dir.copy(nor).multiplyScalar(cos[j]).addScaledVector(bin, sin[j])
        P.push(cx[k] + dir.x * cr[k], cy[k] + dir.y * cr[k], cz[k] + dir.z * cr[k])
        N.push(dir.x, dir.y, dir.z)
        C.push(col.r, col.g, col.b)
        R.push(cr[k])
        H.push(ch[k])
        D.push(cd[k])
        T.push(type[i])
      }
      if (k < K - 1) {
        const a0 = base + k * radial
        for (let j = 0; j < radial; j++) {
          const v0 = a0 + j
          const v1 = a0 + ((j + 1) % radial)
          I.push(v0, v1, v0 + radial, v1, v1 + radial, v0 + radial)
        }
      }
    }
    // rounded cap so cut ends never show
    const apexIdx = P.length / 3
    const e = K - 1
    P.push(cx[e] + tan.x * cr[e], cy[e] + tan.y * cr[e], cz[e] + tan.z * cr[e])
    N.push(tan.x, tan.y, tan.z)
    C.push(col.r, col.g, col.b)
    R.push(0)
    H.push(0)
    D.push(cd[e])
    T.push(type[i])
    const ring = base + e * radial
    for (let j = 0; j < radial; j++) I.push(ring + j, ring + ((j + 1) % radial), apexIdx)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  g.setAttribute('aRadius', new THREE.Float32BufferAttribute(R, 1))
  g.setAttribute('aHeight', new THREE.Float32BufferAttribute(H, 1))
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(D, 1))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(T, 1))
  g.setIndex(I)
  // the shader moves vertices, so use the tree's own bounds
  g.boundingBox = new THREE.Box3(tree.min.clone().subScalar(20), tree.max.clone().addScalar(20))
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere())
  return g
}

/**
 * Cell body. Pyramidal neurons get an apex stretched towards the apical
 * dendrite (+Y); glia stay round. Carries the same custom attributes as the
 * neurites so one material can draw both.
 */
export function buildSomaGeometry(tree: CellTree, opts: { apex?: number; detail?: number; scale?: number; color: THREE.ColorRepresentation }): THREE.BufferGeometry {
  const R = tree.somaRadius * (opts.scale ?? 1)
  const apex = opts.apex ?? 0
  const src = new THREE.IcosahedronGeometry(1, opts.detail ?? 3)
  src.deleteAttribute('uv')
  src.deleteAttribute('normal')
  const g = mergeVertices(src, 1e-4)
  src.dispose()
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    const s = somaRadiusAt(R, apex, v.x, v.y, v.z)
    p.setXYZ(i, v.x * s, v.y * s, v.z * s)
  }
  g.computeVertexNormals()
  const n = p.count
  const c = new THREE.Color(opts.color)
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('aRadius', new THREE.BufferAttribute(new Float32Array(n).fill(1e6), 1))
  g.setAttribute('aHeight', new THREE.BufferAttribute(new Float32Array(n).fill(1e6), 1))
  g.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(n), 1))
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(SWC_SOMA), 1))
  return g
}

/** Deterministic PRNG (mulberry32) so layouts are identical on every device. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SurfaceSamples {
  count: number
  /** point on the branch surface */
  positions: Float32Array
  /** unit vector pointing away from the branch axis */
  normals: Float32Array
  /** longest path to a tip below the sampled segment (um) */
  height: Float32Array
}

/** Random points on the surface of the chosen compartments, weighted by branch length. */
export function sampleSurface(tree: CellTree, count: number, types: number[], seed: number, o: RadiusOptions = {}, minDist = 0): SurfaceSamples {
  const rand = rng(seed)
  const segs: number[] = []
  const cum: number[] = []
  let total = 0
  for (let i = 1; i < tree.count; i++) {
    if (!types.includes(tree.type[i]) || tree.dist[i] < minDist) continue
    total += tree.dist[i] - tree.dist[tree.parent[i]]
    segs.push(i)
    cum.push(total)
  }
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const height = new Float32Array(count)
  if (!segs.length) return { count: 0, positions, normals, height }
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const t = new THREE.Vector3()
  const n = new THREE.Vector3()
  const m = new THREE.Vector3()
  for (let k = 0; k < count; k++) {
    const target = rand() * total
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < target) lo = mid + 1
      else hi = mid
    }
    const i = segs[lo]
    const par = tree.parent[i]
    a.set(tree.pos[par * 3], tree.pos[par * 3 + 1], tree.pos[par * 3 + 2])
    b.set(tree.pos[i * 3], tree.pos[i * 3 + 1], tree.pos[i * 3 + 2])
    t.subVectors(b, a)
    const f = rand()
    a.addScaledVector(t, f)
    if (t.lengthSq() < 1e-10) t.set(0, 1, 0)
    t.normalize()
    n.set(rand() - 0.5, rand() - 0.5, rand() - 0.5)
    n.addScaledVector(t, -n.dot(t))
    if (n.lengthSq() < 1e-8) n.set(t.y, -t.x, 0)
    n.normalize()
    m.copy(a).addScaledVector(n, displayRadius(tree, i, o))
    positions.set([m.x, m.y, m.z], k * 3)
    normals.set([n.x, n.y, n.z], k * 3)
    height[k] = tree.height[i]
  }
  return { count, positions, normals, height }
}

export interface TreeHit {
  /** distance along the ray, in the tree's local units */
  t: number
  node: number
  point: THREE.Vector3
}

/**
 * Pick the branch nearest to a ray. Triangle picking would miss branches that
 * are only a pixel or two wide, so this tests every segment with a tolerance
 * that grows with distance (`slack` = local units per unit of ray length).
 */
export function raycastTree(
  tree: CellTree,
  ray: THREE.Ray,
  slack: number,
  o: RadiusOptions = {},
  /** skip branch ends that have retracted (um from the tip) */
  minHeight = 0,
): TreeHit | null {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const onRay = new THREE.Vector3()
  const onSeg = new THREE.Vector3()
  let best: TreeHit | null = null
  for (let i = 1; i < tree.count; i++) {
    if (tree.height[i] < minHeight) continue
    const p = tree.parent[i]
    a.set(tree.pos[p * 3], tree.pos[p * 3 + 1], tree.pos[p * 3 + 2])
    b.set(tree.pos[i * 3], tree.pos[i * 3 + 1], tree.pos[i * 3 + 2])
    const d2 = ray.distanceSqToSegment(a, b, onRay, onSeg)
    const t = onRay.distanceTo(ray.origin)
    const tol = Math.max(displayRadius(tree, i, o), slack * t)
    if (d2 <= tol * tol && (!best || t < best.t)) best = { t, node: i, point: onSeg.clone() }
  }
  return best
}
