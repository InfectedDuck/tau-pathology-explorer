# Tau Pathology Explorer

**Live:** https://tau-pathology-explorer.vercel.app

A project by **Erzhanuly Nursultan** and **Kelsingazin Alikhan**, **Semey Medical
University** (Semey, Kazakhstan), 2026. Website by Toktar Kametay.

Interactive 3D teaching app: how tau tangles disrupt a neuron, the tissue
around it and the whole brain in Alzheimer's disease. Three boxes show three
scales, and one timeline (Braak 0 → V–VI) drives all of them.

## What you see

| Box | Scale | Models |
| --- | --- | --- |
| 01 Neuron | Three zoom levels: whole cell (µm) → inside the axon (nm) → molecules (Å) | A real human CA1 pyramidal neuron; a to-scale axon and synapse cutaway; the microtubule lattice, tau on the microtubule and the Alzheimer tau filament built from cryo-EM structures |
| 02 Tissue | A slab of hippocampal CA1 | 48 neurons from three real reconstructions, plus real astrocyte and microglia shapes |
| 03 Brain | Whole brain | 262-structure anatomical atlas, with optional vessels, fibre tracts and cranial nerves |

Model sources and licences are listed in the app (Menu → Model credits) and in
[public/models/ATTRIBUTION.md](public/models/ATTRIBUTION.md).

## Using the viewer

- Drag to rotate, scroll or pinch to zoom, right-drag or two fingers to pan,
  double-click or double-tap to zoom to a point.
- Every box has a row of part chips and labels pinned to the model. Tap one
  to fly the camera there and open its explainer.
- Tools on the right edge of each box: zoom in/out, reset, labels, layers,
  save image, expand.
- Box 1 has a Cell / Axon / Molecules switch. Box 3 has Cutaway / Glass /
  Surface views and a layers menu.
- The explainer offers the next zoom step where there is one (brain → tissue →
  neuron → axon → molecules).
- Phones show one box at a time with tabs; wide screens show all three.
- Keys: `1`–`4` stage, `Space` play/pause, `C` compare with healthy, `Esc`
  close.

Also included: guided tour, five-question quiz with "See in 3D" links,
compare-with-healthy split view, English and Turkish, dark and light themes,
glossary tooltips, storyboard export, caption editor, references, shareable
URLs (`?stage=2&box=brain&view=glass&sel=brainRegion:hippocampus`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview
```

Requires Node 22 or newer.

## Tests and lint

```bash
npm run test     # vitest
npm run lint     # oxlint
cd backend && python -m pytest tests/ -q
```

`.github/workflows/ci.yml` runs all of these plus the build.

## Deploy

### Vercel

The repository is ready for Vercel: `vercel.json` sets the build command,
output directory and cache headers, and `.vercelignore` keeps the backend and
model sources out of the upload.

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

The folder is linked to the Vercel project `tau-pathology-explorer`; `npx vercel
--prod` publishes the current source to the live URL above.

The site is static and needs no environment variables.

### Docker

```bash
docker build -f Dockerfile.frontend -t tau-explorer .
docker run -p 8080:80 tau-explorer
```

The image serves `nginx.conf` with an SPA fallback. `docker compose --profile
prod up --build` starts the frontend together with the optional API.

## Optional backend

The app works without a server. A small FastAPI service can store shared
caption edits, quiz attempts and progress:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Point the frontend at it with `VITE_API_URL=http://localhost:8000` (copy
`.env.example` to `.env`), or at container start with
`docker run -e VITE_API_URL=…`.

Endpoints: `/health`, `/api/stages`, `/api/regions`, `/api/cell-parts`,
`/api/quiz`, `/api/progress`, `/api/quiz-attempts`, `/api/content`.
`src/data/*` is the canonical content; `backend/main.py` mirrors it and the
contract tests on both sides catch drift.

## Project layout

```
src/
  components/
    viewer/     the box: 3D stage, camera rig, part labels, tools
    neuron/     Box 1 — cell, axon and molecule scenes
    tissue/     Box 2
    brain/      Box 3
    ui/         header, timeline, explainer, tour, quiz, dialogs
  lib/          branch-tree → tube meshes, materials, molecule helpers
  data/         stages, regions, parts, quiz, tour, credits
  i18n/         English and Turkish
public/models/  the 3D assets the app loads (see ATTRIBUTION.md)
scripts/        builds public/models from the sources in models-src/
backend/        optional FastAPI service
```

## Rebuilding the 3D assets

```bash
python scripts/build_models.py
node scripts/split_brain_atlas.mjs models-src/brain-atlas-full.glb public/models/brain-atlas
```

The first needs Python 3.10+ and numpy and downloads its inputs from
NeuroMorpho.Org and the RCSB PDB on first run. The second needs the packages
named at the top of the script.

## Performance

Quality starts at High. After a short warm-up, if the frame rate stays under
28 fps for three seconds the app drops to Eco (lower resolution and mesh
detail, glow off) and tries High again once things run at 45 fps or more.
These automatic changes are not saved; a choice made in the menu is.
Offscreen boxes stop rendering.

## Authors

| Name | Role |
| --- | --- |
| Erzhanuly Nursultan | Project author |
| Kelsingazin Alikhan | Project author |
| Toktar Kametay | Website development and 3D visualisation |

Semey Medical University, Semey, Kazakhstan.

To cite this project, use the "Cite this repository" button on GitHub (it reads
[CITATION.cff](CITATION.cff)), or:

> Erzhanuly N, Kelsingazin A. *Tau Pathology Explorer: an interactive 3D model of
> tau pathology in Alzheimer's disease.* Semey Medical University; 2026.
> https://tau-pathology-explorer.vercel.app

## Copyright

© 2026 Erzhanuly Nursultan and Kelsingazin Alikhan, Semey Medical University.
Website built by Toktar Kametay.
The 3D model files in `public/models/` come from other authors and keep their
own licences (CC BY 4.0, CC0 1.0 and CC BY-SA 4.0); they must stay credited as
listed in [public/models/ATTRIBUTION.md](public/models/ATTRIBUTION.md) and in
the app under Menu → About & credits.
