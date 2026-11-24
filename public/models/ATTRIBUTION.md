# 3D model attribution

## `brain-atlas/brain.glb` + `manifest.json` (Box 3 — Whole brain, live)

- Source: `itayinbarr/brainproject` brain atlas, derived from Z-Anatomy / BodyParts3D —
  https://github.com/itayinbarr/brainproject
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  © Z-Anatomy contributors and BodyParts3D / DBCLS. Share-alike: keep this notice
  with the model; the app's own code license does not relicense the mesh.
- This file: 437 named anatomical meshes (cortex gyri, thalamic nuclei, hypothalamus
  zones, amygdala groups, hippocampi, ventricles, cerebellum, brainstem…), vendored
  verbatim for offline-first use. Region selection reads the GLB `bx_id` extras
  matched against the manifest; only vessels/nerves/tracts/meninges/white-matter
  stay hidden. Required credit is shown in the app footer.
- Replaces the previous `brain.glb` (BodyParts3D subset), which is no longer loaded
  by the app but kept in `public/models/` for reference.

## `neuron-pk.glb` (Box 2 — tissue cells, Box 1 — neighbor neuron)

- Source: NIH 3D Print Exchange, entry 3DPX-000786 "Cerebellum - Santiago Ramón y Cajal
  Exhibit", Purkinje neuron part by Biovisualization LLC —
  https://3d.nih.gov/entries/3DPX-000786 (output file `11322-Purkinje-neuron-part1_NIH3D.glb`)
- License: Creative Commons Attribution-ShareAlike (CC-BY-SA). Credit the Cajal
  Institute / Biovisualization LLC as the entry requires; required credit is shown
  in the app footer.
- This file: real scan-derived Purkinje cell mesh (~19k triangles), vendored verbatim.
  Box 2 instances it 48× in a single draw call (Eco mode keeps the procedural proxy).
  Box 1 shows it faintly as the neighbor neuron receiving the tau seed.

## `neuron-nih.glb` (Box 1 — hero neuron body)

- Source: NIH 3D Print Exchange, entry 3DPX-015796 "Neuron" by destacados tv —
  https://3d.nih.gov/entries/3DPX-015796
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC-BY-NC-SA 4.0).
  NonCommercial: fine for this educational app, but the mesh (and this app's distribution
  with it) is not cleared for commercial reuse. ShareAlike: keep this credit + license
  note if you remix or redistribute the mesh.
- This file: NIH workflow GLB output (2,885,524 bytes), vendored here verbatim via the
  `cell-architecture-studio` project's mirror for offline-first use.
- Modifications in this app: none to the mesh itself. Rendered with a neutral teaching
  tint; tau/microtubule/transport overlays (Box 1) and per-cell state colors (Box 2)
  are app overlays. Box 2 renders 48 GPU-instanced copies in a single draw call.
- Required credit is shown in the app footer ("Neuron mesh: destacados tv via NIH 3D, CC-BY-NC-SA 4.0").

## Recommended higher-quality drop-in upgrades (researched Nov 2026, not vendored yet)

All are free for education and keep the app's offline-first pattern: download once,
drop into `public/models/`, the viewers auto-use them with procedural fallback.

### Brain / deep structures (replaces sphere hotspots)

1. **HRA brain female/male v1.3 — 141 structures, CC-BY 4.0 (best pick)**
   - `3DPX-020959` (female) / `3DPX-020960` (male), HRA / Allen atlas, mirrored whole brain.
   - https://3d.nih.gov/entries/20959 — `hra-reference-organ-brain-female-v1.3.glb`
   - Why: single GLB, commercial-safe CC-BY, includes hypothalamus + thalamus +
     amygdala + hippocampus + ventricles as named nodes. Ideal `brain-hra.glb`.
2. **Subcortical set — hippocampus + amygdala + thalamus + striatum + brainstem, CC-BY-NC-SA**
   - `3DPX-001944` by Roman Kessler (FSL FIRST segmentation of T1 MRI).
   - https://3d.nih.gov/entries/3DPX-001944
   - Why: exactly the deep parts this app teaches (incl. hypothalamus neighbours).
     Split per-structure or load whole `subcortical.glb` as overlay.
3. **PittBrains3D subcortical forebrain STLs — thalamus / striatum / hippocampus+amygdala / ventricles, CC-BY**
   - MNI152-average based teaching models, GitHub STL set.
   - https://oercommons.org/courseware/lesson/123307/overview
   - Why: clean, low-poly, permissive license; convert STL → GLB once.
4. **BodyParts3D full-res 4.3 — thalamus / hypothalamus / amygdala / insula as single OBJs**
   - `body_parts_3d_api` (3,210 meshes, `brain` group = 64 meshes) + official archive
     `isa_BP3D_4.0_obj_99.zip`.
   - Why: same source family as current `brain.glb`, so style matches; pick
     FJ hypothalamus + thalamus + amygdala elements and merge into `brain-deep.glb`.
   - Sketchfab/AnatomyTOOL mirrors show the limbic assembly working:
     limbic system (hippocampus + hypothalamus + mammillary + pituitary),
     internal brain structures (hippocampus + amygdala + ventricles).
5. **Detailed Human Brain Model 3DPX-021161 — CC-BY**
   - https://3d.nih.gov/entries/3DPX-021161 — dense display mesh for hero view.

### Cell / synapse (replaces any remaining procedural blobs)

6. **Enlarged synapse model — CC0 (free, no attribution needed)**
   - Innerscene 3D Parts Library: `enlarged-synapse-model.glb`.
   - https://www.innerscene.com/tools/library/3d-parts/enlarged-synapse-model-49ebf432
   - Why: presynaptic terminal + vesicles + cleft + postsynaptic receptors as one
     GLB. Ideal `synapse-cc0.glb` for Box 1 terminals.
7. **Neuron cell-body anatomy — check license before vendoring**
   - embodi3D `3D Model of Neuron Cell Body Anatomy` / `3D Model of Synapse`
     (GLB+USDZ+STL, paid). Preview-quality only; prefer NIH/CC0 above unless
     the licence is cleared.

### How to wire a new GLB in (no code change needed for the first two)

- `public/models/brain-hra.glb` → set `BRAIN_URL` in `OrganView.tsx`
  (region nodes matched by name: hippocampus / amygdala / thalamus / hypothalamus).
- `public/models/subcortical.glb` → deep-structure overlay (already supported by
  the `BrainModelBoundary` + organic-fallback pattern).
- `public/models/synapse-cc0.glb` → bouton overlay in `CellularView.tsx`.

Application code under its own license does not relicense the models.
