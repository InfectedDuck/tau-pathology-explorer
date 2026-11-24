import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useMergedContent } from '../../hooks/useMergedContent'
import { lerp4 } from '../../hooks/useSmoothStage'
import { withRim } from '../../lib/neuriteMaterial'
import { smoothStage, useStageBucket } from '../../lib/smoothStage'
import { useAppStore, type BrainLayer } from '../../store/useAppStore'
import { REGION_NODES } from '../organ/regionNodes'
import { Hotspot } from '../viewer/Hotspot'
import { useRingGroup } from '../viewer/ring'
import { BRAIN_LENGTH } from './brainView'
import { BRAIN_REGIONS, glowFor } from './regions'

/**
 * Anatomical atlas (Z-Anatomy / BodyParts3D, CC BY-SA 4.0 — see
 * public/models/ATTRIBUTION.md), split into the always-loaded core and an
 * optional extras file (vessels, fibre tracts, cranial nerves).
 */
const CORE_URL = '/models/brain-atlas/brain-core.glb'
const EXTRAS_URL = '/models/brain-atlas/brain-extras.glb'
useGLTF.setDecoderPath('/draco/')


const NODE_REGION = new Map<number, string>()
for (const [region, ids] of Object.entries(REGION_NODES)) for (const id of ids) NODE_REGION.set(id, region)

const CORTICAL = new Set(['frontal', 'parietal', 'temporal', 'entorhinal'])
const CAT_COLOR: Record<string, string> = {
  cortex: '#d8a79b',
  diencephalon: '#d9b58c',
  deep_grey: '#c88f7c',
  ventricles: '#67d6f5',
  cerebellum: '#c79b8f',
  brainstem: '#bb9086',
}
const REGION_COLOR: Record<string, string> = {
  frontal: '#dcab9e',
  parietal: '#d9a89c',
  temporal: '#d6a296',
  entorhinal: '#e2b88e',
  hippocampus: '#c98f84',
  amygdala: '#c2877b',
  thalamus: '#dcb98f',
  hypothalamus: '#d6a67a',
}
/** how strongly each lobe's gyri shrink (sulci widen) in late disease */
const THINNING: Record<string, number> = { temporal: 1, entorhinal: 1, parietal: 0.8, frontal: 0.7 }

interface Extras {
  bx_id?: number
  bx_cat?: string
  bx_label?: string
  bx_side?: string
}

interface AtlasMesh {
  mesh: THREE.Mesh
  cat: string
  side: string
  region: string | null
  label: string
  /** centroid in atlas coordinates */
  centre: THREE.Vector3
}

interface Fit {
  scale: number
  offset: THREE.Vector3
  /** middle of the cerebrum, atlas coordinates */
  centre: THREE.Vector3
  /** +1 when the anatomical left hemisphere lies on +X */
  leftSign: number
}

function readMeshes(root: THREE.Object3D): AtlasMesh[] {
  const out: AtlasMesh[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    // primitives of one atlas node share the node's extras via their parent
    const ex = ((mesh.userData.bx_cat ? mesh.userData : mesh.parent?.userData) ?? {}) as Extras
    if (!ex.bx_cat) return
    mesh.geometry.computeBoundingBox()
    out.push({
      mesh,
      cat: ex.bx_cat,
      side: ex.bx_side ?? 'median',
      region: typeof ex.bx_id === 'number' ? NODE_REGION.get(ex.bx_id) ?? null : null,
      label: ex.bx_label ?? mesh.name,
      centre: mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()),
    })
  })
  return out
}

function sideLabel(side: string): string {
  return side === 'left' ? ' (L)' : side === 'right' ? ' (R)' : ''
}

/** Optional layers from the extras file, placed with the same fit as the core atlas. */
function BrainExtras({ fit, layers }: { fit: Fit; layers: Record<BrainLayer, boolean> }) {
  const { scene } = useGLTF(EXTRAS_URL)
  const group = useMemo(() => {
    const root = scene.clone(true)
    const mats: Record<string, THREE.Material> = {
      arteries: new THREE.MeshStandardMaterial({ color: '#e5484d', roughness: 0.4, emissive: '#7f1d1d', emissiveIntensity: 0.5 }),
      veins_sinuses: new THREE.MeshStandardMaterial({ color: '#4f7fe0', roughness: 0.45, emissive: '#1e3a8a', emissiveIntensity: 0.5 }),
      tracts: new THREE.MeshStandardMaterial({ color: '#f3e9c6', roughness: 0.6, transparent: true, opacity: 0.6, depthWrite: false }),
      cranial_nerves: new THREE.MeshStandardMaterial({ color: '#f5d76e', roughness: 0.5, emissive: '#7a5b00', emissiveIntensity: 0.4 }),
    }
    for (const m of readMeshes(root)) {
      m.mesh.material = mats[m.cat] ?? mats.tracts
      m.mesh.userData = { layer: m.cat === 'tracts' ? 'tracts' : m.cat === 'cranial_nerves' ? 'nerves' : 'vessels', noPick: true }
      m.mesh.raycast = () => null
    }
    return root
  }, [scene])
  useEffect(() => {
    group.traverse((o) => {
      const layer = o.userData.layer as BrainLayer | undefined
      if (layer) o.visible = layers[layer]
    })
  }, [group, layers])
  return <primitive object={group} scale={fit.scale} position={fit.offset} />
}

/**
 * Box 3 — the whole brain. 262 named structures; the eight teaching regions
 * light up in Braak order. Late disease shrinks the hippocampus, widens the
 * sulci and enlarges the ventricles. Three views: glass (see-through cortex),
 * surface, and a cutaway that removes the near hemisphere's cortex.
 */
export function BrainScene({ fixedStage }: { fixedStage?: number }) {
  const { scene } = useGLTF(CORE_URL)
  const selection = useAppStore((s) => s.selection)
  const setSelection = useAppStore((s) => s.setSelection)
  const isolate = useAppStore((s) => s.isolateOnSelect)
  const view = useAppStore((s) => s.brainView)
  const layers = useAppStore((s) => s.brainLayers)
  const { mergedRegions } = useMergedContent()
  const bucket = useStageBucket(0.25, fixedStage)
  // too narrow to ring the brain with names: show tappable dots instead
  const cramped = useThree((s) => s.size.width < 640)
  const [tip, setTip] = useState<{ text: string; at: THREE.Vector3 } | null>(null)
  const tipTimer = useRef(0)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const meshes = readMeshes(root)
    // fit on the cerebral cortex only, so the frame is stable whatever is shown
    const box = new THREE.Box3()
    let leftX = 0
    for (const m of meshes) {
      if (m.cat !== 'cortex') continue
      box.union(m.mesh.geometry.boundingBox!)
      if (m.side === 'left') leftX += m.centre.x
    }
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const scale = BRAIN_LENGTH / Math.max(size.x, size.y, size.z)
    const fit: Fit = { scale, offset: centre.clone().multiplyScalar(-scale), centre, leftSign: leftX >= 0 ? 1 : -1 }

    const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      withRim(new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02, transparent: true, ...extra }), '#ffe1d6', 0.3, 2.6)
    const regionMats: Record<string, THREE.MeshStandardMaterial> = {}
    const catMats: Record<string, THREE.MeshStandardMaterial> = {}
    for (const m of meshes) {
      if (m.region) {
        regionMats[m.region] ??= mat(REGION_COLOR[m.region] ?? '#d8a79b', { emissive: '#ea580c', emissiveIntensity: 0 })
        m.mesh.material = regionMats[m.region]
      } else {
        catMats[m.cat] ??= mat(CAT_COLOR[m.cat] ?? '#c9a89c', m.cat === 'ventricles' ? { emissive: '#22d3ee', emissiveIntensity: 0.4, roughness: 0.25 } : {})
        m.mesh.material = catMats[m.cat]
      }
      m.mesh.userData = { atlas: m }
    }
    return { root, meshes, fit, regionMats, catMats }
  }, [scene])

  useEffect(
    () => () => {
      Object.values(model.regionMats).forEach((m) => m.dispose())
      Object.values(model.catMats).forEach((m) => m.dispose())
    },
    [model],
  )

  // the camera looks from +X, so that hemisphere is the "near" one
  const nearSide = model.fit.leftSign > 0 ? 'left' : 'right'
  const farSide = nearSide === 'left' ? 'right' : 'left'

  // visibility + transparency per view mode
  useEffect(() => {
    const glass = view === 'glass'
    for (const m of model.meshes) {
      let visible = true
      if ((m.cat === 'cerebellum' || m.cat === 'brainstem') && !layers.hindbrain) visible = false
      if (m.cat === 'ventricles' && !layers.ventricles) visible = false
      // the hippocampus is filed under cortex in the atlas, but it is one of the deep structures the cutaway is for
      if (view === 'cutaway' && m.side === nearSide && (m.cat === 'cortex' || m.cat === 'cerebellum') && m.region !== 'hippocampus') visible = false
      m.mesh.visible = visible
    }
    const ghost = (mat: THREE.MeshStandardMaterial, on: boolean) => {
      mat.depthWrite = !on
      mat.userData.ghost = on
      mat.needsUpdate = true
    }
    for (const [cat, mat] of Object.entries(model.catMats)) ghost(mat, glass && (cat === 'cortex' || cat === 'cerebellum'))
    for (const [region, mat] of Object.entries(model.regionMats)) ghost(mat, glass && CORTICAL.has(region))
    // draw order: solid first, then anything dimmed by isolate, then see-through cortex
    const selId = selection?.kind === 'brainRegion' ? selection.id : null
    for (const m of model.meshes) {
      const mat = m.mesh.material as THREE.Material
      const dimmed = isolate && selId !== null && m.region !== selId
      m.mesh.renderOrder = mat.userData.ghost ? 3 : dimmed ? 2 : 0
    }
  }, [model, view, layers, nearSide, selection, isolate])

  // label anchors on whichever hemisphere is in view
  const anchors = useMemo(() => {
    const out: Record<string, { p: [number, number, number]; r: number }> = {}
    const v = new THREE.Vector3()
    for (const def of BRAIN_REGIONS) {
      const cortical = CORTICAL.has(def.id)
      const side = view === 'cutaway' && cortical ? farSide : nearSide
      let list = model.meshes.filter((m) => m.region === def.id && (m.side === side || m.side === 'median'))
      if (!list.length) list = model.meshes.filter((m) => m.region === def.id)
      if (!list.length) continue
      const box = new THREE.Box3()
      for (const m of list) box.union(m.mesh.geometry.boundingBox!)
      const c = box.getCenter(new THREE.Vector3())
      if (cortical) {
        // sit on the gyrus nearest the lobe's middle, on the face turned to the camera
        let best = list[0]
        let bestD = Infinity
        for (const m of list) {
          const d = m.centre.distanceToSquared(c)
          if (d < bestD) {
            bestD = d
            best = m
          }
        }
        const bb = best.mesh.geometry.boundingBox!
        c.copy(best.centre)
        const towardCamera = model.fit.leftSign > 0 ? bb.max.x : bb.min.x
        const awayFromCamera = model.fit.leftSign > 0 ? bb.min.x : bb.max.x
        // near hemisphere: its outer face; far hemisphere (cutaway): its inner face
        c.x = side === nearSide ? towardCamera : side === farSide ? towardCamera : awayFromCamera
      }
      out[def.id] = { p: [c.x, c.y, c.z], r: Math.max(0.012, box.getSize(v).length() * 0.5) }
    }
    return out
  }, [model, view, nearSide, farSide])

  const scratch = useMemo(() => ({ c: new THREE.Vector3() }), [])
  const ringGroup = useRingGroup()
  const rootRef = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    const st = fixedStage ?? smoothStage.get()
    const t = clock.elapsedTime
    const k = Math.min(1, delta * 7)
    const selId = selection?.kind === 'brainRegion' ? selection.id : null
    const glass = view === 'glass'
    for (const [id, mat] of Object.entries(model.regionMats)) {
      const g = glowFor(id, st)
      const active = selId === id
      const dimmed = isolate && selId !== null && !active
      const emissive = dimmed ? 0.03 : g * 0.85 + (active ? 0.5 : 0) + (g > 0 ? Math.sin(t * 2.4) * 0.1 : 0)
      mat.emissiveIntensity += (Math.max(0, emissive) - mat.emissiveIntensity) * k
      const base = mat.userData.ghost ? (g > 0.05 || active ? 0.5 : 0.24) : 1
      mat.opacity += ((dimmed ? (mat.userData.ghost ? 0.06 : 0.14) : base) - mat.opacity) * k
      // a faded structure must not hide the one being isolated
      mat.depthWrite = !mat.userData.ghost && !dimmed
    }
    for (const [cat, mat] of Object.entries(model.catMats)) {
      const dimmed = isolate && selId !== null
      const base = mat.userData.ghost ? (cat === 'cortex' ? 0.2 : 0.4) : cat === 'ventricles' ? 0.9 : 1
      mat.opacity += ((dimmed ? (glass ? 0.06 : 0.16) : base) - mat.opacity) * k
      mat.depthWrite = !mat.userData.ghost && !dimmed
    }

    // atrophy: the whole brain loses volume; hippocampus shrinks, gyri thin (sulci widen), ventricles enlarge
    if (rootRef.current) rootRef.current.scale.setScalar(lerp4([1, 1, 0.975, 0.93], st))
    const late = THREE.MathUtils.clamp((st - 1.6) / 1.4, 0, 1)
    const hip = THREE.MathUtils.clamp((st - 1.2) / 1.6, 0, 1)
    for (const m of model.meshes) {
      let s = 1
      if (m.cat === 'ventricles') s = 1 + late * 0.3
      else if (m.region === 'hippocampus' || m.region === 'amygdala') s = 1 - hip * 0.2
      else if (m.cat === 'cortex') s = 1 - late * 0.075 * (m.region ? THINNING[m.region] ?? 0.5 : 0.45)
      if (Math.abs(m.mesh.scale.x - s) > 1e-4) {
        m.mesh.scale.setScalar(s)
        m.mesh.position.copy(scratch.c.copy(m.centre).multiplyScalar(1 - s))
      }
    }
  })

  const showTip = (m: AtlasMesh, hold = 0) => {
    const at = m.centre.clone().multiplyScalar(model.fit.scale).add(model.fit.offset)
    setTip((prev) => (prev && prev.text === m.label + sideLabel(m.side) ? prev : { text: m.label + sideLabel(m.side), at }))
    window.clearTimeout(tipTimer.current)
    if (hold) tipTimer.current = window.setTimeout(() => setTip(null), hold)
  }
  useEffect(() => () => window.clearTimeout(tipTimer.current), [])

  /** nearest solid structure under the pointer; see-through cortex only counts when nothing solid lies behind it */
  const underPointer = (e: ThreeEvent<MouseEvent | PointerEvent>, wantRegion: boolean): AtlasMesh | null => {
    let ghost: AtlasMesh | null = null
    for (const h of e.intersections) {
      const m = h.object.userData.atlas as AtlasMesh | undefined
      if (!m || !h.object.visible || (wantRegion && !m.region)) continue
      if (((h.object as THREE.Mesh).material as THREE.Material).userData.ghost) {
        ghost ??= m
        continue
      }
      return m
    }
    return ghost
  }

  const needExtras = layers.vessels || layers.tracts || layers.nerves
  const ring = useMemo(
    () => ({ from: [model.fit.centre.x, model.fit.centre.y - 0.012, model.fit.centre.z] as [number, number, number], radius: 0.08, group: ringGroup }),
    [model, ringGroup],
  )

  return (
    <group ref={rootRef}>
      <primitive
        object={model.root}
        scale={model.fit.scale}
        position={model.fit.offset}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          const region = underPointer(e, true)
          const any = underPointer(e, false)
          if (region && (!any || any.region || region === any)) setSelection({ kind: 'brainRegion', id: region.region! })
          else if (any) showTip(any, 2600)
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.pointerType === 'touch') return
          e.stopPropagation()
          const m = underPointer(e, false)
          if (m) showTip(m)
          document.body.style.cursor = m?.region ? 'pointer' : 'auto'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          setTip(null)
        }}
      />

      {needExtras && (
        <Suspense fallback={null}>
          <BrainExtras fit={model.fit} layers={layers} />
        </Suspense>
      )}

      <group scale={model.fit.scale} position={model.fit.offset}>
        {BRAIN_REGIONS.map((def) => {
          const a = anchors[def.id]
          if (!a) return null
          const selId = selection?.kind === 'brainRegion' ? selection.id : null
          return (
            <Hotspot
              key={`${def.id}-${view}`}
              id={def.id}
              kind="brainRegion"
              position={a.p}
              radius={a.r * (CORTICAL.has(def.id) ? 0.9 : 2.1)}
              label={mergedRegions[def.id]?.name ?? def.id}
              color={glowFor(def.id, bucket) > 0.05 ? '#fb923c' : '#9bdcf5'}
              angle={def.angle}
              length={24}
              radial={ring}
              dotOnly={cramped}
              silent={isolate && selId !== null && selId !== def.id}
            />
          )
        })}
      </group>

      {tip && (
        <Html position={tip.at} zIndexRange={[40, 33]} style={{ pointerEvents: 'none' }}>
          <div className="tip">{tip.text}</div>
        </Html>
      )}
    </group>
  )
}

if (typeof window !== 'undefined') {
  try {
    useGLTF.preload(CORE_URL)
  } catch { /* test env */ }
}
