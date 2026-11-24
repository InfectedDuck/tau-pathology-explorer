import { describe, expect, it } from 'vitest'
import { glossParts } from './glossary'

describe('glossParts', () => {
  it('wraps known terms and leaves the rest plain', () => {
    const parts = glossParts('Tau stabilizes microtubule tracks.', 'en')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toEqual({ term: 'Tau', def: expect.stringContaining('stabilizes') })
    expect(parts[1]).toBe(' stabilizes ')
    expect(parts[2]).toEqual({ term: 'microtubule', def: expect.stringContaining('cargo') })
    expect(parts[3]).toBe(' tracks.')
  })

  it('prefers the longest match on overlap', () => {
    const parts = glossParts('A neurofibrillary tangle fills the soma.', 'en')
    const terms = parts.filter((p) => typeof p !== 'string')
    expect(terms).toHaveLength(1)
    expect(terms[0]).toEqual({ term: 'neurofibrillary tangle', def: expect.any(String) })
  })

  it('matches case-insensitively and keeps original casing', () => {
    const parts = glossParts('The HIPPOCAMPUS shrinks.', 'en')
    expect(parts).toContainEqual({ term: 'HIPPOCAMPUS', def: expect.stringContaining('memories') })
  })

  it('supports Turkish terms', () => {
    const parts = glossParts('Tau mikrotübül raylarına bağlanır.', 'tr')
    expect(parts).toContainEqual({ term: 'Tau', def: expect.any(String) })
    expect(parts).toContainEqual({ term: 'mikrotübül', def: expect.any(String) })
  })

  it('returns plain text untouched when nothing matches', () => {
    expect(glossParts('Dense network, calm glia.', 'en')).toEqual(['Dense network, calm glia.'])
    expect(glossParts('', 'en')).toEqual([''])
  })
})
