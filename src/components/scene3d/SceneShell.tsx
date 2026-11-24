import { ContactShadows, OrbitControls, Sparkles, Stars } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Camera, RotateCcw } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  children: ReactNode
  label: string
  cameraPosition?: [number, number, number]
  /** Shorter canvas in compare mode so two stacked views don't overflow on phones. */
  compact?: boolean
}

/**
 * Cinematic showcase shell — mobile-safe.
 * - Mobile/coarse devices: capped DPR, no shadows, no Sparkles/ContactShadows,
 *   no EffectComposer (Bloom/SMAA black-screen some mobile GPUs), fewer stars.
 * - Desktop high mode keeps the full cinematic stack.
 * - Offline-first: no Environment HDR fetch, everything is procedural lights.
 */
export function SceneShell({ children, label, cameraPosition = [6, 4, 8], compact = false }: Props) {
  const [resetToken, setResetToken] = useState(0)
  const [visible, setVisible] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const bloom = useAppStore((s) => s.bloom)
  const quality = useAppStore((s) => s.quality)
  const theme = useAppStore((s) => s.theme)
  const isMobile = useIsMobile()
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // Cap DPR: mobile GPUs melt above 1.5x; desktop high gets up to 2x.
  const dpr: [number, number] = quality === 'low' || isMobile ? [1, 1] : [1, 2]
  const dark = theme === 'dark'

  // Heavy effects only where they are safe: desktop + high quality + motion OK.
  const cinematic = !isMobile && quality === 'high' && !reduceMotion
  const showBloom = bloom && cinematic
  const showShadow = quality === 'high' && !isMobile
  const showSparkles = !reduceMotion && !isMobile && quality === 'high'
  const starCount = isMobile || quality === 'low' ? 150 : 900

  // Pause offscreen canvases — three stacked + two in compare mode would
  // otherwise all burn GPU while scrolled away.
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const snapshot = () => {
    const canvas = boxRef.current?.querySelector('canvas')
    if (!canvas) return
    try {
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`
      a.click()
    } catch { /* ignore */ }
  }

  return (
    <div
      ref={boxRef}
      className={`relative w-full rounded-xl overflow-hidden ring-1 ${compact ? 'h-[260px] sm:h-[300px]' : 'h-[300px] sm:h-[340px] md:h-[400px]'}`}
      style={{
        background: dark
          ? 'radial-gradient(130% 100% at 50% 0%, rgba(34,211,238,.16), transparent 55%), radial-gradient(110% 90% at 50% 110%, rgba(213,94,0,.14), transparent 60%), linear-gradient(180deg, #0a1222 0%, #070b14 60%, #05080f 100%)'
          : 'radial-gradient(130% 100% at 50% 0%, rgba(14,116,144,.14), transparent 55%), radial-gradient(110% 90% at 50% 110%, rgba(230,159,0,.12), transparent 60%), linear-gradient(180deg, #eef4f8 0%, #e2eaf1 60%, #d4dee8 100%)',
        borderColor: 'rgba(148,163,184,.22)',
        boxShadow: dark
          ? 'inset 0 1px 0 rgba(255,255,255,.06), inset 0 -18px 40px rgba(0,0,0,.45), 0 12px 32px rgba(0,0,0,.35)'
          : 'inset 0 1px 0 rgba(255,255,255,.8), inset 0 -18px 40px rgba(14,116,144,.08), 0 12px 32px rgba(15,23,42,.12)',
      }}
    >
      {/* top gloss sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 z-10"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.10), transparent)' }}
      />
      <Canvas
        aria-label={label}
        role="img"
        camera={{ position: cameraPosition, fov: isMobile ? 50 : 42 }}
        dpr={dpr}
        gl={{
          antialias: !isMobile && quality === 'high',
          alpha: true,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: dark ? 1.15 : 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        shadows={showShadow}
        frameloop={reduceMotion || !visible ? 'demand' : 'always'}
        fallback={<div className="p-4 text-xs opacity-70">3D not available — {label}</div>}
      >
        <Suspense fallback={null}>
          <color attach="background" args={[dark ? '#070b14' : '#e9eff5']} />
          <fog attach="fog" args={[dark ? '#070b14' : '#e9eff5', 14, 26]} />

          {/* studio 3-point + rims (cheap lights only on mobile) */}
          <ambientLight intensity={dark ? 0.55 : 0.85} />
          <hemisphereLight args={[dark ? '#7dd3fc' : '#ffffff', dark ? '#1e1b16' : '#cbd5e1', dark ? 0.5 : 0.6]} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={dark ? 2.0 : 1.6}
            color="#fff7ed"
            castShadow={showShadow}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0004}
          />
          {!isMobile && <directionalLight position={[-6, 3, -5]} intensity={0.7} color="#22d3ee" />}
          <pointLight position={[-6, -3, -4]} intensity={dark ? 12 : 6} color="#22d3ee" distance={30} decay={2} />
          <pointLight position={[4, -4, 4]} intensity={dark ? 10 : 5} color="#fb923c" distance={30} decay={2} />
          {!isMobile && <spotLight position={[0, 9, 2]} angle={0.5} penumbra={0.8} intensity={dark ? 30 : 18} color="#e0f2fe" distance={30} decay={2} />}

          <Stars radius={42} depth={22} count={starCount} factor={2.6} saturation={0} fade speed={reduceMotion ? 0 : 0.35} />
          {showSparkles && (
            <Sparkles count={70} scale={[12, 7, 12]} size={2.2} speed={0.25} opacity={0.5} color={dark ? '#7dd3fc' : '#0e7490'} />
          )}

          {children}

          {cinematic && (
            <ContactShadows position={[0, -2.5, 0]} opacity={dark ? 0.55 : 0.3} scale={15} blur={2.2} far={4.5} color={dark ? '#020617' : '#0e7490'} />
          )}

          {showBloom && (
            <EffectComposer multisampling={0}>
              <Bloom intensity={dark ? 0.75 : 0.45} luminanceThreshold={dark ? 0.45 : 0.6} luminanceSmoothing={0.22} mipmapBlur radius={0.7} />
              <Vignette darkness={dark ? 0.62 : 0.42} offset={0.22} />
            </EffectComposer>
          )}
          <OrbitControls
            key={resetToken}
            makeDefault
            enableDamping
            dampingFactor={0.12}
            rotateSpeed={isMobile ? 0.7 : 1}
            zoomSpeed={isMobile ? 0.8 : 1}
            minDistance={isMobile ? 4 : 3}
            maxDistance={18}
            enablePan={false}
          />
        </Suspense>
      </Canvas>
      <div className="absolute bottom-2 right-2 flex gap-2 z-20">
        <button
          type="button"
          aria-label={`Save snapshot of ${label}`}
          onClick={snapshot}
          className="inline-flex items-center justify-center gap-1.5 text-xs min-h-[44px] min-w-[44px] px-3.5 rounded-lg glass hover:opacity-90 focus-visible:outline-2 active:scale-95"
        >
          <Camera size={15} aria-hidden /> <span className="hidden sm:inline">PNG</span>
        </button>
        <button
          type="button"
          aria-label={`Reset view for ${label}`}
          onClick={() => setResetToken((t) => t + 1)}
          className="inline-flex items-center justify-center gap-1.5 text-xs min-h-[44px] min-w-[44px] px-3.5 rounded-lg glass hover:opacity-90 focus-visible:outline-2 active:scale-95"
        >
          <RotateCcw size={15} aria-hidden /> <span className="hidden sm:inline">Reset view</span>
        </button>
      </div>
    </div>
  )
}
