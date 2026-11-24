export interface CellPartInfo {
  id: string
  name: string
  role: string
  wrong: string
  clinical: string
}

export const CELL_PARTS: Record<string, CellPartInfo> = {
  tau: {
    id: 'tau',
    name: 'Tau protein',
    role: 'Normally binds and stabilizes microtubule tracks in the axon, like railroad ties keeping rails straight.',
    wrong: 'Hyperphosphorylation makes tau detach, misfold, and clump into paired helical filaments that aggregate.',
    clinical: 'CSF p-tau is a core Alzheimer biomarker. Detachment is the first step toward tangles.',
  },
  microtubule: {
    id: 'microtubule',
    name: 'Microtubule',
    role: 'Parallel hollow tubes that serve as highways for kinesin/dynein motors carrying vesicles and mitochondria.',
    wrong: 'Without tau, microtubules fragment and depolymerize. Tracks break, cargo stalls, axon starves.',
    clinical: 'Transport failure explains early synaptic dysfunction before cell death.',
  },
  mitochondrion: {
    id: 'mitochondrion',
    name: 'Mitochondrion',
    role: 'Travels along microtubules to synapses to supply ATP and buffer calcium for firing.',
    wrong: 'When transport stops, synapses run out of energy, calcium handling fails, terminals fade.',
    clinical: 'FDG-PET hypometabolism reflects this energy failure in patients.',
  },
  synapse: {
    id: 'synapse',
    name: 'Synapse',
    role: 'Axon terminal communicates to dendrites. Vesicles release neurotransmitter for memory encoding.',
    wrong: 'Tau seeds can cross the synapse prion-like to seed misfolding in the next neuron. Terminals retract.',
    clinical: 'Synapse loss correlates best with cognitive decline — more than plaques.',
  },
  tangle: {
    id: 'tangle',
    name: 'Neurofibrillary tangle',
    role: 'No normal role — pathological bundle of hyperphosphorylated tau filaments filling the soma.',
    wrong: 'Tangles choke the soma, displace organelles, trigger inflammation and eventually ghost tangles after death.',
    clinical: 'Tangle burden + Braak stage tracks dementia severity. Ghost tangles persist extracellularly.',
  },
}
