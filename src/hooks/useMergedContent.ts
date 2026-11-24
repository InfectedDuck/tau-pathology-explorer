import { CELL_PARTS } from '../data/cellParts'
import { REGIONS } from '../data/regions'
import type { StageInfo } from '../data/stages'
import { getCells, getRegions, getStages } from '../i18n/content'
import { useAppStore } from '../store/useAppStore'

export function applyOverrides(
  stages: StageInfo[],
  regions: typeof REGIONS,
  cells: typeof CELL_PARTS,
  overrides: Record<string, string>
) {
  const mergedStages = stages.map((s) => {
    const get = (field: keyof StageInfo) => {
      const k = `stage:${s.index}:${field}`
      const v = overrides[k]
      return v !== undefined && v !== '' ? (v as string) : (s[field] as string)
    }
    return {
      ...s,
      description: get('description'),
      cellular: get('cellular'),
      tissue: get('tissue'),
      organ: get('organ'),
    }
  })
  const mergedRegions = Object.fromEntries(
    Object.entries(regions).map(([id, r]) => {
      const rec = r as unknown as Record<string, string>
      const get = (field: string) => overrides[`region:${id}:${field}`] ?? rec[field]
      return [id, { ...r, func: get('func'), tauEffect: get('tauEffect'), symptom: get('symptom') }]
    })
  ) as typeof REGIONS
  const mergedCells = Object.fromEntries(
    Object.entries(cells).map(([id, c]) => {
      const rec = c as unknown as Record<string, string>
      const get = (field: string) => overrides[`cell:${id}:${field}`] ?? rec[field]
      return [id, { ...c, role: get('role'), wrong: get('wrong'), clinical: get('clinical') }]
    })
  ) as typeof CELL_PARTS
  return { mergedStages, mergedRegions, mergedCells }
}

export function useMergedContent() {
  const overrides = useAppStore((s) => s.overrides)
  const lang = useAppStore((s) => s.lang)
  const base = getStages(lang)
  const baseRegions = getRegions(lang)
  const baseCells = getCells(lang)
  return applyOverrides(base, baseRegions, baseCells, overrides)
}
