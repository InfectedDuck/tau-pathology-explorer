import { useSyncExternalStore } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * One shared, eased copy of the timeline stage (0..3). 3D scenes read it in
 * their frame loop via `smoothStage.get()`, so a stage change animates without
 * re-rendering React every frame. Components that only care about coarse
 * steps subscribe with `useStageBucket`.
 */
let value: number = useAppStore.getState().stage
let target: number = value
let raf = 0
let last = 0
const listeners = new Set<() => void>()

function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  const diff = target - value
  if (Math.abs(diff) < 0.002) {
    value = target
    raf = 0
  } else {
    value += diff * (1 - Math.exp(-dt * 4.5))
    raf = requestAnimationFrame(tick)
  }
  listeners.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  useAppStore.subscribe((s) => {
    if (s.stage === target) return
    target = s.stage
    if (!raf && typeof requestAnimationFrame !== 'undefined') {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
  })
}

export const smoothStage = {
  get: (): number => value,
  /** true while the eased value is still travelling */
  moving: (): boolean => raf !== 0,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

export function quantize(v: number, step: number): number {
  return Math.round(v / step) * step
}

/**
 * Eased stage rounded to `step`; re-renders only when the rounded value
 * changes. Pass `fixed` to pin a view to one stage (compare mode).
 */
export function useStageBucket(step = 0.25, fixed?: number): number {
  const live = useSyncExternalStore(
    smoothStage.subscribe,
    () => quantize(value, step),
    () => 0,
  )
  return fixed ?? live
}
