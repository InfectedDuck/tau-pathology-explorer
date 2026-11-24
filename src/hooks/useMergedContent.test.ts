import { describe, expect, it } from 'vitest'
import { CELL_PARTS } from '../data/cellParts'
import { REGIONS } from '../data/regions'
import { STAGES } from '../data/stages'
import { applyOverrides } from './useMergedContent'

describe('applyOverrides', () => {
  it('returns defaults with empty overrides', () => {
    const { mergedStages } = applyOverrides(STAGES, REGIONS, CELL_PARTS, {})
    expect(mergedStages[0].cellular).toBe(STAGES[0].cellular)
  })
  it('overrides stage caption', () => {
    const { mergedStages } = applyOverrides(STAGES, REGIONS, CELL_PARTS, { 'stage:1:cellular': 'custom early' })
    expect(mergedStages[1].cellular).toBe('custom early')
    expect(mergedStages[0].cellular).toBe(STAGES[0].cellular)
  })
  it('overrides region symptom', () => {
    const { mergedRegions } = applyOverrides(STAGES, REGIONS, CELL_PARTS, { 'region:hippocampus:symptom': 'custom symptom' })
    expect(mergedRegions.hippocampus.symptom).toBe('custom symptom')
  })
})
