import { useEffect, useRef, useState } from 'react'

/** Smoothly interpolate 0..3 stage for cinematic transitions. ~1s damp. Loop stops when settled. */
export function useSmoothStage(target: number): number {
  const [smooth, setSmooth] = useState(target)
  const targetRef = useRef(target)
  const valRef = useRef(target)
  const runningRef = useRef(false)

  useEffect(() => {
    targetRef.current = target
    if (runningRef.current) return
    runningRef.current = true
    let raf = 0
    const tick = () => {
      const diff = targetRef.current - valRef.current
      if (Math.abs(diff) < 0.001) {
        if (valRef.current !== targetRef.current) {
          valRef.current = targetRef.current
          setSmooth(valRef.current)
        }
        runningRef.current = false
        return
      }
      valRef.current += diff * 0.08
      setSmooth(valRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      runningRef.current = false
      cancelAnimationFrame(raf)
    }
  }, [target])

  return smooth
}

/** Piecewise-linear interp of [v0,v1,v2,v3] at float t 0..3 */
export function lerp4(values: [number, number, number, number], t: number): number {
  const c = Math.max(0, Math.min(3, t))
  const i = Math.min(2, Math.floor(c))
  const f = c - i
  return values[i] * (1 - f) + values[i + 1] * f
}
