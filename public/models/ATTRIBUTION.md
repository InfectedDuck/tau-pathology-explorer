# 3D model attribution

Every model the app loads, where it came from, and the licence it carries.
The same credits are shown in the app under **Menu → Model credits**.
The app's own code does not relicense any of these files.

Cell shapes and protein structures are research data. How they are arranged,
coloured and animated through the disease stages is a teaching model.

## Cells — `cells/*.json`

Branch trees converted from SWC reconstructions on
[NeuroMorpho.Org](https://neuromorpho.org) (RRID:SCR_002145), licensed
**CC BY 4.0**. The app builds tube meshes from them at runtime.

| File | NeuroMorpho ID | What | Original paper |
| --- | --- | --- | --- |
| `ca1-hero.json` | [147158](https://neuromorpho.org/neuron_info.jsp?neuron_id=147158) | Human hippocampal CA1 pyramidal neuron (Box 1) | Benavides-Piccione et al. 2020 |
| `ca1-a.json` | [147067](https://neuromorpho.org/neuron_info.jsp?neuron_id=147067) | Human CA1 pyramidal neuron (Box 2) | Benavides-Piccione et al. 2020 |
| `ca1-b.json` | [147060](https://neuromorpho.org/neuron_info.jsp?neuron_id=147060) | Human CA1 pyramidal neuron (Box 2) | Benavides-Piccione et al. 2020 |
| `ca1-c.json` | [147087](https://neuromorpho.org/neuron_info.jsp?neuron_id=147087) | Human CA1 pyramidal neuron (Box 2) | Benavides-Piccione et al. 2020 |
| `astrocyte.json` | [189671](https://neuromorpho.org/neuron_info.jsp?neuron_id=189671) | Human cortical astrocyte (Box 2) | O'Leary et al. 2020 |
| `microglia-a.json` | [301526](https://neuromorpho.org/neuron_info.jsp?neuron_id=301526) | Human cortical microglia (Box 2) | Yoblinski et al. 2025 |
| `microglia-b.json` | [301542](https://neuromorpho.org/neuron_info.jsp?neuron_id=301542) | Human cortical microglia (Box 2) | Yoblinski et al. 2025 |

Citations:

- Benavides-Piccione R, Regalado-Reyes M, Fernaud-Espinosa I, et al.
  Differential structure of hippocampal CA1 pyramidal neurons in the human and
  mouse. *Cereb Cortex* 2020;30:730–752. doi:10.1093/cercor/bhz122
- O'Leary LA, Davoli MA, Belliveau C, et al. Characterization of
  vimentin-immunoreactive astrocytes in the human brain. *Front Neuroanat*
  2020;14:31. doi:10.3389/fnana.2020.00031
- Yoblinski AR, Dubey J, Myers T, et al. Brain region and sex differences in
  human microglia morphology and function. *Cereb Cortex* 2025;35:bhaf120.
  doi:10.1093/cercor/bhaf120
- Tecuatl C, Ljungquist B, Ascoli GA. Accelerating the continuous community
  sharing of digital neuromorphology data. *FASEB BioAdv* 2024;6:207–221.
  doi:10.1096/fba.2024-00048

Changes made: multi-point somata collapsed to one point; cells re-centred on
the soma and rotated so the apical dendrite points up; each unbranched section
simplified (Ramer–Douglas–Peucker, 0.2–1.4 µm tolerance); coordinates stored
at 0.1 µm precision. In the app, thin branches are drawn at a minimum
on-screen width and trunks are flared slightly where they meet the cell body.
The CA1 axons end where they left the tissue slice.

## Molecules — `molecules/tubulin.glb`, `molecules/molecules.json`

Derived from [RCSB Protein Data Bank](https://www.rcsb.org) entries, which
are in the public domain (**CC0 1.0**).

| PDB | Used for | Original paper |
| --- | --- | --- |
| [5O3L](https://www.rcsb.org/structure/5O3L) | Paired helical filament of tau from Alzheimer's disease brain | Fitzpatrick et al. *Nature* 2017;547:185–190. doi:10.1038/nature23002 |
| [6DPV](https://www.rcsb.org/structure/6DPV) | α/β-tubulin subunits and microtubule lattice | Zhang, LaFrance & Nogales. *PNAS* 2018;115:E6191–E6200. doi:10.1073/pnas.1802637115 |
| [7PQC](https://www.rcsb.org/structure/7PQC) | Tau (residues 202–395) bound along a protofilament | Brotzakis et al. *ACS Cent Sci* 2021;7:1986–1995. doi:10.1021/acscentsci.1c00585 |

What was computed from them:

- **Tubulin**: Gaussian molecular surfaces of one α and one β monomer (chains
  A and B of 6DPV) at two levels of detail.
- **Microtubule lattice**: lateral and longitudinal spacing measured by
  superposing neighbouring chains in 6DPV. That entry is a 14-protofilament
  tube; the app rebuilds the 13-protofilament, 3-start lattice found in
  neurons from the same subunits.
- **Tau on the microtubule**: C-alpha trace of chain O, model 1 of 7PQC, drawn
  as a tube. Phosphate markers sit on residues 202, 205, 212, 214, 217, 231,
  235, 262 and 356.
- **Paired helical filament**: C-alpha traces of one rung (chains A and B of
  5O3L). The filament is extended with the helical symmetry measured from the
  entry: −1.20° twist and 4.72 Å rise per rung, a crossover of about 71 nm.

## Brain — `brain-atlas/brain-core.glb`, `brain-atlas/brain-extras.glb`

- Source: the `itayinbarr/brainproject` brain atlas, derived from Z-Anatomy
  and BodyParts3D — https://github.com/itayinbarr/brainproject
- Licence: **CC BY-SA 4.0**. © Z-Anatomy contributors and BodyParts3D,
  Database Center for Life Science (DBCLS). Share-alike: these two files stay
  under CC BY-SA 4.0.
- Changes made: the 437-structure atlas was split into a core file (cortex,
  deep grey matter, diencephalon, ventricles, cerebellum, brainstem — 262
  structures) and an extras file loaded on demand (arteries, veins, fibre
  tracts, cranial nerves — 163 structures). Meninges and the white-matter
  volume were left out. Cerebellum, brainstem, vessels, nerves and tracts were
  simplified to 30–70% of their triangles. Other meshes are unchanged.
- `brain-atlas/manifest.json` lists the original structure names and is used
  by the tests.

## Rebuilding the files

```bash
python scripts/build_models.py            # cells + molecules (needs numpy)
node scripts/split_brain_atlas.mjs models-src/brain-atlas-full.glb public/models/brain-atlas
```

Source files are cached in `models-src/` (not deployed). Earlier models that
the app no longer loads are kept in `models-src/legacy/`.
