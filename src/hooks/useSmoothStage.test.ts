import { describe, expect, it } from 'vitest'
import { lerp4 } from './useSmoothStage'

describe('lerp4', () => {
  it('returns exact stops', () => {
    expect(lerp4([1, 2, 3, 4], 0)).toBeCloseTo(1)
    expect(lerp4([1, 2, 3, 4], 1)).toBeCloseTo(2)
    expect(lerp4([1, 2, 3, 4], 2)).toBeCloseTo(3)
    expect(lerp4([1, 2, 3, 4], 3)).toBeCloseTo(4)
  })
  it('interpolates halfway', () => {
    expect(lerp4([0, 10, 20, 30], 0.5)).toBeCloseTo(5)
    expect(lerp4([1, 1, 0.92, 0.82], 2.5)).toBeCloseTo(0.87, 2)
  })
  it('clamps out of range', () => {
    expect(lerp4([1, 2, 3, 4], -5)).toBeCloseTo(1)
    expect(lerp4([1, 2, 3, 4], 99)).toBeCloseTo(4)
  })
})
