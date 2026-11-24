export interface CellPartInfo {
  id: string
  name: string
  /** compact label for chips and in-scene callouts */
  short: string
  role: string
  wrong: string
  clinical: string
}

export const CELL_PARTS: Record<string, CellPartInfo> = {
  tau: {
    id: 'tau',
    name: 'Tau protein',
    short: 'Tau',
    role: 'Normally binds and stabilizes microtubule tracks in the axon, like railroad ties keeping rails straight.',
    wrong: 'Hyperphosphorylation makes tau detach, misfold, and clump into paired helical filaments that aggregate.',
    clinical: 'CSF p-tau is a core Alzheimer biomarker. Detachment is the first step toward tangles.',
  },
  microtubule: {
    id: 'microtubule',
    name: 'Microtubule',
    short: 'Microtubules',
    role: 'Parallel hollow tubes that serve as highways for kinesin/dynein motors carrying vesicles and mitochondria.',
    wrong: 'Without tau, microtubules fragment and depolymerize. Tracks break, cargo stalls, axon starves.',
    clinical: 'Transport failure explains early synaptic dysfunction before cell death.',
  },
  mitochondrion: {
    id: 'mitochondrion',
    name: 'Mitochondrion',
    short: 'Mitochondria',
    role: 'Travels along microtubules to synapses to supply ATP and buffer calcium for firing.',
    wrong: 'When transport stops, synapses run out of energy, calcium handling fails, terminals fade.',
    clinical: 'FDG-PET hypometabolism reflects this energy failure in patients.',
  },
  synapse: {
    id: 'synapse',
    name: 'Synapse',
    short: 'Synapse',
    role: 'Axon terminal communicates to dendrites. Vesicles release neurotransmitter for memory encoding.',
    wrong: 'Tau seeds can cross the synapse prion-like to seed misfolding in the next neuron. Terminals retract.',
    clinical: 'Synapse loss correlates best with cognitive decline — more than plaques.',
  },
  tangle: {
    id: 'tangle',
    name: 'Neurofibrillary tangle',
    short: 'Tangle',
    role: 'No normal role — pathological bundle of hyperphosphorylated tau filaments filling the soma.',
    wrong: 'Tangles choke the soma, displace organelles, trigger inflammation and eventually ghost tangles after death.',
    clinical: 'Tangle burden + Braak stage tracks dementia severity. Ghost tangles persist extracellularly.',
  },
  soma: {
    id: 'soma',
    name: 'Cell body (soma)',
    short: 'Cell body',
    role: 'Houses the nucleus and the protein-making machinery, and sums the signals arriving from the dendrites.',
    wrong: 'Misfolded tau leaves the axon and piles up here and in the dendrites. Filaments crowd the cytoplasm and push the nucleus aside.',
    clinical: 'Flame-shaped tangles inside pyramidal cell bodies are what a neuropathologist counts to assign a Braak stage.',
  },
  dendrite: {
    id: 'dendrite',
    name: 'Dendrites',
    short: 'Dendrites',
    role: 'Branching input cables. A CA1 pyramidal neuron has a tall apical tree and a skirt of basal dendrites that collect thousands of synaptic inputs.',
    wrong: 'Tau invades the dendrites, transport fails and branches retract from the tips inward, so the tree shrinks and loses inputs.',
    clinical: 'Dendritic simplification disconnects the hippocampal memory circuit long before the neuron itself dies.',
  },
  spine: {
    id: 'spine',
    name: 'Dendritic spines',
    short: 'Spines',
    role: 'Tiny protrusions about 1 µm long, each hosting one excitatory synapse. They grow and shrink as memories form.',
    wrong: 'Mislocalised tau disturbs receptor trafficking at the spine. Spines thin out and disappear.',
    clinical: 'Spine and synapse loss is the structural change that tracks memory decline most closely.',
  },
  axon: {
    id: 'axon',
    name: 'Axon',
    short: 'Axon',
    role: 'The single output cable. Tau is normally concentrated here, where it keeps the microtubule tracks stable for long-distance transport.',
    wrong: 'When tau lets go, tracks destabilise, cargo stalls and the axon degenerates from its far end back toward the cell body.',
    clinical: 'Axonal injury releases neurofilament light (NfL), a blood marker of ongoing neurodegeneration.',
  },
  motor: {
    id: 'motor',
    name: 'Motor proteins and cargo',
    short: 'Motors + cargo',
    role: 'Kinesin walks cargo toward the synapse and dynein carries it back, stepping along microtubules and burning ATP.',
    wrong: 'Detached tau and broken tracks leave the motors nowhere to walk. Vesicles pile up in traffic jams.',
    clinical: 'Axonal swellings packed with stalled cargo are an early finding in Alzheimer tissue and in mouse models.',
  },
  tubulin: {
    id: 'tubulin',
    name: 'Tubulin lattice',
    short: 'Tubulin',
    role: 'α- and β-tubulin pair into dimers that stack into 13 protofilaments, forming a hollow tube 25 nm across.',
    wrong: 'Without tau holding the lattice together, protofilaments peel apart at the ends and the tube shortens.',
    clinical: 'Microtubule-stabilising drugs have been tested as a way to compensate for lost tau function.',
  },
  phosphate: {
    id: 'phosphate',
    name: 'Phosphorylation sites',
    short: 'Phosphates',
    role: 'Kinases and phosphatases add and remove a few phosphate groups to tune how tightly tau grips the microtubule.',
    wrong: 'In Alzheimer’s, tau carries roughly three to four times more phosphate than normal. The extra negative charge pushes it off the microtubule.',
    clinical: 'Tau phosphorylated at threonine 181 or 217 (p-tau181, p-tau217) is measured in CSF and blood to detect Alzheimer pathology.',
  },
  phf: {
    id: 'phf',
    name: 'Paired helical filament',
    short: 'Tau filament',
    role: 'No normal role. Two protofilaments of misfolded tau twist around each other; each molecule is folded into a C shape and stacked 0.47 nm from the next.',
    wrong: 'The filament end acts as a template. Free tau adopts the same fold and adds on, so filaments lengthen and bundle into tangles.',
    clinical: 'Tau PET tracers such as flortaucipir bind these filaments, so tangle spread can be imaged in living patients.',
  },
  neuron: {
    id: 'neuron',
    name: 'Pyramidal neuron',
    short: 'Neurons',
    role: 'The principal excitatory cell of hippocampus and cortex. Cell bodies line up in a layer with their apical dendrites running in parallel.',
    wrong: 'Tangle-bearing neurons lose dendrites and synapses, then die, leaving gaps in the layer.',
    clinical: 'Neuron loss in CA1 and entorhinal cortex parallels the severity of memory impairment.',
  },
  astrocyte: {
    id: 'astrocyte',
    name: 'Astrocyte',
    short: 'Astrocytes',
    role: 'Star-shaped support cell. Its fine processes wrap synapses, recycle neurotransmitter and feed neurons.',
    wrong: 'Near damage, astrocytes turn reactive: processes thicken, GFAP rises and normal support functions falter.',
    clinical: 'Plasma GFAP rises early in Alzheimer’s and is used as a marker of astrocyte reactivity.',
  },
  microglia: {
    id: 'microglia',
    name: 'Microglia',
    short: 'Microglia',
    role: 'Resident immune cells. Thin, constantly moving branches survey the tissue for damage.',
    wrong: 'They pull in their branches, swell and cluster around tangle-bearing neurons. Chronic activation releases inflammatory signals and can help tau spread.',
    clinical: 'Risk genes such as TREM2 act in microglia, linking the immune response to Alzheimer risk.',
  },
}
