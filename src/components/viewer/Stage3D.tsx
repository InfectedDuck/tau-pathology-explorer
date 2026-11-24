import { Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Component, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAppStore } from '../../store/useAppStore'
import { ViewerCtx, type ViewerRegistry } from './viewerContext'

export interface HomeView {
  target: [number, number, number]
  /** width / height (world units) that must fit in view */
  size: [number, number]
  /** direction from the target to the camera */
  dir?: [number, number, number]
  margin?: number
}

export interface RigApi {
  zoomBy: (factor: number) => void
  reset: () => void
}

/** A fixed home view, or one chosen from the viewport aspect ratio (width / height). */
export type HomeSpec = HomeView | ((aspect: number) => HomeView)

const resolveHome = (home: HomeSpec, aspect: number): HomeView => (typeof home === 'function' ? home(aspect) : home)

interface Stage3DProps {
  label: string
  home: HomeSpec
  /** closest the camera may get to its pivot (world units) */
  minDistance?: number
  /** metres represented by one world unit — drives the scale bar */
  metersPerUnit: number
  /** changing this snaps the camera back to the home view (e.g. zoom-level switch) */
  viewKey?: string
  /** `kind:id` of the part to fly to, looked up in this viewer's hotspots */
  focusKey?: string | null
  rigRef?: RefObject<RigApi | null>
  /** pixels at the top / bottom of the viewport covered by overlays */
  insets?: { top: number; bottom: number }
  children: ReactNode
}

type Controls = {
  target: THREE.Vector3
  update: () => void
  maxDistance: number
  minDistance: number
  autoRotate: boolean
  addEventListener: (t: string, fn: () => void) => void
  removeEventListener: (t: string, fn: () => void) => void
}

function formatLength(m: number): string {
  const f = (v: number) => String(Number(v.toPrecision(2)))
  if (m >= 1e-2) return `${f(m * 100)} cm`
  if (m >= 1e-3) return `${f(m * 1e3)} mm`
  if (m >= 1e-6) return `${f(m * 1e6)} µm`
  if (m >= 1e-9) return `${f(m * 1e9)} nm`
  return `${f(m * 1e10)} Å`
}

/** Camera rig: fits the scene, flies to selected parts, serves the zoom buttons and the scale bar. */
function Rig({
  home, minDistance, metersPerUnit, viewKey, focusKey, rigRef, registry, scaleRef, spin, stopSpin, insets,
}: {
  stopSpin: () => void
  insets: { top: number; bottom: number }
  home: HomeSpec
  minDistance: number
  metersPerUnit: number
  viewKey: string
  focusKey: string | null
  rigRef?: RefObject<RigApi | null>
  registry: ViewerRegistry
  scaleRef: RefObject<HTMLDivElement | null>
  spin: boolean
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  const anim = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null)
  const touched = useRef(false)
  const applied = useRef<string | null>(null)
  const frame = useRef(0)
  const lastScale = useRef('')
  const isMobile = useIsMobile()

  const homePose = useCallback(() => {
    const half = Math.tan((camera.fov * Math.PI) / 360)
    const aspect = size.width / Math.max(1, size.height)
    const view = resolveHome(home, aspect)
    const [w, h] = view.size
    // keep the subject clear of the title (top), part chips (bottom) and tools (right)
    const padTop = Math.min(insets.top, size.height * 0.3)
    const padBottom = Math.min(insets.bottom, size.height * 0.5)
    const padRight = Math.min(58, size.width * 0.13)
    const freeH = Math.max(1, size.height - padTop - padBottom)
    const freeW = Math.max(1, size.width - padRight)
    const d = Math.max((h / 2 / half) * (size.height / freeH), (w / 2 / (half * aspect)) * (size.width / freeW)) * (view.margin ?? 1.1)
    const dir = new THREE.Vector3(...(view.dir ?? [0.3, 0.16, 1])).normalize()
    const target = new THREE.Vector3(...view.target)
    // slide the pivot so the subject sits in the middle of the free area
    const worldPerPx = (2 * d * half) / Math.max(1, size.height)
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize()
    const up = dir.clone().cross(right)
    target.addScaledVector(right, (padRight / 2) * worldPerPx).addScaledVector(up, ((padTop - padBottom) / 2) * worldPerPx)
    return { target, position: target.clone().addScaledVector(dir, d), distance: d }
  }, [camera, size.width, size.height, home, insets.top, insets.bottom])

  const snapHome = useCallback(() => {
    if (!controls) return
    const pose = homePose()
    camera.position.copy(pose.position)
    controls.target.copy(pose.target)
    controls.minDistance = minDistance
    controls.maxDistance = pose.distance * 2.6
    scene.fog = new THREE.Fog('#070b14', pose.distance * 0.8, pose.distance * 2.9)
    controls.update()
    anim.current = null
    invalidate()
  }, [camera, controls, homePose, minDistance, scene, invalidate])

  // New view (or first mount): start from the fitted home pose.
  useEffect(() => {
    touched.current = false
    applied.current = null
    snapHome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, controls])

  // Keep the scene fitted while the box resizes, until the user takes over.
  useEffect(() => {
    if (!touched.current && !anim.current && applied.current === null) snapHome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, insets.top, insets.bottom])

  useEffect(() => {
    if (!controls) return
    const onStart = () => {
      anim.current = null
      touched.current = true
      stopSpin()
    }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls, stopSpin])

  const flyTo = useCallback((target: THREE.Vector3, distance: number, centre = false) => {
    if (!controls) return
    const dir = camera.position.clone().sub(controls.target)
    if (dir.lengthSq() < 1e-9) dir.set(0, 0, 1)
    dir.normalize()
    const d = Math.min(controls.maxDistance, Math.max(minDistance, distance))
    const pivot = target.clone()
    if (centre) {
      // put the subject in the middle of the area the overlays leave free
      const worldPerPx = (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height)
      const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize()
      const up = dir.clone().cross(right)
      const padTop = Math.min(insets.top, size.height * 0.3)
      const padBottom = Math.min(insets.bottom, size.height * 0.5)
      pivot.addScaledVector(right, (Math.min(58, size.width * 0.13) / 2) * worldPerPx).addScaledVector(up, ((padTop - padBottom) / 2) * worldPerPx)
    }
    anim.current = { target: pivot, position: pivot.clone().addScaledVector(dir, d) }
    stopSpin()
    invalidate()
  }, [camera, controls, minDistance, invalidate, stopSpin, size.width, size.height, insets.top, insets.bottom])

  useImperativeHandle(rigRef, () => ({
    zoomBy(factor: number) {
      if (!controls) return
      touched.current = true
      const base = anim.current ?? { target: controls.target, position: camera.position }
      flyTo(base.target, base.position.distanceTo(base.target) * factor)
    },
    reset() {
      const pose = homePose()
      touched.current = false
      applied.current = focusKey
      anim.current = { target: pose.target, position: pose.position }
      invalidate()
    },
  }), [controls, camera, flyTo, homePose, focusKey, invalidate])

  // Double-click / double-tap: fly to the point under the cursor.
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const onDbl = (ev: MouseEvent) => {
      if (!controls) return
      const r = el.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = ray.intersectObjects(scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible && !h.object.userData.noPick)
      if (!hit) return
      touched.current = true
      flyTo(hit.point, camera.position.distanceTo(controls.target) * 0.45)
    }
    el.addEventListener('dblclick', onDbl)
    return () => el.removeEventListener('dblclick', onDbl)
  }, [gl, camera, scene, controls, flyTo])

  useFrame((_, delta) => {
    if (!controls) return
    // fly to the selected part once its hotspot exists in this viewer
    if (focusKey !== applied.current) {
      if (!focusKey) applied.current = null
      else {
        const entry = registry.focus.get(focusKey)
        if (entry) {
          const half = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, size.width / Math.max(1, size.height)))
          flyTo(entry.position(), (entry.radius() / Math.sin(half)) * 1.2, true)
          applied.current = focusKey
        }
      }
    }
    const a = anim.current
    if (a) {
      const k = 1 - Math.exp(-Math.min(0.05, delta) * 4.4)
      controls.target.lerp(a.target, k)
      camera.position.lerp(a.position, k)
      const span = camera.position.distanceTo(controls.target)
      if (camera.position.distanceTo(a.position) < span * 0.002 && controls.target.distanceTo(a.target) < span * 0.002) anim.current = null
      controls.update()
      invalidate()
    }
    // scale bar (throttled)
    if (frame.current++ % 6 === 0 && scaleRef.current) {
      const d = camera.position.distanceTo(controls.target)
      const mPerPx = ((2 * d * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height)) * metersPerUnit
      const raw = mPerPx * 76
      const pow = Math.pow(10, Math.floor(Math.log10(raw)))
      const m = raw / pow
      const len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * pow
      const key = `${formatLength(len)}|${Math.round(len / mPerPx)}`
      if (key !== lastScale.current) {
        lastScale.current = key
        scaleRef.current.style.setProperty('--bar', `${Math.round(len / mPerPx)}px`)
        scaleRef.current.dataset.len = formatLength(len)
      }
    }
  })

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={isMobile ? 0.75 : 0.9}
      zoomSpeed={isMobile ? 0.9 : 1.1}
      panSpeed={0.9}
      zoomToCursor={!isMobile}
      enablePan
      screenSpacePanning
      autoRotate={spin}
      autoRotateSpeed={0.55}
      minDistance={minDistance}
    />
  )
}

/** Slow drifting motes for depth, sized to whatever the scene's home view covers. */
function Dust({ home, count }: { home: HomeSpec; count: number }) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const view = resolveHome(home, aspect)
  return (
    <Sparkles
      count={count}
      scale={[view.size[0] * 1.5, view.size[1] * 1.3, Math.min(view.size[0], view.size[1]) * 1.4]}
      position={view.target}
      size={1.6}
      speed={0.18}
      opacity={0.28}
      color="#9bdcf5"
    />
  )
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

/**
 * One 3D viewport: dark-field studio lighting, fitted camera, orbit / pan /
 * zoom controls and a live scale bar. Specimen windows stay dark in both UI
 * themes, like a microscope field.
 */
const DEFAULT_INSETS = { top: 104, bottom: 60 }

export function Stage3D({ label, home, minDistance = 0.4, metersPerUnit, viewKey = 'default', focusKey = null, rigRef, insets = DEFAULT_INSETS, children }: Stage3DProps) {
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const bloom = useAppStore((s) => s.bloom)
  const quality = useAppStore((s) => s.quality)
  const isMobile = useIsMobile()
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const high = quality === 'high'
  const dpr: [number, number] = high ? [1, 2] : [1, 1.25]
  const showBloom = bloom && high && !isMobile && !reduceMotion
  const registry = useMemo<ViewerRegistry>(() => ({ focus: new Map() }), [])
  const onReady = useCallback(() => setReady(true), [])
  // a slow idle turn shows off the depth; it stops for good the moment the pointer arrives
  const [spin, setSpin] = useState(!reduceMotion)
  const stopSpin = useCallback(() => setSpin(false), [])
  const onError = useCallback(() => setFailed(true), [])

  // Pause offscreen canvases.
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={boxRef} className="absolute inset-0" onPointerEnter={stopSpin} onPointerDown={stopSpin}>
      <Canvas
        aria-label={label}
        role="img"
        camera={{ position: [0, 0, 12], fov: 36, near: 0.02, far: 500 }}
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        frameloop={!visible ? 'never' : reduceMotion ? 'demand' : 'always'}
        fallback={<div className="p-4 text-xs opacity-70">3D not available — {label}</div>}
      >
        <ViewerCtx.Provider value={registry}>
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#9bdcf5', '#1a1410', 0.55]} />
          <directionalLight position={[5, 8, 6]} intensity={2.1} color="#fff4e6" />
          <directionalLight position={[-7, 2, -5]} intensity={1.1} color="#38bdf8" />
          <pointLight position={[5, -5, 4]} intensity={18} color="#fb923c" distance={40} decay={2} />
          <Environment resolution={isMobile ? 64 : 256} frames={1} environmentIntensity={0.55}>
            <color attach="background" args={['#04060b']} />
            <Lightformer form="rect" intensity={2.4} color="#dbeafe" position={[0, 7, 2]} scale={[12, 5, 1]} />
            <Lightformer form="rect" intensity={1.6} color="#22d3ee" position={[-8, 1, -3]} scale={[4, 9, 1]} />
            <Lightformer form="rect" intensity={1.1} color="#fdba74" position={[8, -2, 3]} scale={[3, 7, 1]} />
            <Lightformer form="ring" intensity={1.2} color="#e0f2fe" position={[0, -1, 9]} scale={3} />
          </Environment>
          {high && !reduceMotion && <Dust home={home} count={isMobile ? 24 : 55} />}

          <SceneBoundary onError={onError}>
            <Suspense fallback={null}>
              {children}
              <Ready onReady={onReady} />
            </Suspense>
          </SceneBoundary>

          {showBloom && (
            <EffectComposer multisampling={4}>
              <Bloom intensity={0.7} luminanceThreshold={0.7} luminanceSmoothing={0.25} mipmapBlur levels={6} radius={0.72} />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
              <Vignette darkness={0.5} offset={0.25} />
            </EffectComposer>
          )}
          <Rig
            home={home}
            minDistance={minDistance}
            metersPerUnit={metersPerUnit}
            viewKey={viewKey}
            focusKey={focusKey}
            rigRef={rigRef}
            registry={registry}
            scaleRef={scaleRef}
            spin={spin}
            stopSpin={stopSpin}
            insets={insets}
          />
        </ViewerCtx.Provider>
      </Canvas>

      {!ready && !failed && (
        <div className="viewer-loading" role="status">
          <span className="viewer-spinner" aria-hidden />
          <span>Loading 3D model…</span>
        </div>
      )}
      {failed && (
        <div className="viewer-loading" role="alert">
          <span>The 3D model could not be loaded. Check your connection and reload.</span>
        </div>
      )}
      <div ref={scaleRef} className="scale-bar" data-len="" aria-hidden />
    </div>
  )
}
