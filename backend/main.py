"""
Tau Pathology Explorer - optional content API.
Run: uvicorn main:app --reload --port 8000
Frontend uses local data by default; set VITE_API_URL=http://localhost:8000 to use this.

Content policy: the frontend's src/data/* is canonical. This module mirrors it
verbatim so API consumers see the same 4 stages / 8 regions / 5 cell parts /
5 quiz questions. A contract test (backend/tests/test_content.py + the
frontend's src/data/content.test.ts) guards against drift.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="Tau Pathology Explorer API", version="0.1.0")

# NOTE: allow_credentials must be False with a wildcard origin — browsers
# reject Access-Control-Allow-Origin:* + credentials:true combinations.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

#: Server truncates override values to this length (mirrored in the UI warning).
CONTENT_MAXLEN = 2000
#: In-memory stores are append-only by design; cap them so a long-running
#: classroom server cannot grow without bound.
MAX_STORE = 1000


class Stage(BaseModel):
    index: int
    label: str
    braak: str
    description: str
    cellular: str
    tissue: str
    organ: str


# Canonical copy of frontend src/data/stages.ts — keep in sync (see contract test).
STAGES = [
    {
        "index": 0,
        "label": "Healthy",
        "braak": "Braak 0",
        "description": "Tau stabilizes microtubules. Transport is smooth, circuits are dense, brain volume is normal.",
        "cellular": "Tau bound to microtubules • fast axonal transport",
        "tissue": "Dense network • calm glia • no tangles",
        "organ": "No tau glow • full hippocampal volume",
    },
    {
        "index": 1,
        "label": "Early",
        "braak": "Braak I–II",
        "description": "Hyperphosphorylated tau detaches in entorhinal cortex. Microtubules loosen, transport slows.",
        "cellular": "Tau detaches • transport slows • seeds spread",
        "tissue": "~15% neurons affected • microglia alerted",
        "organ": "Entorhinal glow begins • memory gateway strained",
    },
    {
        "index": 2,
        "label": "Middle",
        "braak": "Braak III–IV",
        "description": "Paired helical filaments form tangles. Neurons shrink, glia turn reactive, hippocampus shrinks.",
        "cellular": "Filaments → somatic tangle • tracks fragment",
        "tissue": "~40% affected • reactive glia cluster • gaps appear",
        "organ": "Hippocampus + temporal glow • thinning starts",
    },
    {
        "index": 3,
        "label": "Late",
        "braak": "Braak V–VI",
        "description": "Widespread tangles, neuron loss, cortical thinning, enlarged ventricles, neocortical failure.",
        "cellular": "Transport stopped • dendrites lost • cell dies",
        "tissue": "~70% lost • tissue thins • connections sparse",
        "organ": "Frontal/parietal glow • atrophy + ventricles enlarged",
    },
]

# Canonical copy of frontend src/data/regions.ts — keep in sync (see contract test).
REGIONS = [
    {"id": "entorhinal", "name": "Entorhinal cortex", "short": "EC", "func": "Memory gateway between neocortex and hippocampus. Contains grid cells for spatial navigation.", "tauEffect": "First tau accumulation. Perforant path weakens, input to hippocampus degrades.", "symptom": "Getting lost, misplacing items, subtle new-memory lapses.", "stage": "Braak I–II (Early)"},
    {"id": "hippocampus", "name": "Hippocampus", "short": "HC", "func": "Encodes new episodic memories and consolidates them for long-term storage.", "tauEffect": "Tangles fill CA1 pyramidal cells. Volume shrinks visibly, neurogenesis drops.", "symptom": "Cannot form new memories, repeats questions, rapid forgetting.", "stage": "Braak III–IV (Middle)"},
    {"id": "temporal", "name": "Temporal lobe", "short": "TMP", "func": "Language, object recognition, semantic memory and auditory processing.", "tauEffect": "Tau spreads laterally. Cortical thinning narrows gyri, synapses prune.", "symptom": "Word-finding difficulty, trouble naming objects, misunderstanding speech.", "stage": "Braak IV–V (Middle–Late)"},
    {"id": "parietal", "name": "Parietal lobe", "short": "PAR", "func": "Attention, visuospatial integration, calculation and praxis.", "tauEffect": "Association cortex burden rises. Sulci widen, metabolic drop on PET.", "symptom": "Trouble with directions, dressing, calculations, multitasking.", "stage": "Braak V (Late)"},
    {"id": "frontal", "name": "Frontal lobe", "short": "FRT", "func": "Executive control, planning, judgment, personality and working memory.", "tauEffect": "Late neocortical invasion. Networks disconnect, ventricles enlarge.", "symptom": "Apathy, poor judgment, disinhibition, loss of initiative.", "stage": "Braak V–VI (Late)"},
    {"id": "amygdala", "name": "Amygdala", "short": "AMY", "func": "Almond-shaped threat / emotion hub. Tags memories with fear and salience.", "tauEffect": "Tau fills basolateral nuclei early–middle. Fear conditioning and emotional memory distort.", "symptom": "Anxiety, agitation, misread social cues, emotional outbursts.", "stage": "Braak III–IV (Middle)"},
    {"id": "thalamus", "name": "Thalamus", "short": "THA", "func": "Egg-shaped relay station. Every sense except smell passes through it to cortex.", "tauEffect": "Relay neurons desynchronize as cortical input degenerates. Attention gating weakens.", "symptom": "Fluctuating attention, slowed responses, sensory blunting.", "stage": "Braak IV–V (Middle–Late)"},
    {"id": "hypothalamus", "name": "Hypothalamus", "short": "HYP", "func": "Fingertip-sized command center below thalamus. Sleep, hunger, thirst, temperature, hormones.", "tauEffect": "Tiny orexin / suprachiasmatic circuits disrupted. HPA axis and circadian rhythms fragment.", "symptom": "Sundowning, sleep–wake reversal, appetite and weight change.", "stage": "Braak III–V (Middle)"},
]

# Canonical copy of frontend src/data/cellParts.ts — keep in sync.
CELL_PARTS = [
    {"id": "tau", "name": "Tau protein", "role": "Normally binds and stabilizes microtubule tracks in the axon, like railroad ties keeping rails straight.", "wrong": "Hyperphosphorylation makes tau detach, misfold, and clump into paired helical filaments that aggregate.", "clinical": "CSF p-tau is a core Alzheimer biomarker. Detachment is the first step toward tangles."},
    {"id": "microtubule", "name": "Microtubule", "role": "Parallel hollow tubes that serve as highways for kinesin/dynein motors carrying vesicles and mitochondria.", "wrong": "Without tau, microtubules fragment and depolymerize. Tracks break, cargo stalls, axon starves.", "clinical": "Transport failure explains early synaptic dysfunction before cell death."},
    {"id": "mitochondrion", "name": "Mitochondrion", "role": "Travels along microtubules to synapses to supply ATP and buffer calcium for firing.", "wrong": "When transport stops, synapses run out of energy, calcium handling fails, terminals fade.", "clinical": "FDG-PET hypometabolism reflects this energy failure in patients."},
    {"id": "synapse", "name": "Synapse", "role": "Axon terminal communicates to dendrites. Vesicles release neurotransmitter for memory encoding.", "wrong": "Tau seeds can cross the synapse prion-like to seed misfolding in the next neuron. Terminals retract.", "clinical": "Synapse loss correlates best with cognitive decline — more than plaques."},
    {"id": "tangle", "name": "Neurofibrillary tangle", "role": "No normal role — pathological bundle of hyperphosphorylated tau filaments filling the soma.", "wrong": "Tangles choke the soma, displace organelles, trigger inflammation and eventually ghost tangles after death.", "clinical": "Tangle burden + Braak stage tracks dementia severity. Ghost tangles persist extracellularly."},
]

# Canonical copy of frontend src/data/quiz.ts — keep in sync.
QUIZ = [
    {"id": "q1", "q": "What is tau’s normal job in a healthy axon?", "options": ["Stabilize microtubules", "Make amyloid plaques", "Kill microglia", "Block neurotransmitters"], "answer": 0, "explain": "Tau binds microtubule tracks so kinesin/dynein motors can move cargo smoothly.", "see": {"kind": "cellPart", "id": "microtubule"}, "seeStage": 0},
    {"id": "q2", "q": "What does hyperphosphorylation do to tau?", "options": ["It strengthens binding", "It makes tau detach and misfold", "It dissolves tangles", "It grows dendrites"], "answer": 1, "explain": "Excess phosphate makes tau let go, then it clumps into paired helical filaments.", "see": {"kind": "cellPart", "id": "tau"}, "seeStage": 1},
    {"id": "q3", "q": "Which region is hit first in Braak I–II?", "options": ["Frontal lobe", "Entorhinal cortex", "Parietal lobe", "Occipital lobe"], "answer": 1, "explain": "Tau starts in entorhinal cortex — the memory gateway — before hippocampus.", "see": {"kind": "brainRegion", "id": "entorhinal"}, "seeStage": 1},
    {"id": "q4", "q": "What best correlates with cognitive decline?", "options": ["Plaque count alone", "Synapse loss + tangle burden", "Brain weight", "Ventricle color"], "answer": 1, "explain": "Synapse loss and Braak tangle stage track symptoms better than plaques.", "see": {"kind": "cellPart", "id": "synapse"}, "seeStage": 2},
    {"id": "q5", "q": "Reactive microglia in mid-late disease do what?", "options": ["Stay small and calm", "Enlarge, cluster around damage", "Turn into neurons", "Leave the brain"], "answer": 1, "explain": "They become amoeboid, change color/shape, and surround tangles/debris.", "see": {"kind": "cellPart", "id": "tangle"}, "seeStage": 2},
]


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/stages")
def stages():
    return STAGES


@app.get("/api/regions")
def regions():
    return REGIONS


@app.get("/api/cell-parts")
def cell_parts():
    return CELL_PARTS


@app.get("/api/quiz")
def quiz():
    return QUIZ


class ProgressIn(BaseModel):
    stage: int = Field(ge=0, le=3)
    ts: int | None = None


class QuizAttempt(BaseModel):
    score: int = Field(ge=0)
    total: int = Field(ge=1)
    ts: int | None = None

    @model_validator(mode="after")
    def _score_within_total(self):
        if self.score > self.total:
            raise ValueError("score must not exceed total")
        return self


PROGRESS: list[dict] = []
QUIZ_ATTEMPTS: list[dict] = []


def _append_capped(store: list[dict], item: dict) -> int:
    """Append + trim the in-memory store so it cannot grow without bound."""
    store.append(item)
    if len(store) > MAX_STORE:
        del store[: len(store) - MAX_STORE]
    return len(store)


@app.post("/api/progress")
def save_progress(p: ProgressIn):
    count = _append_capped(PROGRESS, p.model_dump())
    return {"ok": True, "count": count}


@app.get("/api/progress")
def get_progress():
    return {"count": len(PROGRESS), "last": PROGRESS[-10:]}


@app.post("/api/quiz-attempts")
def save_quiz(a: QuizAttempt):
    count = _append_capped(QUIZ_ATTEMPTS, a.model_dump())
    return {"ok": True, "count": count}


@app.get("/api/quiz-attempts")
def get_quiz():
    return {"count": len(QUIZ_ATTEMPTS), "last": QUIZ_ATTEMPTS[-10:]}


CONTENT_OVERRIDES: dict[str, str] = {}


@app.get("/api/content")
def get_content():
    return CONTENT_OVERRIDES


@app.post("/api/content")
def save_content(overrides: dict[str, str]):
    CONTENT_OVERRIDES.clear()
    CONTENT_OVERRIDES.update({k: str(v)[:CONTENT_MAXLEN] for k, v in overrides.items()})
    return {"ok": True, "count": len(CONTENT_OVERRIDES)}
