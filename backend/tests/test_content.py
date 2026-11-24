"""Contract tests: backend content mirrors frontend src/data/* verbatim.

Run: pytest (from backend/, after pip install -r requirements.txt)
Frontend mirror: src/data/content.test.ts — update both sides together.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

EXPECTED_REGION_IDS = [
    "entorhinal",
    "hippocampus",
    "temporal",
    "parietal",
    "frontal",
    "amygdala",
    "thalamus",
    "hypothalamus",
]
EXPECTED_CELL_IDS = [
    "tau", "microtubule", "mitochondrion", "synapse", "tangle",
    "soma", "dendrite", "spine", "axon", "motor", "tubulin", "phosphate", "phf", "neuron", "astrocyte", "microglia",
]


def test_stages_match_frontend_canonical():
    r = client.get("/api/stages")
    assert r.status_code == 200
    stages = r.json()
    assert [s["label"] for s in stages] == ["Healthy", "Early", "Middle", "Late"]
    assert stages[0]["description"].startswith("Tau stabilizes microtubules.")
    assert "microtubule" in stages[0]["cellular"].lower() or "Microtubule" in stages[0]["cellular"]
    for s in stages:
        for f in ("description", "cellular", "tissue", "organ"):
            assert len(s[f]) > 10, f"{s['label']}.{f}"


def test_regions_include_deep_structures():
    r = client.get("/api/regions")
    assert r.status_code == 200
    regions = r.json()
    assert [x["id"] for x in regions] == EXPECTED_REGION_IDS
    for x in regions:
        assert len(x["short"]) >= 2
        assert len(x["func"]) > 10


def test_cell_parts_and_quiz_shape():
    parts = client.get("/api/cell-parts").json()
    assert [p["id"] for p in parts] == EXPECTED_CELL_IDS
    quiz = client.get("/api/quiz").json()
    assert [q["id"] for q in quiz] == ["q1", "q2", "q3", "q4", "q5"]
    region_ids = [r["id"] for r in client.get("/api/regions").json()]
    for q in quiz:
        assert 0 <= q["answer"] < len(q["options"])
        assert q["seeStage"] in (0, 1, 2, 3)
        pool = EXPECTED_CELL_IDS if q["see"]["kind"] == "cellPart" else region_ids
        assert q["see"]["id"] in pool


def test_progress_rejects_out_of_range_stage():
    assert client.post("/api/progress", json={"stage": 0}).status_code == 200
    assert client.post("/api/progress", json={"stage": 4}).status_code == 422
    assert client.post("/api/progress", json={"stage": -1}).status_code == 422


def test_quiz_attempt_rejects_score_above_total():
    ok = client.post("/api/quiz-attempts", json={"score": 3, "total": 5})
    assert ok.status_code == 200
    bad = client.post("/api/quiz-attempts", json={"score": 6, "total": 5})
    assert bad.status_code == 422


def test_stores_are_capped():
    main.PROGRESS.clear()
    for i in range(main.MAX_STORE + 50):
        client.post("/api/progress", json={"stage": i % 4})
    assert len(main.PROGRESS) == main.MAX_STORE


def test_content_truncates_long_values():
    long_value = "x" * (main.CONTENT_MAXLEN + 100)
    r = client.post("/api/content", json={"stage:0:description": long_value})
    assert r.status_code == 200
    stored = client.get("/api/content").json()
    assert len(stored["stage:0:description"]) == main.CONTENT_MAXLEN
