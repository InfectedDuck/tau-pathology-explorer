import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'

/**
 * Shared state for a set of hotspots whose labels sit on an ellipse around
 * one object. Each hotspot posts the angle it would like; once per frame the
 * angles are nudged apart so neighbouring labels never overlap.
 */
export interface RingGroup {
  want: Map<string, number>
  got: Map<string, number>
  /** ellipse radii in pixels, posted by the hotspots */
  rx: number
  ry: number
}

const LABEL_W = 138
const LABEL_H = 32

export function useRingGroup(): RingGroup {
  const group = useMemo<RingGroup>(() => ({ want: new Map(), got: new Map(), rx: 200, ry: 160 }), [])
  useFrame(() => {
    const items = [...group.want.entries()].sort((a, b) => a[1] - b[1])
    const n = items.length
    const ang = items.map((i) => i[1])
    if (n > 1) {
      for (let pass = 0; pass < 10; pass++) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          const gap = ang[j] - ang[i] + (j === 0 ? Math.PI * 2 : 0)
          // side by side at the top and bottom of the ring, stacked at its sides
          const mid = ang[i] + gap / 2
          const vertical = Math.sin(mid) * Math.sin(mid)
          const need = (LABEL_H / group.ry) * (1 - vertical) + (LABEL_W / group.rx) * vertical
          if (gap < need) {
            const push = (need - gap) / 2
            ang[i] -= push
            ang[j] += push
          }
        }
      }
    }
    group.got.clear()
    items.forEach(([key], i) => group.got.set(key, ang[i]))
    // hotspots post again every frame, so stale entries drop out
    group.want.clear()
  })
  return group
}
