#!/usr/bin/env python3
"""Build the web 3D assets in public/models/ from primary scientific sources.

    python scripts/build_models.py

Inputs are cached in models-src/ and downloaded on first run:
  * NeuroMorpho.Org SWC reconstructions (CC BY 4.0) -> models-src/swc/
  * RCSB PDB entries 5O3L, 6DPV, 7PQC (CC0)         -> models-src/pdb/

Outputs:
  public/models/cells/<id>.json           compact branch trees; the app turns
                                          them into tube meshes at runtime
  public/models/molecules/tubulin.glb     low-res molecular surfaces of the
                                          alpha/beta tubulin monomers
  public/models/molecules/molecules.json  microtubule lattice parameters, the
                                          tau backbone bound to a protofilament
                                          and the paired-helical-filament rung

Requires Python 3.10+ and numpy. See public/models/ATTRIBUTION.md for credits.
"""
from __future__ import annotations

import json
import math
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "models-src"
OUT = ROOT / "public" / "models"

# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #

CA1_REF = {
    "pmid": "31268532",
    "doi": "10.1093/cercor/bhz122",
    "cite": "Benavides-Piccione R et al. Differential structure of hippocampal CA1 pyramidal neurons in the human and mouse. Cereb Cortex 2020;30:730-752.",
}

CELLS = [
    {
        "id": "ca1-hero", "kind": "neuron", "eps": 0.3,
        "label": "Human hippocampal CA1 pyramidal neuron",
        "archive": "DeFelipe", "nmo": 147158,
        "name": "26-human-hcca1-idab2-porta1-sec1-cel13soma-z-corr-1-7", **CA1_REF,
    },
    {
        "id": "ca1-a", "kind": "neuron", "eps": 1.4,
        "label": "Human hippocampal CA1 pyramidal neuron",
        "archive": "DeFelipe", "nmo": 147067,
        "name": "31-human-hcca1-idab2-porta-6-sec1-cel3-soma-corr1-7z", **CA1_REF,
    },
    {
        "id": "ca1-b", "kind": "neuron", "eps": 1.4,
        "label": "Human hippocampal CA1 pyramidal neuron",
        "archive": "DeFelipe", "nmo": 147060,
        "name": "12-human-hcca1-idab1-porta5-sec1-cel9-soma-corr1-7z", **CA1_REF,
    },
    {
        "id": "ca1-c", "kind": "neuron", "eps": 1.4,
        "label": "Human hippocampal CA1 pyramidal neuron",
        "archive": "DeFelipe", "nmo": 147087,
        "name": "20-human-hcca1-idab2-porta1-sec1-cel1-soma-z-corr-1-7", **CA1_REF,
    },
    {
        "id": "astrocyte", "kind": "glia", "eps": 0.35,
        "label": "Human cortical astrocyte (vimentin-immunoreactive)",
        "archive": "Mechawar", "nmo": 189671, "name": "s3vimV1GMcell-2",
        "pmid": "32848635", "doi": "10.3389/fnana.2020.00031",
        "cite": "O'Leary LA et al. Characterization of vimentin-immunoreactive astrocytes in the human brain. Front Neuroanat 2020;14:31.",
    },
    {
        "id": "microglia-a", "kind": "glia", "eps": 0.2,
        "label": "Human cortical microglia",
        "archive": "Seney", "nmo": 301526, "name": "822_44_05_18",
        "pmid": "40420495", "doi": "10.1093/cercor/bhaf120",
        "cite": "Yoblinski AR et al. Brain region and sex differences in human microglia morphology and function. Cereb Cortex 2025;35:bhaf120.",
    },
    {
        "id": "microglia-b", "kind": "glia", "eps": 0.2,
        "label": "Human cortical microglia",
        "archive": "Seney", "nmo": 301542, "name": "822_50_02_121",
        "pmid": "40420495", "doi": "10.1093/cercor/bhaf120",
        "cite": "Yoblinski AR et al. Brain region and sex differences in human microglia morphology and function. Cereb Cortex 2025;35:bhaf120.",
    },
]

PDB_IDS = ["5O3L", "6DPV", "7PQC"]
NEURONAL_PF = 13

# Tau residues with well-established disease-associated phosphorylation that
# fall inside the 7PQC model (residues 202-395, 2N4R numbering).
PHOSPHO_SITES = [202, 205, 212, 214, 217, 231, 235, 262, 356]


def fetch(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "model-build-script"})
    with urllib.request.urlopen(req, timeout=90) as r:
        dest.write_bytes(r.read())


# --------------------------------------------------------------------------- #
# SWC -> compact tree
# --------------------------------------------------------------------------- #

def load_swc(path: Path):
    nodes = {}
    order = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        p = line.split()
        if len(p) < 7:
            continue
        i = int(p[0])
        nodes[i] = [int(p[1]), np.array([float(p[2]), float(p[3]), float(p[4])]), float(p[5]), int(p[6])]
        order.append(i)
    return nodes, order


def rotation_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Rotation matrix taking unit vector a onto unit vector b."""
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else np.diag([1.0, -1.0, -1.0])
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k * (1.0 / (1.0 + c))


def rdp(points: np.ndarray, eps: float) -> list[int]:
    """Ramer-Douglas-Peucker; returns kept indices (always first + last)."""
    keep = [0, len(points) - 1]
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        pa, pb = points[a], points[b]
        ab = pb - pa
        L = np.linalg.norm(ab)
        seg = points[a + 1:b]
        if L < 1e-9:
            d = np.linalg.norm(seg - pa, axis=1)
        else:
            d = np.linalg.norm(np.cross(seg - pa, ab), axis=1) / L
        i = int(np.argmax(d))
        if d[i] > eps:
            m = a + 1 + i
            keep.append(m)
            stack.append((a, m))
            stack.append((m, b))
    return sorted(set(keep))


def build_cell(cfg: dict) -> dict:
    swc = SRC / "swc" / f"{cfg['name']}.swc"
    fetch(
        f"https://neuromorpho.org/dableFiles/{cfg['archive'].lower()}/CNG%20version/"
        f"{urllib.parse.quote(cfg['name'])}.CNG.swc",
        swc,
    )
    nodes, order = load_swc(swc)
    root = next(i for i in order if nodes[i][3] not in nodes)
    soma_c = nodes[root][1].copy()
    soma_r = nodes[root][2]

    # Collapse multi-point somata onto the root and re-parent their children.
    soma_ids = {i for i in order if nodes[i][0] == 1}
    children: dict[int, list[int]] = {}
    for i in order:
        if i == root or i in soma_ids:
            continue
        par = nodes[i][3]
        if par in soma_ids or par not in nodes:
            par = root
        nodes[i][3] = par
        children.setdefault(par, []).append(i)

    pos = {i: nodes[i][1] - soma_c for i in order}

    # Orient: apical dendrite up (+Y), widest horizontal spread along X.
    if cfg["kind"] == "neuron":
        apical = np.array([pos[i] for i in order if nodes[i][0] == 4])
        if len(apical):
            a = apical.mean(axis=0)
            a /= np.linalg.norm(a)
            R = rotation_between(a, np.array([0.0, 1.0, 0.0]))
            for i in order:
                pos[i] = R @ pos[i]
    pts = np.array([pos[i] for i in order if i not in soma_ids or i == root])
    xz = pts[:, [0, 2]] - pts[:, [0, 2]].mean(axis=0)
    w, v = np.linalg.eigh(xz.T @ xz)
    major = v[:, int(np.argmax(w))]
    ang = math.atan2(major[1], major[0])
    c, s = math.cos(ang), math.sin(ang)
    Ry = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    for i in order:
        pos[i] = Ry @ pos[i]

    # Walk unbranched sections depth-first and simplify each with RDP.
    out_pos, out_rad, out_type, out_par = [[0.0, 0.0, 0.0]], [soma_r], [1], [-1]
    stack = [(root, 0)]
    while stack:
        start, start_idx = stack.pop()
        for child in reversed(children.get(start, [])):
            chain = [child]
            while len(children.get(chain[-1], [])) == 1:
                chain.append(children[chain[-1]][0])
            poly = np.array([pos[start]] + [pos[i] for i in chain])
            kept = rdp(poly, cfg["eps"])
            prev = start_idx
            for k in kept[1:]:
                nid = chain[k - 1]
                out_pos.append(pos[nid].tolist())
                out_rad.append(nodes[nid][2])
                out_type.append(nodes[nid][0])
                out_par.append(prev)
                prev = len(out_pos) - 1
            stack.append((chain[-1], prev))

    arr = np.array(out_pos)
    ext = (arr.max(axis=0) - arr.min(axis=0)).round(1).tolist()
    counts = {t: out_type.count(t) for t in sorted(set(out_type))}
    print(f"  {cfg['id']:12s} {len(order):6d} -> {len(out_pos):5d} nodes  soma r {soma_r:.1f} um  extent {ext}  types {counts}")

    return {
        "id": cfg["id"],
        "label": cfg["label"],
        "unit": "um",
        "source": {
            "db": "NeuroMorpho.Org",
            "nmoId": cfg["nmo"],
            "name": cfg["name"],
            "archive": cfg["archive"],
            "pmid": cfg["pmid"],
            "doi": cfg["doi"],
            "cite": cfg["cite"],
            "license": "CC BY 4.0",
        },
        "somaRadius": round(soma_r, 2),
        "count": len(out_pos),
        # micrometres x10 / x100 as integers keeps the JSON small and exact
        "pos": [int(round(v * 10)) for p in out_pos for v in p],
        "rad": [int(round(r * 100)) for r in out_rad],
        "type": out_type,
        "parent": out_par,
    }


# --------------------------------------------------------------------------- #
# PDB helpers
# --------------------------------------------------------------------------- #

def read_pdb(path: Path):
    """First model only. Returns {chain: [(resnum, atomname, xyz)]} for heavy atoms."""
    chains: dict[str, list] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        rec = line[:6]
        if rec == "ENDMDL":
            break
        if rec != "ATOM  ":
            continue
        elem = line[76:78].strip() or line[12:16].strip()[0]
        if elem == "H":
            continue
        chains.setdefault(line[21], []).append(
            (int(line[22:26]), line[12:16].strip(), np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])]))
        )
    return chains


def ca_map(atoms) -> dict[int, np.ndarray]:
    return {r: xyz for r, name, xyz in atoms if name == "CA"}


def all_xyz(atoms) -> np.ndarray:
    return np.array([xyz for _, _, xyz in atoms])


def kabsch(P: np.ndarray, Q: np.ndarray):
    """R, t minimising |R P_i + t - Q_i|."""
    pc, qc = P.mean(axis=0), Q.mean(axis=0)
    H = (P - pc).T @ (Q - qc)
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1.0, 1.0, d]) @ U.T
    return R, qc - R @ pc


def fit_chains(a, b):
    """Kabsch on C-alpha atoms matched by residue number; returns R, t, rmsd."""
    ma, mb = ca_map(a), ca_map(b)
    common = sorted(set(ma) & set(mb))
    P = np.array([ma[r] for r in common])
    Q = np.array([mb[r] for r in common])
    R, t = kabsch(P, Q)
    rmsd = float(np.sqrt((((R @ P.T).T + t - Q) ** 2).sum(axis=1).mean()))
    return R, t, rmsd


def screw(R: np.ndarray, t: np.ndarray):
    """Axis direction u, signed angle, rise along u and a point on the axis."""
    w, v = np.linalg.eig(R)
    u = np.real(v[:, int(np.argmin(np.abs(w - 1.0)))])
    u /= np.linalg.norm(u)
    angle = math.acos(max(-1.0, min(1.0, (np.trace(R) - 1.0) / 2.0)))
    # sign of the angle about u
    k = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]])
    if np.dot(k, u) < 0:
        angle = -angle
    rise = float(np.dot(u, t))
    c = np.linalg.lstsq(np.eye(3) - R, t - rise * u, rcond=None)[0]
    return u, angle, rise, c


class Frame:
    """Orthonormal frame with Y along a screw axis and X towards a reference point."""

    def __init__(self, axis_u, axis_point, ref_point):
        self.ey = axis_u / np.linalg.norm(axis_u)
        self.o = axis_point + self.ey * np.dot(self.ey, ref_point - axis_point)
        radial = ref_point - self.o
        self.ex = radial / np.linalg.norm(radial)
        self.ez = np.cross(self.ex, self.ey)
        self.M = np.vstack([self.ex, self.ey, self.ez])  # rows

    def to(self, xyz: np.ndarray) -> np.ndarray:
        return (xyz - self.o) @ self.M.T

    def rot(self, R: np.ndarray) -> np.ndarray:
        return self.M @ R @ self.M.T


def three_y_angle(Rf: np.ndarray) -> float:
    """Angle a such that three.js makeRotationY(a) == Rf (rotation about +Y)."""
    return math.atan2(Rf[0, 2], Rf[0, 0])


# --------------------------------------------------------------------------- #
# Molecular surface (Gaussian density + naive surface nets)
# --------------------------------------------------------------------------- #

def density_grid(xyz: np.ndarray, spacing: float, sigma: float):
    pad = 3.0 * sigma + spacing
    lo = xyz.min(axis=0) - pad
    n = np.ceil((xyz.max(axis=0) + pad - lo) / spacing).astype(int) + 1
    vol = np.zeros(n, dtype=np.float64)
    reach = int(math.ceil(3.0 * sigma / spacing))
    inv = 1.0 / (2.0 * sigma * sigma)
    for a in xyz:
        g = (a - lo) / spacing
        i0 = np.maximum(np.floor(g).astype(int) - reach, 0)
        i1 = np.minimum(np.floor(g).astype(int) + reach + 2, n)
        xs = lo[0] + spacing * np.arange(i0[0], i1[0]) - a[0]
        ys = lo[1] + spacing * np.arange(i0[1], i1[1]) - a[1]
        zs = lo[2] + spacing * np.arange(i0[2], i1[2]) - a[2]
        d2 = xs[:, None, None] ** 2 + ys[None, :, None] ** 2 + zs[None, None, :] ** 2
        vol[i0[0]:i1[0], i0[1]:i1[1], i0[2]:i1[2]] += np.exp(-d2 * inv)
    return vol, lo


def iso_for_volume(vol: np.ndarray, spacing: float, target: float) -> float:
    lo, hi = 0.01, float(vol.max())
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if (vol > mid).sum() * spacing ** 3 > target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


_CORNERS = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (0, 0, 1), (1, 0, 1), (0, 1, 1), (1, 1, 1)]
_EDGES = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]


def surface_nets(vol: np.ndarray, iso: float):
    nx, ny, nz = vol.shape
    inside = vol > iso
    cnt = np.zeros((nx - 1, ny - 1, nz - 1), dtype=int)
    for dx, dy, dz in _CORNERS:
        cnt += inside[dx:nx - 1 + dx, dy:ny - 1 + dy, dz:nz - 1 + dz]
    cells = np.argwhere((cnt > 0) & (cnt < 8))
    index = -np.ones((nx - 1, ny - 1, nz - 1), dtype=int)
    verts = []
    for i, j, k in cells:
        acc = np.zeros(3)
        m = 0
        for a, b in _EDGES:
            ca, cb = _CORNERS[a], _CORNERS[b]
            va = vol[i + ca[0], j + ca[1], k + ca[2]]
            vb = vol[i + cb[0], j + cb[1], k + cb[2]]
            if (va > iso) != (vb > iso):
                f = (iso - va) / (vb - va)
                acc += np.array(ca) + f * (np.array(cb) - np.array(ca))
                m += 1
        index[i, j, k] = len(verts)
        verts.append(np.array([i, j, k]) + acc / m)
    faces = []

    def quad(a, b, c, d, flip):
        if min(a, b, c, d) < 0:
            return
        if flip:
            faces.append((a, c, b)); faces.append((a, d, c))
        else:
            faces.append((a, b, c)); faces.append((a, c, d))

    # one quad per sign-changing grid edge, joining the 4 cells that share it
    for i in range(nx - 1):
        for j in range(1, ny - 1):
            for k in range(1, nz - 1):
                a, b = inside[i, j, k], inside[i + 1, j, k]
                if a != b:
                    quad(index[i, j - 1, k - 1], index[i, j, k - 1], index[i, j, k], index[i, j - 1, k], bool(b))
    for i in range(1, nx - 1):
        for j in range(ny - 1):
            for k in range(1, nz - 1):
                a, b = inside[i, j, k], inside[i, j + 1, k]
                if a != b:
                    quad(index[i - 1, j, k - 1], index[i, j, k - 1], index[i, j, k], index[i - 1, j, k], bool(a))
    for i in range(1, nx - 1):
        for j in range(1, ny - 1):
            for k in range(nz - 1):
                a, b = inside[i, j, k], inside[i, j, k + 1]
                if a != b:
                    quad(index[i - 1, j - 1, k], index[i, j - 1, k], index[i, j, k], index[i - 1, j, k], bool(b))
    return np.array(verts), np.array(faces, dtype=np.int64)


def smooth(verts: np.ndarray, faces: np.ndarray, iterations: int, lam: float) -> np.ndarray:
    n = len(verts)
    nbrs = [set() for _ in range(n)]
    for a, b, c in faces:
        nbrs[a].update((b, c)); nbrs[b].update((a, c)); nbrs[c].update((a, b))
    v = verts.copy()
    for _ in range(iterations):
        avg = np.array([v[list(nb)].mean(axis=0) if nb else v[i] for i, nb in enumerate(nbrs)])
        v = v + lam * (avg - v)
    return v


def vertex_normals(verts: np.ndarray, faces: np.ndarray) -> np.ndarray:
    n = np.zeros_like(verts)
    fn = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    for c in range(3):
        np.add.at(n, faces[:, c], fn)
    ln = np.linalg.norm(n, axis=1)
    ln[ln == 0] = 1.0
    return n / ln[:, None]


def molecular_surface(xyz: np.ndarray, spacing: float, sigma: float, puff: float = 1.2):
    vol, lo = density_grid(xyz, spacing, sigma)
    iso = iso_for_volume(vol, spacing, len(xyz) * 17.5 * puff)
    verts, faces = surface_nets(vol, iso)
    verts = smooth(verts, faces, 2, 0.5)
    verts = lo + verts * spacing
    # orient outwards (positive signed volume)
    vol6 = np.einsum("ij,ij->i", verts[faces[:, 0]], np.cross(verts[faces[:, 1]], verts[faces[:, 2]])).sum()
    if vol6 < 0:
        faces = faces[:, [0, 2, 1]]
    return verts, faces, vertex_normals(verts, faces)


# --------------------------------------------------------------------------- #
# Minimal GLB writer
# --------------------------------------------------------------------------- #

def write_glb(path: Path, meshes: list[dict], extras: dict) -> None:
    blob = bytearray()
    views, accessors, gl_meshes, gl_nodes = [], [], [], []

    def add(data: bytes, target: int) -> int:
        while len(blob) % 4:
            blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target})
        blob.extend(data)
        return len(views) - 1

    for m in meshes:
        pos = np.asarray(m["positions"], dtype=np.float32)
        nor = np.asarray(m["normals"], dtype=np.float32)
        idx = np.asarray(m["indices"], dtype=np.uint32 if len(pos) > 65535 else np.uint16).reshape(-1)
        pv = add(pos.tobytes(), 34962)
        nv = add(nor.tobytes(), 34962)
        iv = add(idx.tobytes(), 34963)
        base = len(accessors)
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3",
                          "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()})
        accessors.append({"bufferView": nv, "componentType": 5126, "count": len(nor), "type": "VEC3"})
        accessors.append({"bufferView": iv, "componentType": 5125 if idx.dtype == np.uint32 else 5123,
                          "count": int(idx.size), "type": "SCALAR"})
        gl_meshes.append({"name": m["name"], "primitives": [
            {"attributes": {"POSITION": base, "NORMAL": base + 1}, "indices": base + 2, "mode": 4}]})
        gl_nodes.append({"name": m["name"], "mesh": len(gl_meshes) - 1})

    while len(blob) % 4:
        blob.append(0)
    doc = {
        "asset": {"version": "2.0", "generator": "scripts/build_models.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(gl_nodes))), "extras": extras}],
        "nodes": gl_nodes,
        "meshes": gl_meshes,
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    js = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    with path.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(blob)


# --------------------------------------------------------------------------- #
# Molecules
# --------------------------------------------------------------------------- #

def r3(a) -> list:
    return [round(float(v), 3) for v in np.asarray(a).reshape(-1)]


def build_molecules() -> None:
    for pid in PDB_IDS:
        fetch(f"https://files.rcsb.org/download/{pid}.pdb", SRC / "pdb" / f"{pid}.pdb")

    # ---- microtubule lattice from 6DPV (3 protofilaments x 2 dimers) -------
    mt = read_pdb(SRC / "pdb" / "6DPV.pdb")
    R_lat, t_lat, rms_lat = fit_chains(mt["A"], mt["C"])          # alpha -> lateral neighbour alpha
    u, ang, rise, c = screw(R_lat, t_lat)
    cen_a, cen_b = all_xyz(mt["A"]).mean(axis=0), all_xyz(mt["B"]).mean(axis=0)
    if np.dot(cen_b - cen_a, u) < 0:                               # +Y = plus end (beta side)
        u, ang, rise = -u, -ang, -rise
    R_lon, t_lon, rms_lon = fit_chains(mt["A"], mt["K"])          # alpha -> next dimer, same protofilament
    dimer_rise = float(np.dot(u, all_xyz(mt["K"]).mean(axis=0) - cen_a))
    frame = Frame(u, c, 0.5 * (cen_a + cen_b))
    lat_angle = three_y_angle(frame.rot(R_lat))
    lat_rise = float((frame.M @ t_lat + (frame.rot(R_lat) - np.eye(3)) @ (frame.M @ frame.o))[1])
    pf = round(2 * math.pi / abs(lat_angle))
    radius = float(np.linalg.norm(frame.to(0.5 * (cen_a + cen_b))[[0, 2]]))
    print(f"  microtubule: lateral {math.degrees(lat_angle):.2f} deg / {lat_rise:.2f} A (rmsd {rms_lat:.2f}), "
          f"dimer repeat {dimer_rise:.2f} A (rmsd {rms_lon:.2f}), {pf} protofilaments, radius {radius:.1f} A")

    meshes = []
    for lod, spacing, sigma in (("hi", 3.6, 2.8), ("lo", 6.0, 4.0)):
        for chain, name in (("A", "alpha"), ("B", "beta")):
            v, f, n = molecular_surface(frame.to(all_xyz(mt[chain])), spacing, sigma)
            meshes.append({"name": f"{name}_{lod}", "positions": v, "normals": n, "indices": f})
            print(f"  tubulin {name}_{lod}: {len(v)} verts, {len(f)} tris")
    (OUT / "molecules").mkdir(parents=True, exist_ok=True)
    write_glb(OUT / "molecules" / "tubulin.glb", meshes, {
        "source": "RCSB PDB 6DPV (CC0) - Zhang, LaFrance & Nogales, PNAS 2018",
        "note": "Gaussian molecular surfaces of one alpha/beta-tubulin dimer in the microtubule frame (Y = axis, +Y = plus end). Units: angstrom.",
    })

    # ---- tau bound along a protofilament (7PQC, model 1) -------------------
    tm = read_pdb(SRC / "pdb" / "7PQC.pdb")
    best = None
    for ch in "BDFHJLN":                                           # alpha chains of the 7PQC protofilament
        R, t, rms = fit_chains(tm[ch], mt["A"])
        tau = frame.to((R @ all_xyz([a for a in tm["O"] if a[1] == "CA"]).T).T + t)
        mid = 0.5 * (tau[:, 1].min() + tau[:, 1].max())
        if best is None or abs(mid) < abs(best[0]):
            best = (mid, ch, rms, tau)
    _, ch, rms, tau = best
    tau_res = sorted(ca_map(tm["O"]))
    tau_rad = np.linalg.norm(tau[:, [0, 2]], axis=1)
    print(f"  tau on microtubule: fitted via 7PQC chain {ch} (rmsd {rms:.2f} A), residues {tau_res[0]}-{tau_res[-1]}, "
          f"y {tau[:, 1].min():.0f}..{tau[:, 1].max():.0f} A, radial {tau_rad.min():.0f}-{tau_rad.max():.0f} A")

    # ---- paired helical filament (5O3L) -------------------------------------
    phf = read_pdb(SRC / "pdb" / "5O3L.pdb")
    R_ab, t_ab, rms_ab = fit_chains(phf["A"], phf["B"])           # protofilament 1 -> 2 (pseudo-2_1 screw)
    pu, pang, prise, pc = screw(R_ab, t_ab)
    R_ac, t_ac, rms_ac = fit_chains(phf["A"], phf["C"])           # one rung along the filament
    pframe = Frame(pu, pc, all_xyz(phf["A"]).mean(axis=0))
    Rf = pframe.rot(R_ac)
    rung_twist = three_y_angle(Rf)
    rung_rise = float((pframe.M @ t_ac + (Rf - np.eye(3)) @ (pframe.M @ pframe.o))[1])
    ca_a = pframe.to(np.array([xyz for _, n, xyz in phf["A"] if n == "CA"]))
    ca_b = pframe.to(np.array([xyz for _, n, xyz in phf["B"] if n == "CA"]))
    phf_res = sorted(ca_map(phf["A"]))
    crossover = abs(math.pi / rung_twist * rung_rise)
    print(f"  PHF: protofilament screw {math.degrees(pang):.2f} deg / {prise:.2f} A (rmsd {rms_ab:.2f}); "
          f"rung {math.degrees(rung_twist):.3f} deg / {rung_rise:.2f} A (rmsd {rms_ac:.2f}); crossover {crossover / 10:.0f} nm; "
          f"width {2 * np.linalg.norm(ca_a[:, [0, 2]], axis=1).max() / 10:.1f} nm")

    doc = {
        "unit": "angstrom",
        "microtubule": {
            "source": "RCSB PDB 6DPV",
            # 6DPV is a 14-protofilament tube (common in vitro). Neuronal
            # microtubules have 13, so the app rebuilds the canonical 13_3
            # lattice from the same subunits: 3-start helix, 1.5-dimer seam.
            "sourceProtofilaments": pf,
            "protofilaments": NEURONAL_PF,
            "lateralAngle": round(math.copysign(2 * math.pi / NEURONAL_PF, lat_angle), 6),
            "lateralRise": round(math.copysign(1.5 * dimer_rise / NEURONAL_PF, lat_rise), 3),
            "dimerRise": round(dimer_rise, 3),
            "radius": round(radius * NEURONAL_PF / pf, 2),
            "radiusShift": round(radius * NEURONAL_PF / pf - radius, 2),
            "alphaCenter": r3(frame.to(cen_a)),
            "betaCenter": r3(frame.to(cen_b)),
        },
        "tauOnMicrotubule": {
            "source": "RCSB PDB 7PQC (model 1)",
            "firstResidue": tau_res[0],
            "ca": r3(tau),
            "phosphoSites": [r for r in PHOSPHO_SITES if r in tau_res],
        },
        "phf": {
            "source": "RCSB PDB 5O3L",
            "firstResidue": phf_res[0],
            "rungTwist": round(rung_twist, 6),
            "rungRise": round(rung_rise, 3),
            "chainA": r3(ca_a),
            "chainB": r3(ca_b),
        },
    }
    (OUT / "molecules" / "molecules.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    print("cells (NeuroMorpho.Org):")
    (OUT / "cells").mkdir(parents=True, exist_ok=True)
    for cfg in CELLS:
        (OUT / "cells" / f"{cfg['id']}.json").write_text(
            json.dumps(build_cell(cfg), separators=(",", ":")), encoding="utf-8")
    print("molecules (RCSB PDB):")
    build_molecules()
    print("done ->", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
