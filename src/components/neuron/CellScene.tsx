import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PART_COLOR } from '../../data/parts'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useMergedContent } from '../../hooks/useMergedContent'
import { lerp4 } from '../../hooks/useSmoothStage'
import {
  SWC_APICAL, SWC_AXON, SWC_BASAL, SWC_SOMA,
  buildNeuriteGeometry, buildSomaGeometry, loadCellTree, raycastTree, rng, sampleSurface, type CellTree,
} from '../../lib/cellTree'
import { createNeuriteMaterial, pixelWorld, withRim } from '../../lib/neuriteMaterial'
import { smoothStage, useStageBucket } from '../../lib/smoothStage'
import { useAppStore } from '../../store/useAppStore'
import { Hotspot } from '../viewer/Hotspot'
import { CELL_SCALE as S } from './cellView'


const SOMA_APEX = 0.5
const GEO = { minRadius: 0.3, flare: 0.42, somaApex: SOMA_APEX }
/** axons die back more slowly than dendrites retract (matches the shader default) */
const AXON_RETRACT = 0.42
/** um of dendrite lost from every tip at each stage */
const RETRACT: [number, number, number, number] = [0, 14, 78, 205]

/** Flame-shaped neurofibrillary tangle: twisted filament bundle filling the soma and tapering into the apical trunk. */
function buildTangle(R: number): THREE.BufferGeometry {
  const rand = rng(17)
  const parts: THREE.BufferGeometry[] = []
  for (let f = 0; f < 12; f++) {
    const phase = rand() * Math.PI * 2
    const turns = 1.1 + rand() * 1.4
    const spread = 0.3 + 0.7 * rand()
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 26; k++) {
      const u = k / 26
      const y = -0.7 * R + u * (0.7 * R + (1 + SOMA_APEX) * R * 1.5)
      const env = R * 0.6 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.7) * (1 - 0.8 * u) * spread + 0.2
      const a = phase + u * turns * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * env, y, Math.sin(a) * env))
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 54, 0.5 + rand() * 0.3, 5, false))
  }
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

function buildSpine(): THREE.BufferGeometry {
  // both keep their own smooth normals
  const head = new THREE.IcosahedronGeometry(0.44, 2)
  head.translate(0, 1.45, 0)
  const stalk = new THREE.CylinderGeometry(0.15, 0.2, 1.3, 6, 1, true).toNonIndexed()
  stalk.translate(0, 0.65, 0)
  for (const g of [head, stalk]) g.deleteAttribute('uv')
  const merged = mergeGeometries([head, stalk])
  head.dispose()
  stalk.dispose()
  return merged
}

function nodeAt(tree: CellTree, type: number, score: (i: number) => number): { p: [number, number, number]; height: number } {
  let best = -1
  let bestScore = -Infinity
  for (let i = 1; i < tree.count; i++) {
    if (tree.type[i] !== type) continue
    const s = score(i)
    if (s > bestScore) {
      bestScore = s
      best = i
    }
  }
  return best < 0 ? { p: [0, 0, 0], height: 1e6 } : { p: [tree.pos[best * 3], tree.pos[best * 3 + 1], tree.pos[best * 3 + 2]], height: tree.height[best] }
}

/**
 * Box 1, level 1 — a real human hippocampal CA1 pyramidal neuron
 * (NeuroMorpho.Org 147158). Disease is driven through the branch tree:
 * tau burden spreads out from the soma, spines drop away, dendrites retract
 * from their tips and a flame-shaped tangle fills the cell body.
 */
export function CellScene({ fixedStage }: { fixedStage?: number }) {
  const tree = use(loadCellTree('ca1-hero'))
  const quality = useAppStore((s) => s.quality)
  const highlight = useAppStore((s) => s.highlight)
  const selection = useAppStore((s) => s.selection)
  const setSelection = useAppStore((s) => s.setSelection)
  const isMobile = useIsMobile()
  const { mergedCells } = useMergedContent()
  const bucket = useStageBucket(0.25, fixedStage)
  const high = quality === 'high'
  const radial = high ? (isMobile ? 6 : 10) : 5
  const subdiv = high && !isMobile ? 2 : 1
  const spineCount = high ? (isMobile ? 1300 : 2800) : 700

  const neurites = useMemo(
    () =>
      buildNeuriteGeometry(tree, {
        ...GEO,
        radial,
        subdiv,
        colors: { [SWC_AXON]: PART_COLOR.axon, [SWC_BASAL]: '#38c6d9', [SWC_APICAL]: PART_COLOR.dendrite, default: PART_COLOR.dendrite },
      }),
    [tree, radial, subdiv],
  )
  const somaGeo = useMemo(() => buildSomaGeometry(tree, { apex: SOMA_APEX, detail: 4, color: '#ffffff' }), [tree])
  const tangleGeo = useMemo(() => buildTangle(tree.somaRadius), [tree])
  const spineGeo = useMemo(() => buildSpine(), [])
  const nucleusGeo = useMemo(() => new THREE.IcosahedronGeometry(tree.somaRadius * 0.5, 3), [tree])

  const mat = useMemo(() => createNeuriteMaterial({ params: { roughness: 0.42, metalness: 0.04 }, rim: '#9be7ff' }), [])
  const somaMat = useMemo(
    () =>
      withRim(
        new THREE.MeshPhysicalMaterial({
          color: PART_COLOR.soma, transparent: true, opacity: 0.46, depthWrite: false,
          roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.25, side: THREE.FrontSide,
        }),
        '#bff5ff', 0.9, 2.0,
      ),
    [],
  )
  const nucleusMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6f7fe0', roughness: 0.55, emissive: '#27318a', emissiveIntensity: 0.5 }), [])
  const tangleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a2f0b', emissive: '#ff6a00', emissiveIntensity: 0.9, roughness: 0.45, transparent: true }),
    [],
  )
  const spineUniforms = useMemo(() => ({ uLoss: { value: 0 }, uRetract: { value: 0 }, uShow: { value: 0 } }), [])
  const spineMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: PART_COLOR.spine, roughness: 0.5, emissive: '#5c7a2a', emissiveIntensity: 0.35 })
    m.customProgramCacheKey = () => 'spine'
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, spineUniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aSeed;\nattribute float aSpH;\nuniform float uLoss;\nuniform float uRetract;\nuniform float uShow;`)
        .replace(
          '#include <begin_vertex>',
          `float sAlive = step( uLoss, aSeed ) * ( uRetract <= 0.0 ? 1.0 : smoothstep( uRetract, uRetract + 14.0, aSpH ) ) * uShow;\nvec3 transformed = position * sAlive;`,
        )
    }
    return m
  }, [spineUniforms])

  useEffect(
    () => () => {
      for (const d of [neurites, somaGeo, tangleGeo, spineGeo, nucleusGeo, mat.material, somaMat, nucleusMat, tangleMat, spineMat]) d.dispose()
    },
    [neurites, somaGeo, tangleGeo, spineGeo, nucleusGeo, mat, somaMat, nucleusMat, tangleMat, spineMat],
  )

  // centre the whole arbor on the origin
  const offset = useMemo<[number, number, number]>(
    () => [(-(tree.min.x + tree.max.x) / 2) * S, (-(tree.min.y + tree.max.y) / 2) * S, (-(tree.min.z + tree.max.z) / 2) * S],
    [tree],
  )
  const anchors = useMemo(() => {
    return {
      dendrite: nodeAt(tree, SWC_APICAL, (i) => (tree.dist[i] > tree.maxDist * 0.22 && tree.dist[i] < tree.maxDist * 0.4 ? tree.rad[i] : -1)),
      spine: nodeAt(tree, SWC_BASAL, (i) => (tree.dist[i] > 45 && tree.dist[i] < 85 ? tree.height[i] : -1)),
      axon: nodeAt(tree, SWC_AXON, (i) => (tree.height[i] > 110 ? tree.dist[i] : -1)),
    }
  }, [tree])

  const neuritesRef = useRef<THREE.Mesh>(null)
  const spinesRef = useRef<THREE.InstancedMesh>(null)
  const tangleRef = useRef<THREE.Mesh>(null)
  const nucleusRef = useRef<THREE.Mesh>(null)
  const rootRef = useRef<THREE.Group>(null)
  const pick = useRef({ pixelWorld: 0.001, retract: 0 })
  const tint = useMemo(() => ({ tau: new THREE.Color('#f97316'), dead: new THREE.Color('#5b4636') }), [])

  // Fat-line picking: branches are often a pixel or two wide.
  useLayoutEffect(() => {
    const mesh = neuritesRef.current
    if (!mesh) return
    const inv = new THREE.Matrix4()
    const local = new THREE.Ray()
    mesh.raycast = (raycaster, intersects) => {
      inv.copy(mesh.matrixWorld).invert()
      local.copy(raycaster.ray).applyMatrix4(inv)
      // only what is still drawn can be picked
      const hit = raycastTree(tree, local, pick.current.pixelWorld * (isMobile ? 14 : 6), GEO, pick.current.retract * AXON_RETRACT)
      if (!hit || tree.height[hit.node] < pick.current.retract * (tree.type[hit.node] === SWC_AXON ? AXON_RETRACT : 1)) return
      const point = hit.point.applyMatrix4(mesh.matrixWorld)
      intersects.push({ distance: point.distanceTo(raycaster.ray.origin), point, object: mesh, node: hit.node } as unknown as THREE.Intersection)
    }
  }, [tree, isMobile])

  // Scatter spines over the dendrites.
  useLayoutEffect(() => {
    const mesh = spinesRef.current
    if (!mesh || !spineCount) return
    const s = sampleSurface(tree, spineCount, [SWC_BASAL, SWC_APICAL], 91, GEO, 22)
    const rand = rng(5)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const n = new THREE.Vector3()
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const seeds = new Float32Array(spineCount)
    for (let i = 0; i < spineCount; i++) {
      n.fromArray(s.normals, i * 3)
      p.fromArray(s.positions, i * 3).addScaledVector(n, -0.1)
      q.setFromUnitVectors(up, n)
      const k = 0.75 + rand() * 0.6
      sc.set(k, k * (0.8 + rand() * 0.5), k)
      mesh.setMatrixAt(i, m.compose(p, q, sc))
      seeds[i] = rand()
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    mesh.geometry.setAttribute('aSpH', new THREE.InstancedBufferAttribute(s.height, 1))
  }, [tree, spineCount, spineGeo])

  const focusTypes = (id: string | undefined): [number, number] => {
    if (id === 'dendrite' || id === 'spine') return [SWC_BASAL, SWC_APICAL]
    if (id === 'axon') return [SWC_AXON, SWC_AXON]
    if (id === 'soma' || id === 'tangle') return [SWC_SOMA, SWC_SOMA]
    return [-1, -1]
  }
  const selId = selection?.kind === 'cellPart' ? selection.id : undefined

  useFrame(({ camera, size, clock, controls }, delta) => {
    const st = fixedStage ?? smoothStage.get()
    const u = mat.uniforms
    const retract = lerp4(RETRACT, st)
    const px = pixelWorld(camera, size.height)
    u.uRetract.value = retract
    u.uTauFront.value = lerp4([0, 0.1, 0.52, 1.18], st)
    u.uTauGlow.value = 0.4 + Math.sin(clock.elapsedTime * 1.7) * 0.12 + (highlight === 'early' || highlight === 'tangle' ? 0.5 : 0)
    u.uRimStrength.value = 0.5 + (highlight === 'healthy' ? 0.6 : 0)
    u.uPixelWorld.value = px
    u.uObjScale.value = S
    u.uMinPx.value = high ? 1.05 : 1.3
    pick.current.pixelWorld = px
    pick.current.retract = retract
    const [fa, fb] = focusTypes(selId)
    if (fa >= 0) {
      u.uFocusA.value = fa
      u.uFocusB.value = fb
    }
    const want = fa >= 0 ? 1 : 0
    u.uFocusAmt.value += (want - u.uFocusAmt.value) * Math.min(1, delta * 6)
    if (want === 0 && u.uFocusAmt.value < 0.01) u.uFocusA.value = -1

    // soma: clouds over and darkens as the tangle fills it
    const burden = THREE.MathUtils.clamp(st / 1.3, 0, 1)
    const dark = THREE.MathUtils.clamp((st - 2) / 1, 0, 1)
    somaMat.color.set(PART_COLOR.soma).lerp(tint.tau, burden * 0.8).lerp(tint.dead, dark * 0.6)
    somaMat.opacity = 0.46 - dark * 0.08

    // tangle grows from Braak III on and shoves the nucleus aside
    const tangle = THREE.MathUtils.clamp((st - 1.1) / 1.25, 0, 1)
    if (tangleRef.current) {
      tangleRef.current.visible = tangle > 0.02
      tangleRef.current.scale.setScalar(0.3 + tangle * 0.7)
      tangleMat.opacity = Math.min(1, tangle * 1.6)
      tangleMat.emissiveIntensity = 0.75 + Math.sin(clock.elapsedTime * 2.2) * 0.15 + (highlight === 'tangle' || selId === 'tangle' ? 0.9 : 0)
    }
    if (nucleusRef.current) {
      nucleusRef.current.position.set(tangle * tree.somaRadius * 0.34, -tree.somaRadius * (0.12 + tangle * 0.1), tangle * tree.somaRadius * 0.12)
      nucleusRef.current.scale.setScalar(1 - tangle * 0.2)
    }

    // spines only resolve once you zoom in; they thin out with disease
    if (spinesRef.current) {
      const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target
      const d = target ? camera.position.distanceTo(target) : 10
      const spinePx = (1.8 * S) / Math.max(1e-6, d * px)
      const show = THREE.MathUtils.smoothstep(spinePx, 1.4, 2.6)
      spineUniforms.uShow.value = show
      spineUniforms.uLoss.value = lerp4([0, 0.16, 0.56, 0.93], st)
      spineUniforms.uRetract.value = retract
      spinesRef.current.visible = show > 0.01
    }
    if (rootRef.current) rootRef.current.scale.setScalar(S * lerp4([1, 1, 0.97, 0.93], st))
  })

  const onNeurite = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const node = (e as unknown as { node?: number }).node ?? 0
    const type = tree.type[node]
    setSelection({ kind: 'cellPart', id: type === SWC_AXON ? 'axon' : 'dendrite' })
  }
  const pointer = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto'
    },
  }
  const name = (id: string) => mergedCells[id]?.short ?? id
  // labels disappear with the branch they point at
  const retractNow = lerp4(RETRACT, bucket)

  return (
    <group ref={rootRef} scale={S} position={offset}>
      <mesh ref={neuritesRef} geometry={neurites} material={mat.material} onClick={onNeurite} {...pointer} />
      <mesh ref={nucleusRef} geometry={nucleusGeo} material={nucleusMat} userData={{ noPick: true }} />
      <mesh
        ref={tangleRef}
        geometry={tangleGeo}
        material={tangleMat}
        visible={false}
        onClick={(e) => {
          e.stopPropagation()
          setSelection({ kind: 'cellPart', id: 'tangle' })
        }}
        {...pointer}
      />
      <mesh
        geometry={somaGeo}
        material={somaMat}
        renderOrder={2}
        onClick={(e) => {
          e.stopPropagation()
          setSelection({ kind: 'cellPart', id: bucket >= 1.75 ? 'tangle' : 'soma' })
        }}
        {...pointer}
      />
      {spineCount > 0 && (
        <instancedMesh ref={spinesRef} args={[spineGeo, spineMat, spineCount]} frustumCulled={false} visible={false} raycast={() => null} />
      )}

      <Hotspot id="soma" position={[0, 0, 0]} radius={34} label={name('soma')} color={PART_COLOR.soma} angle={180} length={44} />
      <Hotspot id="dendrite" position={anchors.dendrite.p} radius={150} label={name('dendrite')} color={PART_COLOR.dendrite} angle={-25} length={46} silent={anchors.dendrite.height < retractNow} />
      <Hotspot id="axon" position={anchors.axon.p} radius={70} label={name('axon')} color={PART_COLOR.axon} angle={150} length={40} silent={anchors.axon.height < retractNow * AXON_RETRACT} />
      <Hotspot id="spine" position={anchors.spine.p} radius={13} label={name('spine')} color={PART_COLOR.spine} angle={25} length={40} showWithin={6.5} silent={anchors.spine.height < retractNow} />
      <Hotspot id="tangle" position={[0, tree.somaRadius * 0.5, 0]} radius={30} label={name('tangle')} color={PART_COLOR.tangle} angle={0} length={46} silent={bucket < 1.5} />
    </group>
  )
}
