# Tau Pathology Explorer

Interactive 3D teaching app: tau tangles → neuron → tissue → whole brain in Alzheimer's.

## Run frontend (offline-first)
```bash
npm install
npm run dev
# build
npm run build
```

Theme persists in localStorage. Set `VITE_API_URL` to use backend, otherwise local `src/data/*` is used.

Copy `.env.example` → `.env` to point at FastAPI:
```
VITE_API_URL=http://localhost:8000
```

## Run optional backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# or
docker compose up --build
```

Endpoints: `/health`, `/api/stages`, `/api/regions` (8 regions), `/api/cell-parts`, `/api/quiz`, `/api/progress`, `/api/quiz-attempts`, `/api/content` (GET/POST). Frontend `src/data/*` is canonical and mirrored verbatim by the API; `backend/tests/test_content.py` guards against drift.

## Features
- 3 synced R3F canvases, OrbitControls + Reset + PNG snapshot, lazy-loaded, Stars + shadows + Bloom/Vignette
- Smooth cinematic stage interpolation (no snapping) via `useSmoothStage`
- Timeline 0-3 (Braak 0, I-II, III-IV, V-VI) + Play/Pause/Speed, keys 1-4 / Space / C
- Clickable tau/microtubule/synapse/mito/tangle + 8 brain regions (incl. amygdala, thalamus, hypothalamus) → side panel (merged content)
- Region isolate mode (dims the rest when a region is selected, toggleable) + camera focus (orbit pivot + per-region distance ease toward the selected region), legend hover/focus/tap lights up matching 3D structures, first-run coachmark hint
- Guided tour (4 steps, each auto-selects its 3D hotspot; arrow keys page, progress bar) + 5-Q quiz (each question has a "See in 3D" jump; per-language best, retry-missed mode) with API persistence, dark/light, Okabe-Ito palette, Esc to close, focus trap, aria-live stage announcer, reduced-motion respected
- Tissue toggles, live healthy counter (illustrative, shared helper in `src/data/tissueStats.ts`)
- Compare mode = two synced brains (compact on mobile, responsive 1-col)
- Shareable URLs: `?stage=2&compare=1&theme=dark&bloom=1&quality=high&lang=en&sel=brainRegion:hippocampus` + Share button copies link
- FPS badge + auto-Eco with hysteresis (drops after 3s <28fps, restores after 5s ≥45fps); offscreen canvases pause rendering (mobile defaults to Eco, no bloom)
- Professor mode: Edit button edits stage captions (localStorage + JSON export/import + POST /api/content with pull + length guard); shared server content merges once at boot (local edits win), Refs button shows 5 key papers
- Glossary: dotted-underline jargon (Braak, p-tau, FDG-PET, …) with hover/focus definitions in EN + TR
- Storyboard button captures all 4 stages (~6s, cycles timeline) to `tau-storyboard.html` with embedded PNGs + captions for lectures

## Tests + CI
```bash
npm run test # vitest (content contract + hooks)
npm run lint
cd backend && python -m pytest tests/ -q
```
`.github/workflows/ci.yml` runs web lint/test/build + backend pytest.

## Deploy
```bash
# static
npm run build # → dist/
docker build -f Dockerfile.frontend -t tau-explorer .
docker run -p 8080:80 tau-explorer
```
The image serves `nginx.conf` with SPA fallback (`try_files … /index.html`),
so shareable deep links keep working on refresh. Hashed `/assets/*` cache for
30 days; `index.html` is never cached. Backend URL resolution:
build-time `VITE_API_URL` by default, overridable at container start without
rebuilding via `docker run -p 8080:80 -e VITE_API_URL=http://api:8000 …`
(entrypoint regenerates `/env.js`; `src/data/api.ts` prefers it).
`docker compose` sets `restart: unless-stopped`, an `/health`-based healthcheck on the API,
and picks up `.env` for the dev server when present. For a production-like stack
(built nginx frontend + API with health-gated startup):
`docker compose --profile prod up --build`, then open http://localhost:8080.
