import { createContext } from 'react'
import type * as THREE from 'three'

export interface FocusEntry {
  /** world-space point the camera should pivot on */
  position: () => THREE.Vector3
  /** world-space radius that should fit in view */
  radius: () => number
}

/** Per-viewport registry of focusable parts, filled by <Hotspot>. Keys are `kind:id`. */
export interface ViewerRegistry {
  focus: Map<string, FocusEntry>
}

export const ViewerCtx = createContext<ViewerRegistry | null>(null)
