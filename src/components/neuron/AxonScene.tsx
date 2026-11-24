import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PART_COLOR } from '../../data/parts'
import { pseudo } from '../../data/tissueStats'
import { useMergedContent } from '../../hooks/useMergedContent'
import { lerp4 } from '../../hooks/useSmoothStage'
import { withRim } from '../../lib/neuriteMaterial'
import { smoothStage } from '../../lib/smoothStage'
import { useAppStore } from '../../store/useAppStore'
import { Hotspot } from '../viewer/Hotspot'
import { AXON_WIDE_ASPECT } from './axonView'


const MT_TOP = 8
const SEGS = 12
const SEG_LEN = 0.95
const MT_R = 0.14
/** microtubule positions in the shaft cross-section: one central, six around */
const MT_XZ: [number, number][] = [
  [0, 0.1],
  ...Array.from({ length: 6 }, (_, k): [number, number] => {
    const a = (k * 60 + 22) * (Math.PI / 180)
    return [Math.cos(a) * 0.95, Math.sin(a) * 0.95]
  }),
]
const TAU_PER_MT = 9
const TAU_COUNT = MT_XZ.length * TAU_PER_MT
const SV_COUNT = 44
const NT_COUNT = 26
const CLUMPS: [number, number, number][] = [[0.75, 3.6, 1.15], [-0.9, 0.4, 1.0], [0.55, -2.0, 1.2]]
const CARGO = [
  { mt: 1, phase: 0.0, speed: 1.0, r: 0.3 },
  { mt: 2, phase: 0.31, speed: 0.86, r: 0.26 },
  { mt: 0, phase: 0.55, speed: 1.1, r: 0.32 },
  { mt: 1, phase: 0.72, speed: 0.92, r: 0.24 },
  { mt: 6, phase: 0.18, speed: 0.8, r: 0.28 },
  { mt: 2, phase: 0.9, speed: 1.05, r: 0.3 },
]

/** axon shaft widening into the presynaptic bouton, as a lathe profile (radius, y) */
function membraneProfile(): THREE.Vector2[] {
  const ctrl: [number, number][] = [
    [2.3, 8.0], [2.3, 6.0], [2.34, 2.5], [2.3, -1.0], [2.4, -2.5], [3.0, -3.4], [3.75, -4.4],
    [4.05, -5.6], [3.85, -6.8], [3.2, -7.55], [1.9, -7.98], [0.02, -8.02],
  ]
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)))
  return curve.getPoints(72).map((p) => new THREE.Vector2(Math.max(0.02, p.x + (p.y > -2 ? 0.05 * Math.sin(p.y * 1.4) : 0)), p.y))
}

function spineProfile(): THREE.Vector2[] {
  const ctrl: [number, number][] = [
    [0.02, -8.34], [1.7, -8.36], [2.45, -8.62], [2.62, -9.3], [2.2, -10.1], [1.2, -10.7], [0.78, -11.4], [0.86, -12.2], [1.5, -12.9],
  ]
  return new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(48)
}

function helixRibbon(len: number, halfPitch: number, radius: number, tube: number): THREE.BufferGeometry {
  const strands: THREE.BufferGeometry[] = []
  for (const off of [0, Math.PI]) {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 40; k++) {
      const y = (k / 40 - 0.5) * len
      const a = (y / halfPitch) * Math.PI + off
      pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius))
    }
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, tube, 6, false))
  }
  const g = new THREE.BufferGeometry()
  // two strands -> one geometry
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let base = 0
  for (const s of strands) {
    pos.push(...(s.attributes.position.array as Float32Array))
    nor.push(...(s.attributes.normal.array as Float32Array))
    idx.push(...Array.from(s.index!.array as ArrayLike<number>, (v) => v + base))
    base += s.attributes.position.count
    s.dispose()
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/**
 * Box 1, level 2 — cutaway of an axon ending in a synapse. Microtubule
 * rails, tau holding them together, kinesin hauling vesicles, mitochondria,
 * and the terminal releasing transmitter onto a dendritic spine. Disease:
 * tau lets go and clumps, rails fragment, cargo jams, the synapse empties and
 * a tau seed crosses to the next cell.
 */
export function AxonScene({ fixedStage }: { fixedStage?: number }) {
  const setSelection = useAppStore((s) => s.setSelection)
  const highlight = useAppStore((s) => s.highlight)
  const selId = useAppStore((s) => (s.selection?.kind === 'cellPart' ? s.selection.id : null))
  const { mergedCells } = useMergedContent()
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const wide = aspect > AXON_WIDE_ASPECT

  const geo = useMemo(() => {
    const profile = membraneProfile()
    const gap = (150 * Math.PI) / 180
    const centre = 0.3
    const phiStart = centre + gap / 2
    const phiLength = Math.PI * 2 - gap
    const membrane = new THREE.LatheGeometry(profile, 72, phiStart, phiLength)
    const edge = (phi: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(profile.map((p) => new THREE.Vector3(p.x * Math.sin(phi), p.y, p.x * Math.cos(phi)))),
        140, 0.035, 5, false,
      )
    const spine = new THREE.LatheGeometry(spineProfile(), 40)
    const seed = new THREE.IcosahedronGeometry(0.24, 2)
    const sp = seed.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < sp.count; i++) {
      v.fromBufferAttribute(sp, i)
      v.multiplyScalar(1 + 0.22 * Math.sin(v.x * 21 + 1) * Math.cos(v.y * 17 + 2))
      sp.setXYZ(i, v.x, v.y, v.z)
    }
    seed.computeVertexNormals()
    return {
      membrane,
      edgeA: edge(phiStart),
      edgeB: edge(phiStart + phiLength),
      spine,
      seed,
      mtSeg: new THREE.CylinderGeometry(MT_R, MT_R, SEG_LEN - 0.05, 13, 1),
      tau: new THREE.CapsuleGeometry(0.07, 0.56, 3, 8),
      vesicle: new THREE.IcosahedronGeometry(1, 3),
      foot: new THREE.SphereGeometry(0.055, 8, 6),
      stalk: new THREE.CylinderGeometry(0.022, 0.022, 1, 5),
      mito: new THREE.CapsuleGeometry(0.5, 1.9, 8, 20),
      sv: new THREE.IcosahedronGeometry(0.2, 2),
      nt: new THREE.SphereGeometry(0.045, 6, 5),
      receptor: new THREE.CylinderGeometry(0.09, 0.07, 0.24, 6),
      disc: new THREE.CylinderGeometry(1.45, 1.45, 0.05, 40),
      phf: helixRibbon(1.9, 0.8, 0.085, 0.045),
      dendrite: new THREE.CapsuleGeometry(1.2, 13, 8, 24),
    }
  }, [])

  const mats = useMemo(() => {
    const flat = (m: THREE.MeshStandardMaterial) => {
      m.flatShading = true
      return m
    }
    return {
      membrane: withRim(
        new THREE.MeshPhysicalMaterial({
          color: '#3f77a3', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
          roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.3,
        }),
        '#8fe3ff', 0.7, 2.2,
      ),
      edge: new THREE.MeshBasicMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.75 }),
      mt: flat(new THREE.MeshStandardMaterial({ color: PART_COLOR.microtubule, emissive: '#22d3ee', emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.1 })),
      tau: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#0b3b36', emissiveIntensity: 0.6, roughness: 0.35 }),
      vesicle: withRim(new THREE.MeshPhysicalMaterial({ color: '#cfeeff', roughness: 0.2, clearcoat: 1, emissive: '#0ea5e9', emissiveIntensity: 0.35 }), '#ffffff', 0.5, 2),
      endosome: withRim(new THREE.MeshPhysicalMaterial({ color: '#c4b5fd', roughness: 0.25, clearcoat: 1, emissive: '#7c3aed', emissiveIntensity: 0.3 }), '#ffffff', 0.4, 2),
      motor: new THREE.MeshStandardMaterial({ color: PART_COLOR.motor, emissive: '#f59e0b', emissiveIntensity: 0.6, roughness: 0.4 }),
      mito: withRim(new THREE.MeshPhysicalMaterial({ color: PART_COLOR.mitochondrion, roughness: 0.42, clearcoat: 0.6, emissive: '#db2777', emissiveIntensity: 0.4 }), '#ffd6ea', 0.6, 2.2),
      sv: new THREE.MeshStandardMaterial({ color: '#d7f1ff', emissive: '#38bdf8', emissiveIntensity: 0.45, roughness: 0.3 }),
      nt: new THREE.MeshBasicMaterial({ color: '#fff3b0' }),
      zone: new THREE.MeshStandardMaterial({ color: '#0b4a5c', emissive: '#22d3ee', emissiveIntensity: 0.4, roughness: 0.5 }),
      spine: withRim(new THREE.MeshPhysicalMaterial({ color: '#1f9d8f', roughness: 0.45, clearcoat: 0.5 }), '#7ff5e6', 0.6, 2.2),
      psd: new THREE.MeshStandardMaterial({ color: '#d9b84a', emissive: '#f59e0b', emissiveIntensity: 0.3, roughness: 0.5 }),
      receptor: new THREE.MeshStandardMaterial({ color: '#fef3c7', emissive: '#fbbf24', emissiveIntensity: 0.5, roughness: 0.4 }),
      seed: new THREE.MeshStandardMaterial({ color: '#e69f00', emissive: '#ff6a00', emissiveIntensity: 1.5, roughness: 0.35 }),
      phf: new THREE.MeshStandardMaterial({ color: '#b3410e', emissive: '#ff6a00', emissiveIntensity: 1.0, roughness: 0.4, transparent: true }),
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )

  // static per-instance layout
  const tauLayout = useMemo(
    () =>
      Array.from({ length: TAU_COUNT }, (_, i) => {
        const m = Math.floor(i / TAU_PER_MT)
        const k = i % TAU_PER_MT
        const th = Math.PI / 2 + (pseudo(i, 4) - 0.5) * 2.6
        const fa = pseudo(i, 6) * Math.PI * 2
        const fr = 0.5 + pseudo(i, 7) * 1.25
        return {
          bound: new THREE.Vector3(MT_XZ[m][0] + Math.cos(th) * 0.23, MT_TOP - 0.7 - k * 1.2 - pseudo(i, 5) * 0.5, MT_XZ[m][1] + Math.sin(th) * 0.23),
          free: new THREE.Vector3(Math.cos(fa) * fr, 0, Math.sin(fa) * fr),
          order: pseudo(i, 8),
          clump: i % CLUMPS.length,
          jitter: new THREE.Vector3(pseudo(i, 9) - 0.5, pseudo(i, 10) - 0.5, pseudo(i, 11) - 0.5),
        }
      }),
    [],
  )
  const svLayout = useMemo(
    () =>
      Array.from({ length: SV_COUNT }, (_, i) => {
        const a = pseudo(i, 21) * Math.PI * 2
        const y = -7.55 + Math.pow(pseudo(i, 22), 1.4) * 2.6
        const r = Math.sqrt(pseudo(i, 23)) * (1.5 + (y + 7.55) * 0.45)
        return { p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.85 + 0.2), order: pseudo(i, 24) }
      }),
    [],
  )
  const receptors = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = pseudo(i, 31) * Math.PI * 2
        const r = Math.sqrt(pseudo(i, 32)) * 1.45
        return [Math.cos(a) * r, -8.26, Math.sin(a) * r] as [number, number, number]
      }),
    [],
  )

  const mtRef = useRef<THREE.InstancedMesh>(null)
  const tauRef = useRef<THREE.InstancedMesh>(null)
  const svRef = useRef<THREE.InstancedMesh>(null)
  const ntRef = useRef<THREE.InstancedMesh>(null)
  const cargoRef = useRef<THREE.Group>(null)
  const retroRef = useRef<THREE.Group>(null)
  const mitoRef = useRef<THREE.Group>(null)
  const seedRef = useRef<THREE.Mesh>(null)
  const phfRef = useRef<THREE.Group>(null)
  const postRef = useRef<THREE.Group>(null)
  const travel = useRef(0)

  useLayoutEffect(() => {
    // instance colours must exist before the first frame
    const c = new THREE.Color(PART_COLOR.tau)
    for (let i = 0; i < TAU_COUNT; i++) tauRef.current?.setColorAt(i, c)
    if (tauRef.current?.instanceColor) tauRef.current.instanceColor.needsUpdate = true
  }, [])

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), e: new THREE.Euler(),
      c: new THREE.Color(), teal: new THREE.Color('#19e6c8'), amber: new THREE.Color('#ffb020'), red: new THREE.Color('#ff5a1f'),
    }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const st = fixedStage ?? smoothStage.get()
    const t = clock.elapsedTime
    const dt = Math.min(0.05, delta)
    const { m, p, q, s, e, c } = tmp

    // --- microtubules fragment, far end first --------------------------------
    const breakLevel = lerp4([0, 0.05, 0.4, 0.82], st)
    if (mtRef.current) {
      let n = 0
      for (let k = 0; k < MT_XZ.length; k++) {
        for (let j = 0; j < SEGS; j++) {
          const level = breakLevel * (k === 0 ? 0.6 : 1) * (0.55 + (0.9 * j) / SEGS)
          const keep = THREE.MathUtils.clamp((pseudo(k * 31 + j, 3) - level) / 0.07 + 0.5, 0, 1)
          const lost = 1 - keep
          p.set(MT_XZ[k][0] + lost * (pseudo(n, 12) - 0.5) * 0.5, MT_TOP - (j + 0.5) * SEG_LEN, MT_XZ[k][1] + lost * 0.25)
          e.set(0, 0, lost * (pseudo(n, 13) - 0.5) * 1.4)
          s.set(1 - lost * 0.4, Math.max(0.001, keep), 1 - lost * 0.4)
          mtRef.current.setMatrixAt(n++, m.compose(p, q.setFromEuler(e), s))
        }
      }
      mtRef.current.instanceMatrix.needsUpdate = true
      mats.mt.emissiveIntensity = lerp4([0.42, 0.36, 0.26, 0.16], st) + (highlight === 'transport' || selId === 'microtubule' ? 0.7 : 0)
    }

    // --- tau: bound -> floating -> clumped ---------------------------------
    const detach = lerp4([0, 0.5, 0.9, 1.05], st)
    if (tauRef.current) {
      for (let i = 0; i < TAU_COUNT; i++) {
        const L = tauLayout[i]
        const a = THREE.MathUtils.smoothstep(detach, L.order, L.order + 0.16)
        const g = THREE.MathUtils.smoothstep(st, 1.55 + L.order * 0.7, 2.2 + L.order * 0.7)
        p.set(
          L.free.x + Math.sin(t * 0.6 + i) * 0.16,
          L.bound.y + Math.sin(t * 0.45 + i * 1.7) * 0.35,
          L.free.z + Math.cos(t * 0.5 + i * 0.8) * 0.16,
        )
        p.lerpVectors(L.bound, p, a)
        if (g > 0) {
          const C = CLUMPS[L.clump]
          s.set(C[0] + L.jitter.x * 0.5, C[1] + L.jitter.y * 1.5, C[2] + L.jitter.z * 0.4)
          p.lerp(s, g)
        }
        e.set(a * (L.jitter.x * 3 + t * 0.4), a * L.jitter.y * 3, a * (L.jitter.z * 3 + t * 0.3))
        const k = 1 - g * 0.45
        tauRef.current.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s.set(k, k, k)))
        c.copy(tmp.teal).lerp(tmp.amber, a).lerp(tmp.red, g)
        tauRef.current.setColorAt(i, c)
      }
      tauRef.current.instanceMatrix.needsUpdate = true
      if (tauRef.current.instanceColor) tauRef.current.instanceColor.needsUpdate = true
      mats.tau.emissiveIntensity = 0.6 + (highlight === 'early' || highlight === 'healthy' || selId === 'tau' ? 1.4 : 0)
    }
    if (phfRef.current) {
      const grow = THREE.MathUtils.clamp((st - 1.6) / 1.1, 0, 1)
      phfRef.current.visible = grow > 0.02
      phfRef.current.children.forEach((ch, i) => {
        ch.scale.setScalar(0.25 + grow * (0.75 + i * 0.12))
        ch.rotation.y = t * 0.15 + i
      })
      mats.phf.opacity = Math.min(1, grow * 1.8)
      mats.phf.emissiveIntensity = 0.9 + (highlight === 'tangle' ? 0.9 : 0)
    }

    // --- transport: kinesin cargo runs down the rails, then stalls ----------
    const speed = lerp4([1.5, 0.85, 0.28, 0.02], st)
    travel.current += dt * speed
    const span = MT_TOP - 0.6 + 3.1
    if (cargoRef.current) {
      cargoRef.current.children.forEach((ch, i) => {
        const cfg = CARGO[i]
        const u = (travel.current * cfg.speed * 0.085 + cfg.phase) % 1
        // late disease: cargo bunches up behind breaks instead of flowing
        const jam = THREE.MathUtils.clamp((st - 1.7) / 1.0, 0, 1)
        const flowY = MT_TOP - 0.6 - u * span
        const jamY = 1.6 + (pseudo(i, 41) - 0.5) * 2.6
        ch.position.set(MT_XZ[cfg.mt][0] + 0.1, THREE.MathUtils.lerp(flowY, jamY, jam * 0.92) + Math.sin(t * 9 + i) * 0.02 * jam, MT_XZ[cfg.mt][1] + 0.16)
        const step = Math.sin(travel.current * 16 + i * 2)
        const feet = ch.children
        if (feet[2]) feet[2].position.y = 0.09 * step
        if (feet[3]) feet[3].position.y = -0.09 * step
      })
    }
    if (retroRef.current) {
      retroRef.current.children.forEach((ch, i) => {
        const u = (travel.current * 0.06 + i * 0.47) % 1
        ch.position.set(MT_XZ[4 + i][0] + 0.05, -3.0 + u * (span - 0.4), MT_XZ[4 + i][1] + 0.36)
      })
    }
    if (mitoRef.current) {
      const dim = lerp4([1, 0.9, 0.55, 0.25], st)
      mitoRef.current.children.forEach((ch, i) => {
        ch.position.y = (i === 0 ? 5.4 : -0.3) + Math.sin(travel.current * 0.35 + i * 2) * 0.7
        ch.scale.setScalar(1 - (1 - dim) * 0.22)
      })
      mats.mito.color.set(PART_COLOR.mitochondrion).lerp(c.set('#8b93a5'), 1 - dim)
      mats.mito.emissiveIntensity = 0.1 + dim * 0.4 + (highlight === 'transport' || selId === 'mitochondrion' ? 0.5 : 0)
    }
    mats.vesicle.emissiveIntensity = 0.2 + speed * 0.2 + (highlight === 'transport' || selId === 'motor' ? 0.6 : 0)

    // --- synapse: vesicle pool empties, release slows, spine shrinks ---------
    const deplete = lerp4([0, 0.12, 0.52, 0.9], st)
    if (svRef.current) {
      for (let i = 0; i < SV_COUNT; i++) {
        const L = svLayout[i]
        const keep = THREE.MathUtils.clamp((L.order - deplete) / 0.08 + 0.5, 0, 1)
        p.copy(L.p)
        p.x += Math.sin(t * 1.3 + i * 2.1) * 0.035
        p.y += Math.cos(t * 1.1 + i * 1.3) * 0.035
        svRef.current.setMatrixAt(i, m.compose(p, q.identity(), s.setScalar(Math.max(0.001, keep))))
      }
      svRef.current.instanceMatrix.needsUpdate = true
      mats.sv.emissiveIntensity = 0.45 + (selId === 'synapse' ? 0.5 : 0)
    }
    const release = lerp4([1, 0.8, 0.38, 0.06], st)
    const cleft = lerp4([0, 0.02, 0.2, 0.55], st)
    if (ntRef.current) {
      for (let i = 0; i < NT_COUNT; i++) {
        const u = (t * 0.9 * (0.6 + pseudo(i, 51) * 0.8) + pseudo(i, 52)) % 1
        const on = pseudo(i, 53) < release ? 1 : 0
        const a = pseudo(i, 54) * Math.PI * 2
        const r = Math.sqrt(pseudo(i, 55)) * 1.4
        p.set(Math.cos(a) * r, -8.04 - u * (0.26 + cleft), Math.sin(a) * r)
        ntRef.current.setMatrixAt(i, m.compose(p, q.identity(), s.setScalar(on * (1 - u * 0.6) + 0.001)))
      }
      ntRef.current.instanceMatrix.needsUpdate = true
    }
    if (postRef.current) {
      postRef.current.position.y = -cleft
      const k = lerp4([1, 0.98, 0.84, 0.62], st)
      postRef.current.scale.set(k, 1, k)
    }
    // --- a tau seed crosses to the next neuron ------------------------------
    if (seedRef.current) {
      const on = st > 0.6 && st < 2.75
      seedRef.current.visible = on
      if (on) {
        const u = (t * 0.22) % 1
        seedRef.current.position.set(Math.sin(u * 5) * 0.5, THREE.MathUtils.lerp(-5.6, -9.6 - cleft, u), 0.7 + Math.cos(u * 4) * 0.3)
        seedRef.current.scale.setScalar((0.8 + Math.sin(t * 6) * 0.12) * Math.sin(Math.min(1, u * 6) * Math.PI * 0.5) * (u > 0.9 ? (1 - u) * 10 : 1))
        seedRef.current.rotation.set(t, t * 0.7, 0)
      }
    }
  })

  const pick = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      setSelection({ kind: 'cellPart', id })
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto'
    },
  })
  const name = (id: string) => mergedCells[id]?.short ?? id
  const front = MT_XZ[1]

  return (
    <group rotation={wide ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
      {/* membrane cutaway + its cut edges */}
      <mesh geometry={geo.membrane} material={mats.membrane} renderOrder={3} userData={{ noPick: true }} raycast={() => null} />
      <mesh geometry={geo.edgeA} material={mats.edge} raycast={() => null} />
      <mesh geometry={geo.edgeB} material={mats.edge} raycast={() => null} />

      <instancedMesh ref={mtRef} args={[geo.mtSeg, mats.mt, MT_XZ.length * SEGS]} frustumCulled={false} {...pick('microtubule')} />
      <instancedMesh ref={tauRef} args={[geo.tau, mats.tau, TAU_COUNT]} frustumCulled={false} {...pick('tau')} />

      <group ref={phfRef} visible={false}>
        {CLUMPS.map((cpos, i) => (
          <mesh key={i} position={cpos} rotation={[0.5 + i * 0.6, 0, 0.9 - i * 0.7]} geometry={geo.phf} material={mats.phf} {...pick('tau')} />
        ))}
      </group>

      {/* kinesin + vesicle cargo heading for the synapse */}
      <group ref={cargoRef}>
        {CARGO.map((cfg, i) => (
          <group key={i} {...pick('motor')}>
            <mesh geometry={geo.vesicle} material={mats.vesicle} position={[0.02, 0, MT_R + 0.3 + cfg.r]} scale={cfg.r} />
            <mesh geometry={geo.stalk} material={mats.motor} position={[0, 0, MT_R + 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.3, 1]} />
            <mesh geometry={geo.foot} material={mats.motor} position={[0, 0.08, MT_R + 0.01]} />
            <mesh geometry={geo.foot} material={mats.motor} position={[0, -0.08, MT_R + 0.01]} />
          </group>
        ))}
      </group>
      {/* dynein hauling endosomes back toward the cell body */}
      <group ref={retroRef}>
        {[0, 1].map((i) => (
          <mesh key={i} geometry={geo.vesicle} material={mats.endosome} scale={0.22} {...pick('motor')} />
        ))}
      </group>

      <group ref={mitoRef}>
        <mesh geometry={geo.mito} material={mats.mito} position={[-1.72, 5.4, 0.1]} rotation={[0.05, 0, 0.03]} {...pick('mitochondrion')} />
        <mesh geometry={geo.mito} material={mats.mito} position={[1.72, -0.3, 0.1]} rotation={[-0.04, 0, -0.03]} {...pick('mitochondrion')} />
      </group>

      {/* presynaptic terminal */}
      <instancedMesh ref={svRef} args={[geo.sv, mats.sv, SV_COUNT]} frustumCulled={false} {...pick('synapse')} />
      <mesh geometry={geo.disc} material={mats.zone} position={[0, -7.93, 0]} {...pick('synapse')} />
      <instancedMesh ref={ntRef} args={[geo.nt, mats.nt, NT_COUNT]} frustumCulled={false} raycast={() => null} />
      <mesh ref={seedRef} geometry={geo.seed} material={mats.seed} visible={false} raycast={() => null} />

      {/* postsynaptic dendritic spine on its dendrite */}
      <group ref={postRef}>
        <mesh geometry={geo.spine} material={mats.spine} {...pick('synapse')} />
        <mesh geometry={geo.disc} material={mats.psd} position={[0, -8.33, 0]} scale={[0.95, 0.6, 0.95]} {...pick('synapse')} />
        {receptors.map((r, i) => (
          <mesh key={i} geometry={geo.receptor} material={mats.receptor} position={r} raycast={() => null} />
        ))}
        <mesh geometry={geo.dendrite} material={mats.spine} position={[0, -13.9, 0]} rotation={[0, 0, Math.PI / 2]} {...pick('synapse')} />
      </group>

      <Hotspot id="microtubule" position={[front[0], 6.3, front[1]]} radius={2.6} label={name('microtubule')} color={PART_COLOR.microtubule} angle={wide ? -60 : -20} length={48} />
      <Hotspot id="tau" position={[tauLayout[TAU_PER_MT + 3].bound.x, tauLayout[TAU_PER_MT + 3].bound.y, tauLayout[TAU_PER_MT + 3].bound.z]} radius={2.3} label={name('tau')} color={PART_COLOR.tau} angle={wide ? 60 : 195} length={50} />
      <Hotspot id="motor" position={[front[0] + 0.1, 1.2, front[1] + 0.6]} radius={2.4} label={name('motor')} color={PART_COLOR.motor} angle={wide ? -70 : -15} length={50} />
      <Hotspot id="mitochondrion" position={[1.72, -0.3, 0.3]} radius={2.6} label={name('mitochondrion')} color={PART_COLOR.mitochondrion} angle={wide ? 70 : 160} length={46} />
      <Hotspot id="synapse" position={[0, -8.18, 1.5]} radius={3.6} label={name('synapse')} color={PART_COLOR.synapse} angle={wide ? -65 : 15} length={50} />
    </group>
  )
}
