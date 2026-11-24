/** The eight teaching regions, in the order tau reaches them. Label geometry is screen-space. */
export interface BrainRegionDef {
  id: string
  /** leader-line direction in degrees (0 = right, 90 = down) and length in px */
  angle: number
  length: number
}

export const BRAIN_REGIONS: BrainRegionDef[] = [
  { id: 'entorhinal', angle: 110, length: 58 },
  { id: 'hippocampus', angle: 70, length: 74 },
  { id: 'amygdala', angle: 40, length: 66 },
  { id: 'thalamus', angle: -140, length: 96 },
  { id: 'hypothalamus', angle: 25, length: 104 },
  { id: 'temporal', angle: 150, length: 54 },
  { id: 'parietal', angle: -120, length: 48 },
  { id: 'frontal', angle: -55, length: 50 },
]

/** Tau glow of a region at a (fractional) stage: 0 = none, ramps up along the Braak sequence. */
export function glowFor(id: string, stage: number): number {
  const s = Math.max(0, Math.min(3, stage))
  const ramp = (start: number, full: number) => Math.max(0, Math.min(1, (s - start) / (full - start)))
  if (id === 'entorhinal') return ramp(0.4, 1.0) * 1.5
  if (id === 'hippocampus') return ramp(1.2, 2.2) * 1.9
  if (id === 'amygdala') return ramp(1.3, 2.3) * 1.5
  if (id === 'thalamus') return ramp(1.7, 2.7) * 1.2
  if (id === 'hypothalamus') return ramp(1.5, 2.5) * 1.35
  if (id === 'temporal') return ramp(1.6, 2.6) * 1.35
  if (id === 'parietal') return ramp(2.1, 3.0) * 1.15
  if (id === 'frontal') return ramp(2.3, 3.0) * 1.05
  return 0
}
