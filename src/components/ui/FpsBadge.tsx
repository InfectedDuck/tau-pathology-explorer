import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

/**
 * Global FPS meter + auto quality.
 * Drops to Eco after 3s <28fps; restores High after 5s ≥45fps
 * (hysteresis avoids flapping; bloom stays off until re-enabled).
 */
export function FpsBadge() {
  const [fps, setFps] = useState(0)
  const quality = useAppStore((s) => s.quality)
  const autoDropped = useRef(false)
  const lowStreak = useRef(0)
  const highStreak = useRef(0)

  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      frames++
      if (now - last >= 1000) {
        const f = Math.round((frames * 1000) / (now - last))
        setFps(f)
        frames = 0
        last = now
        const s = useAppStore.getState()
        if (f > 0 && f < 28) {
          lowStreak.current++
          highStreak.current = 0
          if (lowStreak.current >= 3 && s.quality === 'high') {
            s.setQuality('low')
            s.setBloom(false)
            autoDropped.current = true
          }
        } else if (f >= 45) {
          highStreak.current++
          lowStreak.current = 0
          if (highStreak.current >= 5 && autoDropped.current && s.quality === 'low') {
            s.setQuality('high')
            autoDropped.current = false
            highStreak.current = 0
          }
        } else {
          lowStreak.current = 0
          highStreak.current = 0
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const auto = quality === 'low' && fps > 0 && fps < 35
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg glass"
      role="status"
      aria-label={`Frames per second ${fps}, quality ${quality}`}
      title={auto ? 'Auto-Eco engaged (low FPS detected)' : 'Measured render loop FPS'}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: fps >= 45 ? '#009e73' : fps >= 28 ? '#e69f00' : '#d55e00' }} aria-hidden />
      {fps} fps • {quality}{auto ? ' (auto)' : ''}
    </span>
  )
}
