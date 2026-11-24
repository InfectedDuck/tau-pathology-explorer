/** Every 3D model in the app, with the credit its licence asks for. Shown in the Model credits dialog. */
export interface ModelCredit {
  what: string
  where: string
  source: string
  cite: string
  license: string
  url: string
}

export const MODEL_CREDITS: ModelCredit[] = [
  {
    what: 'CA1 pyramidal neurons (4 cells)',
    where: 'Box 1 cell view · Box 2 tissue',
    source: 'NeuroMorpho.Org IDs 147158, 147067, 147060, 147087 — DeFelipe archive. Human hippocampus, control adults, intracellular Lucifer yellow fills.',
    cite: 'Benavides-Piccione R et al. Differential structure of hippocampal CA1 pyramidal neurons in the human and mouse. Cereb Cortex 2020;30:730–752.',
    license: 'CC BY 4.0',
    url: 'https://neuromorpho.org/neuron_info.jsp?neuron_id=147158',
  },
  {
    what: 'Astrocyte',
    where: 'Box 2 tissue',
    source: 'NeuroMorpho.Org ID 189671 — Mechawar archive. Human visual cortex grey matter, vimentin immunostaining.',
    cite: 'O’Leary LA et al. Characterization of vimentin-immunoreactive astrocytes in the human brain. Front Neuroanat 2020;14:31.',
    license: 'CC BY 4.0',
    url: 'https://neuromorpho.org/neuron_info.jsp?neuron_id=189671',
  },
  {
    what: 'Microglia (2 cells)',
    where: 'Box 2 tissue',
    source: 'NeuroMorpho.Org IDs 301526, 301542 — Seney archive. Human cingulate cortex, control.',
    cite: 'Yoblinski AR et al. Brain region and sex differences in human microglia morphology and function. Cereb Cortex 2025;35:bhaf120.',
    license: 'CC BY 4.0',
    url: 'https://neuromorpho.org/neuron_info.jsp?neuron_id=301526',
  },
  {
    what: 'Tau paired helical filament',
    where: 'Box 1 molecule view',
    source: 'RCSB PDB 5O3L — cryo-EM structure from Alzheimer’s disease brain, 3.4 Å. The filament is extended with the helical symmetry measured from the entry (−1.2° twist, 4.72 Å rise per rung).',
    cite: 'Fitzpatrick AWP et al. Cryo-EM structures of tau filaments from Alzheimer’s disease. Nature 2017;547:185–190.',
    license: 'CC0 1.0',
    url: 'https://www.rcsb.org/structure/5O3L',
  },
  {
    what: 'Microtubule lattice (α/β-tubulin)',
    where: 'Box 1 molecule view',
    source: 'RCSB PDB 6DPV — undecorated GDP microtubule, 3.3 Å. Subunit surfaces come from this entry; the source tube has 14 protofilaments, so the lattice is rebuilt with the 13 found in neurons.',
    cite: 'Zhang R, LaFrance B, Nogales E. Separating the effects of nucleotide and EB binding on microtubule structure. PNAS 2018;115:E6191–E6200.',
    license: 'CC0 1.0',
    url: 'https://www.rcsb.org/structure/6DPV',
  },
  {
    what: 'Tau bound to a microtubule',
    where: 'Box 1 molecule view',
    source: 'RCSB PDB 7PQC (model 1) — tau residues 202–395 along one protofilament. Phosphate markers sit on residues 202, 205, 212, 214, 217, 231, 235, 262 and 356.',
    cite: 'Brotzakis ZF et al. A structural ensemble of a tau–microtubule complex reveals regulatory tau phosphorylation and acetylation mechanisms. ACS Cent Sci 2021;7:1986–1995.',
    license: 'CC0 1.0',
    url: 'https://www.rcsb.org/structure/7PQC',
  },
  {
    what: 'Whole-brain atlas (425 structures)',
    where: 'Box 3 brain',
    source: 'Z-Anatomy / BodyParts3D brain atlas via the brainproject repository. Split here into a core file and an optional vessels / tracts / nerves file; meshes otherwise unchanged.',
    cite: '© Z-Anatomy contributors and BodyParts3D, Database Center for Life Science (DBCLS).',
    license: 'CC BY-SA 4.0',
    url: 'https://github.com/itayinbarr/brainproject',
  },
]

export const NEUROMORPHO_CITE =
  'NeuroMorpho.Org (RRID:SCR_002145). Tecuatl C, Ljungquist B, Ascoli GA. Accelerating the continuous community sharing of digital neuromorphology data. FASEB BioAdv 2024;6:207–221.'
