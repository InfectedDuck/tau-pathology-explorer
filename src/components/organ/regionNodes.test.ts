import { describe, expect, it } from 'vitest'
import manifest from '../../../public/models/brain-atlas/manifest.json'
import { REGION_NODES } from './regionNodes'

interface ManifestNode {
  id: number
  label: string
  category: string
  ta2: string[]
}

const NODES = (manifest as { nodes: ManifestNode[] }).nodes
const byId = new Map(NODES.map((n) => [n.id, n]))

/** Contract: every mapped node exists in the real atlas manifest. */
describe('REGION_NODES vs brain-atlas manifest', () => {
  it('covers all 8 teaching regions with 120 unique nodes', () => {
    expect(Object.keys(REGION_NODES).sort()).toEqual(
      ['amygdala', 'entorhinal', 'frontal', 'hippocampus', 'hypothalamus', 'parietal', 'temporal', 'thalamus'].sort(),
    )
    const all = Object.values(REGION_NODES).flat()
    expect(all).toHaveLength(120)
    expect(new Set(all).size).toBe(120)
    for (const id of all) {
      expect(byId.has(id), `node ${id} missing from manifest`).toBe(true)
    }
  })

  it('deep structures map to real anatomy, not cortex', () => {
    for (const id of REGION_NODES.hippocampus) {
      expect(byId.get(id)?.label).toBe('Hippocampus')
    }
    for (const id of REGION_NODES.amygdala) {
      expect(byId.get(id)?.category).toBe('deep_grey')
    }
    for (const id of [...REGION_NODES.thalamus, ...REGION_NODES.hypothalamus]) {
      expect(byId.get(id)?.category).toBe('diencephalon')
    }
    for (const id of REGION_NODES.entorhinal) {
      expect(byId.get(id)?.label).toContain('Parahippocampal')
    }
  })

  it('cortical lobes follow TA2 lobe paths and exclude the entorhinal nodes', () => {
    const ta2Has = (id: number, s: string) => (byId.get(id)?.ta2 ?? []).some((seg) => seg.toLowerCase().includes(s))
    for (const id of REGION_NODES.frontal) expect(ta2Has(id, 'frontal lobe')).toBe(true)
    for (const id of REGION_NODES.temporal) expect(ta2Has(id, 'temporal lobe')).toBe(true)
    for (const id of REGION_NODES.parietal) {
      const ta2 = (byId.get(id)?.ta2 ?? []).join(' ').toLowerCase()
      expect(ta2.includes('parietal lobe') || ta2.includes('inferior parietal')).toBe(true)
    }
    for (const id of REGION_NODES.entorhinal) {
      expect(REGION_NODES.temporal).not.toContain(id)
    }
  })
})
