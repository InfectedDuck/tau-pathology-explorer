import type { HomeView } from '../viewer/Stage3D'

export const MOLECULE_METERS_PER_UNIT = 1e-8

export const MOLECULE_WIDE_ASPECT = 1.2

export const moleculeHome = (aspect: number): HomeView =>
  aspect > MOLECULE_WIDE_ASPECT
    ? { target: [0, 0, 0], size: [11.6, 7.6], dir: [0.06, 0.3, 1], margin: 1.04 }
    : { target: [0, 0, 0], size: [7.6, 11.6], dir: [0.3, 0.06, 1], margin: 1.04 }
