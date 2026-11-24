import type { BoxId, NeuronLevel, Selection } from '../store/useAppStore'

/** One colour per part, used by meshes, chips and callouts alike (Okabe-Ito based, colour-blind safe). */
export const PART_COLOR: Record<string, string> = {
  soma: '#a5f3e5',
  dendrite: '#2dd4bf',
  spine: '#d9f99d',
  axon: '#7aa8ff',
  tangle: '#ff7a1a',
  microtubule: '#a5f3fc',
  tau: '#2dd4bf',
  motor: '#fde68a',
  mitochondrion: '#f9a8d4',
  synapse: '#7dd3fc',
  tubulin: '#8bd3f0',
  phosphate: '#ffd166',
  phf: '#ff7a1a',
  neuron: '#2dd4bf',
  astrocyte: '#c4a1f5',
  microglia: '#f0e442',
}

/** Parts visible at each zoom level of the neuron box, in display order. */
export const LEVEL_PARTS: Record<NeuronLevel, string[]> = {
  cell: ['soma', 'dendrite', 'spine', 'axon', 'tangle'],
  axon: ['microtubule', 'tau', 'motor', 'mitochondrion', 'synapse'],
  molecule: ['tubulin', 'tau', 'phosphate', 'phf'],
}

export const TISSUE_PARTS = ['neuron', 'astrocyte', 'microglia', 'tangle', 'synapse']

export const NEURON_LEVELS: NeuronLevel[] = ['cell', 'axon', 'molecule']

/** Level a part is best seen at. Stays on `current` when the part exists there. */
export function levelForPart(id: string, current: NeuronLevel): NeuronLevel | null {
  if (LEVEL_PARTS[current].includes(id)) return current
  // tau is introduced riding the microtubules, so prefer the axon view
  if (id === 'tau') return 'axon'
  return NEURON_LEVELS.find((l) => LEVEL_PARTS[l].includes(id)) ?? null
}

/** Which box shows a selection. Stays on `current` when the part exists there. */
export function boxForSelection(sel: Selection, current: BoxId, level: NeuronLevel): BoxId {
  if (sel.kind === 'brainRegion') return 'brain'
  const inTissue = TISSUE_PARTS.includes(sel.id)
  const inNeuron = NEURON_LEVELS.some((l) => LEVEL_PARTS[l].includes(sel.id))
  if (current === 'tissue' && inTissue) return 'tissue'
  if (current === 'neuron' && LEVEL_PARTS[level].includes(sel.id)) return 'neuron'
  if (inNeuron) return 'neuron'
  if (inTissue) return 'tissue'
  return current
}
