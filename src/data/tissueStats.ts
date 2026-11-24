import { lerp4 } from '../hooks/useSmoothStage'

/**
 * Single source of truth for the tissue-box teaching model.
 * App.healthyCount duplicated this logic inline; both now share it so the
 * counter badge and the rendered cells can never diverge.
 */
export const TISSUE_COUNT = 48
export const AFFECTED_RATIOS: [number, number, number, number] = [0, 0.15, 0.42, 0.72]

/** Deterministic hash — stable cell layout across renders. */
export function pseudo(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Bucketed stage (quantized) drives topology; smooth stage drives opacity/scale. */
export function bucketOf(stage: number): number {
  return Math.round(stage * 4) / 4
}

export function affectedRatioFor(stageFloat: number): number {
  return lerp4(AFFECTED_RATIOS, stageFloat)
}

/** Number of healthy (unaffected) cells at a given stage — mirrors TissueView. */
export function healthyCountFor(stageFloat: number): number {
  const ratio = affectedRatioFor(stageFloat)
  let healthy = 0
  for (let i = 0; i < TISSUE_COUNT; i++) {
    if (!(pseudo(i, 9) < ratio)) healthy++
  }
  return healthy
}
