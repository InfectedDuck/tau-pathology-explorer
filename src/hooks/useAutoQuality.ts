import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

/** Loading models and compiling shaders stalls frames; that says nothing about steady-state speed. */
const WARMUP_MS = 9000
/** After this many automatic returns to High, stay in Eco rather than flip back and forth. */
const MAX_RESTORES = 2

/**
 * Frame-rate watchdog. Drops to Eco (and turns glow off) after 3 s under
 * 28 fps; tries High again, without glow, after 5 s at 45 fps or more.
 * Automatic changes are not saved as the user's preference. Returns the
 * measured fps.
 */
export function useAutoQuality(): number {
  const [fps, setFps] = useState(0)
  const autoDropped = useRef(false)
  const restores = useRef(0)
  const lowStreak = useRef(0)
  const highStreak = useRef(0)

  useEffect(() => {
    let frames = 0
    const start = performance.now()
    let last = start
    let raf = 0
    const loop = (now: number) => {
      frames++
      if (now - last >= 1000) {
        const f = Math.round((frames * 1000) / (now - last))
        setFps(f)
        frames = 0
        last = now
        const s = useAppStore.getState()
        // a hidden tab throttles rAF, and start-up is busy loading: neither is a slow GPU
        if (document.visibilityState !== 'visible' || now - start < WARMUP_MS) {
          lowStreak.current = 0
          highStreak.current = 0
        } else if (f > 0 && f < 28) {
          lowStreak.current++
          highStreak.current = 0
          if (lowStreak.current >= 3 && s.quality === 'high') {
            s.setQuality('low', false)
            s.setBloom(false, false)
            autoDropped.current = true
          }
        } else if (f >= 45) {
          highStreak.current++
          lowStreak.current = 0
          if (highStreak.current >= 5 && autoDropped.current && s.quality === 'low' && restores.current < MAX_RESTORES) {
            s.setQuality('high', false)
            autoDropped.current = false
            restores.current++
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

  return fps
}
