import type { HomeView } from '../viewer/Stage3D'

/** 1 world unit = 100 nm. Schematic, but proportions follow real ultrastructure. */
export const AXON_METERS_PER_UNIT = 1e-7

/** Wide boxes lay the axon on its side so it still fills the frame. */
export const AXON_WIDE_ASPECT = 1.2

export const axonHome = (aspect: number): HomeView =>
  aspect > AXON_WIDE_ASPECT
    ? { target: [3.55, 0, 0], size: [24, 9.4], dir: [0.1, 0.34, 1], margin: 1.02 }
    : { target: [0, -3.55, 0], size: [9.4, 24], dir: [0.34, 0.1, 1], margin: 1.02 }
