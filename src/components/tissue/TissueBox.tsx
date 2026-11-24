import { PART_COLOR, TISSUE_PARTS } from '../../data/parts'
import { healthyCountFor, TISSUE_COUNT } from '../../data/tissueStats'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useStageBucket } from '../../lib/smoothStage'
import { useAppStore } from '../../store/useAppStore'
import { LayerToggle, ViewerCard } from '../viewer/ViewerCard'
import { TissueScene } from './TissueScene'
import { TISSUE_HOME, TISSUE_METERS_PER_UNIT } from './tissueView'

/** Box 2 — a slab of hippocampal tissue: neurons, glia, tangles and synapses. */
export function TissueBox({ solo, canExpand }: { solo: boolean; canExpand: boolean }) {
  const { t } = useT()
  const { showNeurons, showGlia, showTangles, showSynapses, toggleTissue } = useAppStore()
  const { mergedCells, mergedStages } = useMergedContent()
  const bucket = useStageBucket(0.25)
  const info = mergedStages[Math.max(0, Math.min(3, Math.round(bucket)))]
  const hidden: Record<string, boolean> = {
    neuron: !showNeurons,
    astrocyte: !showGlia,
    microglia: !showGlia,
    tangle: !showTangles || !showNeurons || bucket < 0.75,
    synapse: !showSynapses || !showNeurons,
  }

  return (
    <ViewerCard
      box="tissue"
      index="02"
      kicker={t('tissueKicker')}
      title={t('tissueTitle')}
      caption={info.tissue}
      source={t('sourceTissue')}
      label={`3D view: ${t('tissueTitle')}`}
      home={TISSUE_HOME}
      minDistance={0.35}
      metersPerUnit={TISSUE_METERS_PER_UNIT}
      solo={solo}
      canExpand={canExpand}
      parts={TISSUE_PARTS.map((id) => ({ id, kind: 'cellPart' as const, label: mergedCells[id]?.short ?? id, color: PART_COLOR[id], dim: hidden[id] }))}
      badge={
        <>
          {t('healthyNeurons')}: <strong>{healthyCountFor(bucket)} / {TISSUE_COUNT}</strong> <span className="opacity-60">{t('illustrative')}</span>
        </>
      }
      layers={
        <>
          <LayerToggle label={t('neurons')} on={showNeurons} onChange={() => toggleTissue('showNeurons')} />
          <LayerToggle label={t('glia')} on={showGlia} onChange={() => toggleTissue('showGlia')} />
          <LayerToggle label={t('tangles')} on={showTangles} onChange={() => toggleTissue('showTangles')} />
          <LayerToggle label={t('synapses')} on={showSynapses} onChange={() => toggleTissue('showSynapses')} />
        </>
      }
      scene={(fixed) => <TissueScene fixedStage={fixed} />}
    />
  )
}
