import { describe, expect, it } from 'vitest'
import { DEFAULT_FOCUS_DISTANCE, focusDistanceFor, focusTargetFor } from './focusTarget'

const POS = {
  frontal: [1.15, 0.75, 0.55],
  hippocampus: [-0.1, -0.35, 0.15],
} as const

describe('focusTargetFor', () => {
  it('returns the region position for brain-region selections', () => {
    expect(focusTargetFor({ kind: 'brainRegion', id: 'hippocampus' }, POS)).toEqual([-0.1, -0.35, 0.15])
  })
  it('returns origin for cell parts, unknown ids, and null', () => {
    expect(focusTargetFor({ kind: 'cellPart', id: 'tau' }, POS)).toEqual([0, 0, 0])
    expect(focusTargetFor({ kind: 'brainRegion', id: 'nope' }, POS)).toEqual([0, 0, 0])
    expect(focusTargetFor(null, POS)).toEqual([0, 0, 0])
  })
})

describe('focusDistanceFor', () => {
  it('moves closer for tiny deep structures than for whole lobes', () => {
    const hypo = focusDistanceFor({ kind: 'brainRegion', id: 'hypothalamus' })
    const frontal = focusDistanceFor({ kind: 'brainRegion', id: 'frontal' })
    expect(hypo).toBeLessThan(frontal)
    expect(hypo).toBeGreaterThanOrEqual(4)
    expect(frontal).toBeLessThanOrEqual(18)
  })
  it('returns the default distance for cell parts, unknown ids, and null', () => {
    expect(focusDistanceFor({ kind: 'cellPart', id: 'tau' })).toBe(DEFAULT_FOCUS_DISTANCE)
    expect(focusDistanceFor({ kind: 'brainRegion', id: 'nope' })).toBe(DEFAULT_FOCUS_DISTANCE)
    expect(focusDistanceFor(null)).toBe(DEFAULT_FOCUS_DISTANCE)
  })
})
