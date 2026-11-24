import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { lerp4 } from '../../hooks/useSmoothStage'
import { useAppStore } from '../../store/useAppStore'
import { focusDistanceFor, focusTargetFor } from './focusTarget'
import { REGION_NODES } from './regionNodes'

interface Props {
  stage: number
}

/**
 * Real anatomical atlas (Z-Anatomy / BodyParts3D, CC BY-SA 4.0 — see
 * public/models/ATTRIBUTION.md). 437 named meshes with bx_id / bx_cat /
 * bx_side extras; 8 teaching regions map to verified node ids.
 */
const ATLAS_URL = '/models/brain-atlas/brain.glb'

export interface BrainRegionDef {
  id: string
  label: string
  short: string
  side: 'left' | 'right'
  blurb: string
  pos: [number, number, number]
}

/**
 * Curated teaching set — cortical lobes + deep limbic / diencephalic parts.
 * Side-rail labels live in the side rails (App), not in-canvas.
 */
export const BRAIN_REGION_ORDER: BrainRegionDef[] = [
  { id: 'frontal', label: 'Frontal lobe', short: 'FRT', side: 'left', blurb: 'Planning · judgment', pos: [1.15, 0.75, 0.55] },
  { id: 'parietal', label: 'Parietal lobe', short: 'PAR', side: 'left', blurb: 'Attention · space', pos: [0.1, 1.15, 0.15] },
  { id: 'temporal', label: 'Temporal lobe', short: 'TMP', side: 'right', blurb: 'Language · memory', pos: [0.35, -0.55, 0.85] },
  { id: 'entorhinal', label: 'Entorhinal cortex', short: 'EC', side: 'right', blurb: 'Memory gateway', pos: [-0.35, -0.7, 0.5] },
  { id: 'hippocampus', label: 'Hippocampus', short: 'HC', side: 'right', blurb: 'New memories', pos: [-0.1, -0.35, 0.15] },
  { id: 'amygdala', label: 'Amygdala', short: 'AMY', side: 'right', blurb: 'Emotion · threat', pos: [0.32, -0.42, 0.52] },
  { id: 'thalamus', label: 'Thalamus', short: 'THA', side: 'left', blurb: 'Sensory relay', pos: [0.02, 0.08, 0.02] },
  { id: 'hypothalamus', label: 'Hypothalamus', short: 'HYP', side: 'left', blurb: 'Sleep · hunger', pos: [0.0, -0.24, 0.28] },
]

/** Verified against public/models/brain-atlas/manifest.json (GLB bx_id == manifest id). */

const NODE_REGION = new Map<number, string>()
for (const [region, ids] of Object.entries(REGION_NODES)) {
  for (const id of ids) NODE_REGION.set(id, region)
}

/** Categories rendered as teaching context. Vessels / nerves / tracts / meninges / white matter stay hidden. */
const CONTEXT_CATS = ['cortex', 'diencephalon', 'deep_grey', 'ventricles', 'cerebellum', 'brainstem'] as const
const ECO_HIDDEN = new Set(['cerebellum', 'brainstem'])

const CAT_COLOR: Record<string, string> = {
  cortex: '#cfa9a0',
  diencephalon: '#d8b48a',
  deep_grey: '#c98f7a',
  ventricles: '#7dd3fc',
  cerebellum: '#c39a90',
  brainstem: '#b98d84',
}

const REGION_BASE: Record<string, string> = {
  frontal: '#d8b3a6',
  parietal: '#d8b3a6',
  temporal: '#d8b3a6',
  entorhinal: '#e0b890',
  hippocampus: '#c08a80',
  amygdala: '#bd8478',
  thalamus: '#dcb98f',
  hypothalamus: '#d4a478',
}

export function glowFor(id: string, stage: number): number {
  const s = Math.max(0, Math.min(3, stage))
  const ramp = (start: number, full: number) => Math.max(0, Math.min(1, (s - start) / (full - start)))
  if (id === 'entorhinal') return ramp(0.4, 1.0) * 1.5
  if (id === 'hippocampus') return ramp(1.2, 2.2) * 1.9
  if (id === 'amygdala') return ramp(1.3, 2.3) * 1.5
  if (id === 'thalamus') return ramp(1.7, 2.7) * 1.2
  if (id === 'hypothalamus') return ramp(1.5, 2.5) * 1.35
  if (id === 'temporal') return ramp(1.6, 2.6) * 1.35
  if (id === 'parietal') return ramp(2.1, 3.0) * 1.15
  if (id === 'frontal') return ramp(2.3, 3.0) * 1.05
  return 0
}

interface AtlasModel {
  object: THREE.Object3D
  regionMats: Record<string, THREE.MeshPhysicalMaterial>
  contextMats: Record<string, THREE.MeshPhysicalMaterial>
  centroids: Record<string, [number, number, number]>
}

function buildAtlasModel(scene: THREE.Object3D, eco: boolean): AtlasModel {
  const cloned = scene.clone(true)
  // fit to the ~2.75-unit teaching scale
  const box = new THREE.Box3().setFromObject(cloned)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const s = 2.75 / (Math.max(size.x, size.y, size.z) || 1)
  cloned.position.set(-center.x * s, -center.y * s, -center.z * s)
  cloned.scale.setScalar(s)

  const regionMats: Record<string, THREE.MeshPhysicalMaterial> = {}
  const contextMats: Record<string, THREE.MeshPhysicalMaterial> = {}
  const regionBoxes: Record<string, THREE.Box3> = {}

  const matFor = (cache: Record<string, THREE.MeshPhysicalMaterial>, key: string, color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => {
    if (!cache[key]) {
      cache[key] = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.45,
        metalness: 0.03,
        clearcoat: 0.5,
        clearcoatRoughness: 0.5,
        transparent: true,
        ...extra,
      })
    }
    return cache[key]
  }

  cloned.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const ex = (m.userData ?? {}) as { bx_id?: number; bx_cat?: string }
    const cat = typeof ex.bx_cat === 'string' ? ex.bx_cat : ''
    const nodeId = typeof ex.bx_id === 'number' ? ex.bx_id : -1
    if (!CONTEXT_CATS.includes(cat as (typeof CONTEXT_CATS)[number])) {
      m.visible = false
      return
    }
    if (eco && ECO_HIDDEN.has(cat)) {
      m.visible = false
      return
    }
    const region = NODE_REGION.get(nodeId)
    m.castShadow = false
    m.receiveShadow = false
    if (region) {
      m.material = matFor(regionMats, region, REGION_BASE[region] ?? '#d8b3a6', { opacity: 0.92 })
      m.userData.region = region
      regionBoxes[region] ??= new THREE.Box3()
      regionBoxes[region].expandByObject(m)
    } else {
      const isCortex = cat === 'cortex'
      m.material = matFor(contextMats, cat, CAT_COLOR[cat] ?? '#c9a89c', {
        opacity: isCortex ? 0.32 : cat === 'ventricles' ? 0.9 : 0.95,
        depthWrite: !isCortex,
        emissive: cat === 'ventricles' ? '#22d3ee' : '#000000',
        emissiveIntensity: cat === 'ventricles' ? 0.35 : 0,
      })
    }
  })

  const centroids: Record<string, [number, number, number]> = {}
  for (const [region, b] of Object.entries(regionBoxes)) {
    if (!b.isEmpty()) {
      const c = b.getCenter(new THREE.Vector3())
      centroids[region] = [c.x, c.y, c.z]
    }
  }
  return { object: cloned, regionMats, contextMats, centroids }
}

function AtlasBrain({ stage }: { stage: number }) {
  const { scene } = useGLTF(ATLAS_URL)
  const selection = useAppStore((s) => s.selection)
  const setSelection = useAppStore((s) => s.setSelection)
  const isolate = useAppStore((s) => s.isolateOnSelect)
  const quality = useAppStore((s) => s.quality)

  const model = useMemo(() => buildAtlasModel(scene, quality === 'low'), [scene, quality])
  // centroids come straight from the built model — no state/effect needed
  const centroids = model.centroids

  const staticPositions = useMemo(() => {
    const rec: Record<string, [number, number, number]> = {}
    for (const r of BRAIN_REGION_ORDER) rec[r.id] = r.pos
    return rec
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const selId = selection?.kind === 'brainRegion' ? selection.id : null
    for (const [id, mat] of Object.entries(model.regionMats)) {
      const g = glowFor(id, stage)
      const active = selId === id
      const dimmed = isolate && selId !== null && !active
      const targetEmissive = dimmed ? 0.04 : g + (active ? 0.55 : 0) + (g > 0 ? Math.sin(t * 2.4) * 0.12 : 0)
      mat.emissive.set('#ea580c')
      mat.emissiveIntensity += (Math.max(0, targetEmissive) - mat.emissiveIntensity) * 0.12
      const targetOpacity = dimmed ? 0.1 : g > 0.05 || active ? 0.95 : 0.88
      mat.opacity += (targetOpacity - mat.opacity) * 0.12
    }
    for (const [cat, mat] of Object.entries(model.contextMats)) {
      const dimmed = isolate && selId !== null
      const base = cat === 'cortex' ? 0.32 : cat === 'ventricles' ? 0.9 : 0.95
      const targetOpacity = dimmed ? (cat === 'cortex' ? 0.07 : 0.1) : base
      mat.opacity += (targetOpacity - mat.opacity) * 0.12
    }
  })

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // translucent cortex is hit first — walk all hits for the first real region
    const hits = e.intersections ?? []
    for (const h of hits) {
      const region = (h.object.userData as { region?: string }).region
      if (region) {
        setSelection({ kind: 'brainRegion', id: region })
        return
      }
    }
  }

  return (
    <group>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive
        object={model.object}
        onClick={onPick}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      />
      <FocusRig positions={centroids ?? staticPositions} />
    </group>
  )
}

/** Steers the orbit pivot toward the selected region's true centroid, and eases
 *  the camera to a per-region distance (tiny hypothalamus gets closer than a
 *  whole lobe). Distance animates once per selection (~1.2s); pivot tracking is
 *  continuous but never fights rotate/zoom since pan is disabled. */
function FocusRig({ positions }: { positions: Record<string, [number, number, number]> }) {
  const selection = useAppStore((s) => s.selection)
  const goal = useMemo(() => new THREE.Vector3(...focusTargetFor(selection, positions)), [selection, positions])
  const anim = useRef({ key: '', t: 99 })
  useFrame((state, delta) => {
    const controls = state.controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
    if (!controls?.target) return
    const brainSel = selection?.kind === 'brainRegion' ? selection.id : null
    const key = brainSel ?? (selection ? 'cell' : '')
    if (anim.current.key !== key) anim.current = { key, t: 0 }
    controls.target.lerp(goal, 1 - Math.exp(-3 * delta))
    // one-shot distance glide for brain-region picks and for clearing
    const a = anim.current
    if (a.t < 1.2 && (brainSel !== null || selection === null)) {
      a.t = Math.min(1.2, a.t + delta)
      const dist = focusDistanceFor(selection)
      const dir = state.camera.position.clone().sub(controls.target)
      const len = dir.length() || 1
      const desired = controls.target.clone().addScaledVector(dir.multiplyScalar(1 / len), dist)
      state.camera.position.lerp(desired, 1 - Math.exp(-4 * delta))
    }
    controls.update?.()
  })
  return null
}

/** Fallback shell — folded bands, no plain spheres. Only shows if the atlas fails. */
function OrganicFallbackShell({ atrophyDim, stage }: { atrophyDim: number; stage: number }) {
  return (
    <group>
      {[-0.55, 0.55].map((x, i) => (
        <mesh key={i} position={[x, 0.15, -0.2]} scale={[1.05, 1.15, 1.25]}>
          <icosahedronGeometry args={[1.15, 3]} />
          <meshPhysicalMaterial
            color={atrophyDim > 0.5 ? '#475569' : '#94a3b8'}
            emissive={stage > 1.5 ? '#1e293b' : '#0e7490'}
            emissiveIntensity={stage > 2.4 ? 0.3 : 0.14}
            transparent
            opacity={0.78}
            roughness={0.55}
            clearcoat={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

class BrainModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function OrganView({ stage }: Props) {
  const brainScale = lerp4([1, 1, 0.96, 0.9], stage)
  const atrophyDim = Math.max(0, Math.min(1, (stage - 2) / 1))

  const fallbackShell = <OrganicFallbackShell atrophyDim={atrophyDim} stage={stage} />

  return (
    <group scale={brainScale}>
      <BrainModelBoundary fallback={fallbackShell}>
        <Suspense fallback={fallbackShell}>
          <AtlasBrain stage={stage} />
        </Suspense>
      </BrainModelBoundary>
    </group>
  )
}

if (typeof window !== 'undefined') {
  try {
    useGLTF.preload(ATLAS_URL)
  } catch { /* offline / test env — Suspense fallback covers it */ }
}
