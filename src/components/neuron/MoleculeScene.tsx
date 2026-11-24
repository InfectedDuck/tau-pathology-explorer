import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PART_COLOR } from '../../data/parts'
import { pseudo } from '../../data/tissueStats'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useMergedContent } from '../../hooks/useMergedContent'
import { lerp4 } from '../../hooks/useSmoothStage'
import { TUBULIN_URL, backboneTube, latticeMatrix, loadMolecules, phfRungGeometry, protofilamentOffset, toPoints } from '../../lib/molecules'
import { withRim } from '../../lib/neuriteMaterial'
import { smoothStage, useStageBucket } from '../../lib/smoothStage'
import { useAppStore } from '../../store/useAppStore'
import { Hotspot } from '../viewer/Hotspot'
import { MOLECULE_WIDE_ASPECT } from './moleculeView'

/** 1 world unit = 10 nm (coordinates are angstrom x 0.01) */
const S = 0.01

const ROWS = 12
const MT_X = -165
const PHF_X = 215
/** protofilament index + vertical slot (in dimers from the tube centre) of each bound tau */
const STRANDS = [
  { pf: 3, row: -2 }, { pf: 5, row: 2 }, { pf: 1, row: 1 }, { pf: 6, row: -3 }, { pf: 9, row: 1 }, { pf: 11, row: -2 },
]

/**
 * Box 1, level 3 — the molecules themselves, built from cryo-EM structures:
 * a 13-protofilament microtubule of alpha/beta-tubulin (PDB 6DPV), tau lying
 * along the protofilaments (PDB 7PQC) and the paired helical filament from
 * Alzheimer brain (PDB 5O3L). Disease: phosphates load onto tau, tau lets go,
 * the tube frays from its plus end and the filament grows rung by rung.
 */
export function MoleculeScene({ fixedStage }: { fixedStage?: number }) {
  const mol = use(loadMolecules())
  const gltf = useGLTF(TUBULIN_URL)
  const quality = useAppStore((s) => s.quality)
  const highlight = useAppStore((s) => s.highlight)
  const selId = useAppStore((s) => (s.selection?.kind === 'cellPart' ? s.selection.id : null))
  const setSelection = useAppStore((s) => s.setSelection)
  const isMobile = useIsMobile()
  const { mergedCells } = useMergedContent()
  const bucket = useStageBucket(0.25, fixedStage)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const wide = aspect > MOLECULE_WIDE_ASPECT
  const fine = quality === 'high' && !isMobile
  const maxRungs = fine ? 200 : 130
  const extraRungs = fine ? 110 : 60
  const PF = mol.microtubule.protofilaments
  const count = PF * ROWS

  const geo = useMemo(() => {
    const lod = fine ? 'hi' : 'lo'
    const find = (n: string) => (gltf.scene.getObjectByName(`${n}_${lod}`) as THREE.Mesh).geometry
    const ca = toPoints(mol.tauOnMicrotubule.ca)
    return {
      alpha: find('alpha'),
      beta: find('beta'),
      tau: backboneTube(ca, 3.6, fine ? 2 : 1, fine ? 7 : 5),
      rung: phfRungGeometry(mol, 2.1, fine ? 1 : 0.5, fine ? 5 : 4),
      phosphate: new THREE.IcosahedronGeometry(5.5, 1),
      sites: mol.tauOnMicrotubule.phosphoSites.map((r) => ca[r - mol.tauOnMicrotubule.firstResidue]),
      tauMid: ca[Math.floor(ca.length * 0.45)],
    }
  }, [gltf, mol, fine])

  const mats = useMemo(
    () => ({
      alpha: withRim(new THREE.MeshStandardMaterial({ color: '#a3dcf4', roughness: 0.55, metalness: 0.02 }), '#e0f7ff', 0.38, 2.4),
      beta: withRim(new THREE.MeshStandardMaterial({ color: '#3d8fc0', roughness: 0.55, metalness: 0.02 }), '#bfe9ff', 0.38, 2.4),
      phosphate: new THREE.MeshStandardMaterial({ color: PART_COLOR.phosphate, emissive: '#ffb703', emissiveIntensity: 1.6, roughness: 0.3 }),
      rung: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff5a00', emissiveIntensity: 0.2, roughness: 0.5 }),
      strands: STRANDS.map(() => new THREE.MeshStandardMaterial({ color: PART_COLOR.tau, emissive: PART_COLOR.tau, emissiveIntensity: 0.45, roughness: 0.4, transparent: true })),
    }),
    [],
  )
  useEffect(
    () => () => {
      for (const g of [geo.tau, geo.rung, geo.phosphate]) g.dispose()
      mats.alpha.dispose(); mats.beta.dispose(); mats.phosphate.dispose(); mats.rung.dispose()
      mats.strands.forEach((m) => m.dispose())
    },
    [geo, mats],
  )

  const alphaRef = useRef<THREE.InstancedMesh>(null)
  const betaRef = useRef<THREE.InstancedMesh>(null)
  const rungRef = useRef<THREE.InstancedMesh>(null)
  const extraRef = useRef<THREE.InstancedMesh>(null)
  const strandRefs = useRef<(THREE.Group | null)[]>([])
  const last = useRef({ st: -1, rungs: -1 })
  const half = (ROWS * mol.microtubule.dimerRise) / 2
  const phfLen = maxRungs * mol.phf.rungRise

  // where each tau strand sits on the lattice
  const strandBase = useMemo(
    () => STRANDS.map(({ pf, row }) => latticeMatrix(mol, pf, protofilamentOffset(mol, pf) + (ROWS / 2 + row) * mol.microtubule.dimerRise, new THREE.Matrix4())),
    [mol],
  )
  // filament rungs never move, only their count changes
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const r = new THREE.Matrix4()
    const c = new THREE.Color()
    const mesh = rungRef.current
    if (mesh) {
      for (let k = 0; k < maxRungs; k++) {
        mesh.setMatrixAt(k, m.makeRotationY(k * mol.phf.rungTwist).premultiply(r.makeTranslation(0, k * mol.phf.rungRise - phfLen / 2, 0)))
        mesh.setColorAt(k, c.set(k % 2 ? '#f0641a' : '#d9480f'))
      }
      mesh.count = 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    const extra = extraRef.current
    if (extra) {
      const base = [
        new THREE.Matrix4().makeRotationZ(0.42).premultiply(r.makeTranslation(120, -80, -90)),
        new THREE.Matrix4().makeRotationZ(-0.36).premultiply(r.makeTranslation(-70, 110, 70)),
      ]
      for (let f = 0; f < 2; f++) {
        for (let k = 0; k < extraRungs; k++) {
          m.makeRotationY(k * mol.phf.rungTwist + f * 1.7).premultiply(r.makeTranslation(0, (k - extraRungs / 2) * mol.phf.rungRise, 0)).premultiply(base[f])
          // interleave so both filaments lengthen together as the count rises
          extra.setMatrixAt(k * 2 + f, m)
          extra.setColorAt(k * 2 + f, c.set(k % 2 ? '#e8590c' : '#c2410c'))
        }
      }
      extra.count = 0
      extra.instanceMatrix.needsUpdate = true
      if (extra.instanceColor) extra.instanceColor.needsUpdate = true
    }
    last.current = { st: -1, rungs: -1 }
  }, [mol, maxRungs, extraRungs, phfLen])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), teal: new THREE.Color(PART_COLOR.tau), amber: new THREE.Color('#e69f00'), c: new THREE.Color() }), [])

  useFrame(({ clock }) => {
    const st = fixedStage ?? smoothStage.get()
    const t = clock.elapsedTime
    const mt = mol.microtubule

    // --- lattice: intact, then fraying back from the plus end ---------------
    if (Math.abs(st - last.current.st) > 0.003 && alphaRef.current && betaRef.current) {
      last.current.st = st
      const front = ROWS * lerp4([1.2, 1.2, 0.72, 0.3], st)
      let n = 0
      for (let pf = 0; pf < PF; pf++) {
        const off = protofilamentOffset(mol, pf)
        for (let row = 0; row < ROWS; row++) {
          const y = off + row * mt.dimerRise
          const d = y / mt.dimerRise - front
          const peel = THREE.MathUtils.clamp((d + 2.4) / 3.4, 0, 1)
          const scale = 1 - THREE.MathUtils.smoothstep(peel, 0.7, 1)
          latticeMatrix(mol, pf, y - half, tmp.m, peel, Math.max(0.001, scale))
          alphaRef.current.setMatrixAt(n, tmp.m)
          betaRef.current.setMatrixAt(n, tmp.m)
          n++
        }
      }
      alphaRef.current.instanceMatrix.needsUpdate = true
      betaRef.current.instanceMatrix.needsUpdate = true
    }
    const lit = highlight === 'transport' || highlight === 'healthy' || selId === 'tubulin' ? 0.5 : 0
    ;(mats.alpha.userData.rim as { uRimStrength: { value: number } }).uRimStrength.value = 0.38 + lit
    ;(mats.beta.userData.rim as { uRimStrength: { value: number } }).uRimStrength.value = 0.38 + lit

    // --- tau: phosphorylated, then released --------------------------------
    const detach = lerp4([0, 0.42, 0.9, 1.1], st)
    const phos = THREE.MathUtils.clamp(st / 1.1, 0, 1)
    strandRefs.current.forEach((g, i) => {
      if (!g) return
      const order = 0.12 + pseudo(i, 61) * 0.7
      const a = THREE.MathUtils.smoothstep(detach, order, order + 0.22)
      const inner = g.children[0]
      inner.position.set(a * (170 + pseudo(i, 62) * 120), a * (pseudo(i, 63) - 0.5) * 160 + Math.sin(t * 0.5 + i) * 14 * a, a * (pseudo(i, 64) - 0.5) * 120)
      inner.rotation.set(a * Math.sin(t * 0.22 + i) * 0.35, a * (pseudo(i, 65) - 0.5) * 1.6, a * (0.5 + Math.cos(t * 0.19 + i) * 0.3))
      const mat = mats.strands[i]
      tmp.c.copy(tmp.teal).lerp(tmp.amber, Math.max(a, phos * 0.55))
      mat.color.copy(tmp.c)
      mat.emissive.copy(tmp.c)
      mat.emissiveIntensity = 0.42 + (highlight === 'early' || selId === 'tau' ? 0.5 : 0)
      // released tau is consumed by the growing filament
      mat.opacity = 1 - THREE.MathUtils.smoothstep(st, 1.7 + order, 2.5 + order) * 0.92
      g.visible = mat.opacity > 0.03
      const dots = inner.children[1]
      if (dots) {
        dots.children.forEach((d, k) => d.scale.setScalar(THREE.MathUtils.smoothstep(phos, pseudo(i * 9 + k, 66) * 0.7, pseudo(i * 9 + k, 66) * 0.7 + 0.25) * (1 + Math.sin(t * 3 + k + i) * 0.12)))
        dots.visible = phos > 0.01
      }
    })
    mats.phosphate.emissiveIntensity = 1.5 + (selId === 'phosphate' ? 1.2 : 0)

    // --- paired helical filament grows rung by rung ------------------------
    const grow = THREE.MathUtils.clamp((st - 0.7) / 2.1, 0, 1)
    const rungs = Math.round(maxRungs * grow)
    if (rungRef.current && rungs !== last.current.rungs) {
      last.current.rungs = rungs
      rungRef.current.count = rungs
      rungRef.current.visible = rungs > 0
    }
    if (extraRef.current) {
      const n = Math.round(extraRungs * THREE.MathUtils.clamp((st - 2.0) / 0.9, 0, 1)) * 2
      extraRef.current.count = n
      extraRef.current.visible = n > 0
    }
    mats.rung.emissiveIntensity = 0.2 + Math.sin(t * 1.8) * 0.04 + (highlight === 'tangle' || selId === 'phf' ? 0.45 : 0)
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
  // lattice point on the camera-facing side of the tube
  // near the minus end, which outlasts the fraying plus end
  const facing: [number, number, number] = [24, -330, 132]

  return (
    <group rotation={wide ? [0, 0, -Math.PI / 2] : [0, 0, 0]} scale={S}>
      <group position={[MT_X, 0, 0]}>
        <instancedMesh ref={alphaRef} args={[geo.alpha, mats.alpha, count]} frustumCulled={false} {...pick('tubulin')} />
        <instancedMesh ref={betaRef} args={[geo.beta, mats.beta, count]} frustumCulled={false} {...pick('tubulin')} />
        {STRANDS.map((_, i) => (
          <group key={i} ref={(g) => { strandRefs.current[i] = g }} matrix={strandBase[i].clone().premultiply(new THREE.Matrix4().makeTranslation(0, -half, 0))} matrixAutoUpdate={false}>
            <group>
              <mesh geometry={geo.tau} material={mats.strands[i]} {...pick('tau')} />
              <group visible={false}>
                {geo.sites.map((p, k) => (
                  <mesh key={k} geometry={geo.phosphate} material={mats.phosphate} position={p} scale={0} {...pick('phosphate')} />
                ))}
              </group>
              {i === 0 && (
                <>
                  <Hotspot id="tau" position={[geo.tauMid.x, geo.tauMid.y, geo.tauMid.z]} radius={150} label={name('tau')} color={PART_COLOR.tau} angle={wide ? -70 : 200} length={46} />
                  <Hotspot
                    id="phosphate"
                    position={[geo.sites[5].x, geo.sites[5].y, geo.sites[5].z]}
                    radius={55}
                    label={name('phosphate')}
                    color={PART_COLOR.phosphate}
                    angle={wide ? 70 : 160}
                    length={44}
                    silent={bucket < 0.5}
                  />
                </>
              )}
            </group>
          </group>
        ))}
        <Hotspot id="tubulin" position={facing} radius={170} label={name('tubulin')} color={PART_COLOR.tubulin} angle={wide ? 70 : 195} length={52} />
      </group>

      <group position={[PHF_X, 0, 0]}>
        <instancedMesh ref={rungRef} args={[geo.rung, mats.rung, maxRungs]} frustumCulled={false} visible={false} {...pick('phf')} />
        <instancedMesh ref={extraRef} args={[geo.rung, mats.rung, extraRungs * 2]} frustumCulled={false} visible={false} {...pick('phf')} />
        <Hotspot id="phf" position={[0, -phfLen / 2 + 120, 0]} radius={260} label={name('phf')} color={PART_COLOR.phf} angle={wide ? -70 : -20} length={46} silent={bucket < 1} />
      </group>
    </group>
  )
}

if (typeof window !== 'undefined') {
  try {
    useGLTF.preload(TUBULIN_URL)
  } catch { /* test env */ }
}
