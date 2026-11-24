import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Structural data derived from RCSB PDB entries by scripts/build_models.py
 * (all coordinates in angstrom, Y = filament / microtubule axis):
 *  - microtubule lattice parameters + tubulin frame       (6DPV)
 *  - tau backbone bound along one protofilament           (7PQC)
 *  - one rung of the Alzheimer paired helical filament    (5O3L)
 */
export interface MoleculesJson {
  unit: string
  microtubule: {
    protofilaments: number
    /** rotation about +Y between neighbouring protofilaments (three.js sign) */
    lateralAngle: number
    /** axial stagger between neighbouring protofilaments (3-start helix) */
    lateralRise: number
    dimerRise: number
    radius: number
    /** radial correction applied to the 14-protofilament source frame */
    radiusShift: number
    alphaCenter: number[]
    betaCenter: number[]
  }
  tauOnMicrotubule: { firstResidue: number; ca: number[]; phosphoSites: number[] }
  phf: { firstResidue: number; rungTwist: number; rungRise: number; chainA: number[]; chainB: number[] }
}

export const TUBULIN_URL = '/models/molecules/tubulin.glb'

let cached: Promise<MoleculesJson> | null = null

export function loadMolecules(): Promise<MoleculesJson> {
  if (!cached) {
    cached = fetch('/models/molecules/molecules.json').then((r) => {
      if (!r.ok) throw new Error(`molecules: HTTP ${r.status}`)
      return r.json() as Promise<MoleculesJson>
    })
  }
  return cached
}

export function toPoints(flat: number[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < flat.length; i += 3) out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]))
  return out
}

/** Smooth tube through C-alpha positions ("worm" backbone trace). */
export function backboneTube(points: THREE.Vector3[], radius: number, perResidue: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  return new THREE.TubeGeometry(curve, Math.max(8, Math.round(points.length * perResidue)), radius, radial, false)
}

/** One rung of the paired helical filament: two C-shaped tau molecules back to back. */
export function phfRungGeometry(mol: MoleculesJson, radius: number, perResidue: number, radial: number): THREE.BufferGeometry {
  const a = backboneTube(toPoints(mol.phf.chainA), radius, perResidue, radial)
  const b = backboneTube(toPoints(mol.phf.chainB), radius, perResidue, radial)
  const merged = mergeGeometries([a, b])
  a.dispose()
  b.dispose()
  return merged
}

/** Axial offset (angstrom) of protofilament `pf`, wrapped so tube ends stay within one dimer. */
export function protofilamentOffset(mol: MoleculesJson, pf: number): number {
  const { lateralRise, dimerRise } = mol.microtubule
  const y = pf * lateralRise
  return y - Math.floor(y / dimerRise) * dimerRise
}

/**
 * Placement of the dimer at (protofilament, row) in the 13-protofilament
 * lattice. `peel` (0..1) bends the subunit outward like a fraying end.
 */
export function latticeMatrix(mol: MoleculesJson, pf: number, y: number, out: THREE.Matrix4, peel = 0, scale = 1): THREE.Matrix4 {
  const mt = mol.microtubule
  // subunit centre in the source frame: tilt and scale pivot here
  const c = mt.radius - mt.radiusShift
  out.makeRotationY(pf * mt.lateralAngle).multiply(_m1.makeTranslation(mt.radiusShift + c + peel * peel * 70, y + peel * 18, 0))
  if (peel > 0) out.multiply(_m1.makeRotationZ(-peel * 0.95))
  if (scale !== 1) out.multiply(_m1.makeScale(scale, scale, scale))
  return out.multiply(_m1.makeTranslation(-c, 0, 0))
}

const _m1 = new THREE.Matrix4()
