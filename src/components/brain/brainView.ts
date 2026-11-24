import type { HomeView } from '../viewer/Stage3D'

/** world units for the front-to-back length of the cerebrum */
export const BRAIN_LENGTH = 5.4

export const BRAIN_METERS_PER_UNIT = 0.181 / BRAIN_LENGTH

/** Side-on view of the left hemisphere, front of the brain to the left, as in an anatomy plate. */
export const BRAIN_HOME: HomeView = { target: [0, -0.3, 0], size: [5.9, 4.9], dir: [1, 0.2, 0.34], margin: 1.04 }
