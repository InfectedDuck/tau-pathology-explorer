import { describe, expect, it } from 'vitest'
import { CELL_PARTS } from './cellParts'
import { QUIZ } from './quiz'
import { REGIONS } from './regions'
import { STAGES } from './stages'
import { bucketOf, healthyCountFor, pseudo, TISSUE_COUNT } from './tissueStats'
import { TOUR } from './tour'

/**
 * Canonical-content contract. The backend (backend/main.py) mirrors these
 * verbatim — if this test changes, update the backend + its contract test too.
 */
describe('content data', () => {
  it('has 4 Braak stages in order', () => {
    expect(STAGES).toHaveLength(4)
    expect(STAGES.map((s) => s.label)).toEqual(['Healthy', 'Early', 'Middle', 'Late'])
    expect(STAGES[1].braak).toMatch(/I–II/)
  })

  it('stages carry full teaching copy', () => {
    for (const s of STAGES) {
      for (const f of ['description', 'cellular', 'tissue', 'organ'] as const) {
        expect(s[f].length, `${s.label}.${f}`).toBeGreaterThan(10)
      }
    }
  })

  it('has 8 brain regions including deep structures', () => {
    const ids = Object.keys(REGIONS)
    expect(ids).toHaveLength(8)
    for (const id of ['entorhinal', 'hippocampus', 'temporal', 'parietal', 'frontal', 'amygdala', 'thalamus', 'hypothalamus']) {
      expect(REGIONS[id], id).toBeDefined()
      expect(REGIONS[id].short.length).toBeGreaterThanOrEqual(2)
      expect(REGIONS[id].func.length).toBeGreaterThan(10)
    }
  })

  it('has 5 cell parts with full copy', () => {
    expect(Object.keys(CELL_PARTS)).toEqual(['tau', 'microtubule', 'mitochondrion', 'synapse', 'tangle'])
    for (const p of Object.values(CELL_PARTS)) {
      expect(p.role.length).toBeGreaterThan(10)
      expect(p.clinical.length).toBeGreaterThan(10)
    }
  })

  it('quiz answers are in range with stable ids', () => {
    expect(QUIZ.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5'])
    for (const q of QUIZ) {
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(q.options.length)
    }
  })

  it('quiz see-links point at real parts and stages', () => {
    for (const q of QUIZ) {
      expect([0, 1, 2, 3]).toContain(q.seeStage)
      if (q.see.kind === 'cellPart') expect(Object.keys(CELL_PARTS)).toContain(q.see.id)
      else expect(Object.keys(REGIONS)).toContain(q.see.id)
    }
  })

  it('tour steps select valid hotspots', () => {
    expect(TOUR).toHaveLength(4)
    for (const s of TOUR) {
      expect([0, 1, 2, 3]).toContain(s.stage)
      if (s.sel.kind === 'cellPart') expect(Object.keys(CELL_PARTS)).toContain(s.sel.id)
      else expect(Object.keys(REGIONS)).toContain(s.sel.id)
    }
  })
})

describe('tissueStats', () => {
  it('bucket quantizes smooth stage to quarters', () => {
    expect(bucketOf(0)).toBe(0)
    expect(bucketOf(1.13)).toBe(1.25)
    expect(bucketOf(2.9)).toBe(3)
    expect(bucketOf(2)).toBe(2)
  })

  it('pseudo is deterministic in [0,1)', () => {
    expect(pseudo(3, 9)).toBe(pseudo(3, 9))
    expect(pseudo(3, 9)).toBeGreaterThanOrEqual(0)
    expect(pseudo(3, 9)).toBeLessThan(1)
  })

  it('healthy count falls as disease progresses', () => {
    const counts = [0, 1, 2, 3].map((s) => healthyCountFor(s))
    expect(counts[0]).toBe(TISSUE_COUNT)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1])
    }
    expect(counts[3]).toBeGreaterThanOrEqual(0)
  })
})
