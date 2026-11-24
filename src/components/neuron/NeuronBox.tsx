import { LEVEL_PARTS, NEURON_LEVELS, PART_COLOR } from '../../data/parts'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useStageBucket } from '../../lib/smoothStage'
import { useAppStore, type NeuronLevel } from '../../store/useAppStore'
import type { HomeSpec } from '../viewer/Stage3D'
import { ViewerCard } from '../viewer/ViewerCard'
import { AxonScene } from './AxonScene'
import { AXON_METERS_PER_UNIT, axonHome } from './axonView'
import { CellScene } from './CellScene'
import { CELL_HOME, CELL_METERS_PER_UNIT } from './cellView'
import { MoleculeScene } from './MoleculeScene'
import { MOLECULE_METERS_PER_UNIT, moleculeHome } from './moleculeView'

const LEVELS: Record<NeuronLevel, { home: HomeSpec; meters: number; min: number; title: 'cellTitle' | 'axonTitle' | 'moleculeTitle'; tab: 'levelCell' | 'levelAxon' | 'levelMolecule'; source: 'sourceCell' | 'sourceAxon' | 'sourceMolecule' }> = {
  cell: { home: CELL_HOME, meters: CELL_METERS_PER_UNIT, min: 0.12, title: 'cellTitle', tab: 'levelCell', source: 'sourceCell' },
  axon: { home: axonHome, meters: AXON_METERS_PER_UNIT, min: 1.2, title: 'axonTitle', tab: 'levelAxon', source: 'sourceAxon' },
  molecule: { home: moleculeHome, meters: MOLECULE_METERS_PER_UNIT, min: 0.5, title: 'moleculeTitle', tab: 'levelMolecule', source: 'sourceMolecule' },
}

/** Parts that only exist once disease has started. */
const APPEARS_AT: Record<string, number> = { tangle: 1.5, phosphate: 0.5, phf: 1 }

/** Box 1 — one neuron, with three zoom levels: whole cell, inside the axon, molecules. */
export function NeuronBox({ solo, canExpand }: { solo: boolean; canExpand: boolean }) {
  const { t } = useT()
  const level = useAppStore((s) => s.neuronLevel)
  const setLevel = useAppStore((s) => s.setNeuronLevel)
  const setSelection = useAppStore((s) => s.setSelection)
  const { mergedCells, mergedStages } = useMergedContent()
  const bucket = useStageBucket(0.25)
  const cfg = LEVELS[level]
  const info = mergedStages[Math.max(0, Math.min(3, Math.round(bucket)))]

  return (
    <ViewerCard
      box="neuron"
      index="01"
      kicker={t('cellularKicker')}
      title={t(cfg.title)}
      caption={info.cellular}
      source={t(cfg.source)}
      label={`3D view: ${t(cfg.title)}`}
      home={cfg.home}
      minDistance={cfg.min}
      metersPerUnit={cfg.meters}
      viewKey={level}
      solo={solo}
      canExpand={canExpand}
      parts={LEVEL_PARTS[level].map((id) => ({
        id,
        kind: 'cellPart' as const,
        label: mergedCells[id]?.short ?? id,
        color: PART_COLOR[id],
        dim: (APPEARS_AT[id] ?? 0) > bucket,
      }))}
      switcher={
        <div className="seg seg-dark" role="group" aria-label={t('levelLabel')}>
          {NEURON_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => {
                if (l === level) return
                setSelection(null)
                setLevel(l)
              }}
            >
              {t(LEVELS[l].tab)}
            </button>
          ))}
        </div>
      }
      scene={(fixed) =>
        level === 'cell' ? <CellScene fixedStage={fixed} /> : level === 'axon' ? <AxonScene fixedStage={fixed} /> : <MoleculeScene fixedStage={fixed} />
      }
    />
  )
}
