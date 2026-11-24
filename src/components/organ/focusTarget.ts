import type { Selection } from '../../store/useAppStore'

/**
 * Camera focus goal for a selection. Pure (positions injected) so it stays
 * unit-testable without pulling the 3D scene into tests.
 */
export function focusTargetFor(
  sel: Selection | null,
  positions: Record<string, readonly [number, number, number]>,
): [number, number, number] {
  if (sel?.kind === 'brainRegion' && positions[sel.id]) {
    const [x, y, z] = positions[sel.id]
    return [x, y, z]
  }
  return [0, 0, 0]
}

/** Orbit distance per region — tiny deep structures get a closer look. */
const REGION_DISTANCES: Record<string, number> = {
  hypothalamus: 5.5,
  entorhinal: 6,
  amygdala: 6,
  thalamus: 6.5,
  hippocampus: 7,
  temporal: 8,
  parietal: 8.5,
  frontal: 8.5,
}

export const DEFAULT_FOCUS_DISTANCE = 9

export function focusDistanceFor(sel: Selection | null): number {
  if (sel?.kind === 'brainRegion' && REGION_DISTANCES[sel.id] !== undefined) {
    return REGION_DISTANCES[sel.id]
  }
  return DEFAULT_FOCUS_DISTANCE
}
