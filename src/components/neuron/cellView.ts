import type { HomeView } from '../viewer/Stage3D'

/** 1 world unit = 100 µm */
export const CELL_SCALE = 0.01

export const CELL_METERS_PER_UNIT = 1e-4

export const CELL_HOME: HomeView = { target: [0, 0, 0], size: [3.9, 9.3], dir: [0.28, 0.04, 1], margin: 1.04 }
