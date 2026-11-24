import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useStageBucket } from '../../lib/smoothStage'
import { useAppStore, type BrainLayer, type BrainView } from '../../store/useAppStore'
import { LayerToggle, ViewerCard } from '../viewer/ViewerCard'
import { BrainScene } from './BrainScene'
import { BRAIN_HOME, BRAIN_METERS_PER_UNIT } from './brainView'
import { BRAIN_REGIONS, glowFor } from './regions'

const VIEWS: { id: BrainView; label: 'viewGlass' | 'viewWhole' | 'viewCutaway' }[] = [
  { id: 'cutaway', label: 'viewCutaway' },
  { id: 'glass', label: 'viewGlass' },
  { id: 'whole', label: 'viewWhole' },
]
const LAYERS: { id: BrainLayer; label: 'layerHindbrain' | 'layerVentricles' | 'layerVessels' | 'layerTracts' | 'layerNerves' }[] = [
  { id: 'hindbrain', label: 'layerHindbrain' },
  { id: 'ventricles', label: 'layerVentricles' },
  { id: 'vessels', label: 'layerVessels' },
  { id: 'tracts', label: 'layerTracts' },
  { id: 'nerves', label: 'layerNerves' },
]

/** Box 3 — the whole brain with the eight teaching regions and optional anatomical layers. */
export function BrainBox({ solo, canExpand }: { solo: boolean; canExpand: boolean }) {
  const { t } = useT()
  const { brainView, setBrainView, brainLayers, toggleBrainLayer, isolateOnSelect, setIsolateOnSelect } = useAppStore()
  const { mergedRegions, mergedStages } = useMergedContent()
  const bucket = useStageBucket(0.25)
  const info = mergedStages[Math.max(0, Math.min(3, Math.round(bucket)))]

  return (
    <ViewerCard
      box="brain"
      index="03"
      kicker={t('organKicker')}
      title={t('organTitle')}
      caption={info.organ}
      source={t('sourceBrain')}
      label={`3D view: ${t('organTitle')}`}
      home={BRAIN_HOME}
      minDistance={0.6}
      metersPerUnit={BRAIN_METERS_PER_UNIT}
      viewKey="brain"
      solo={solo}
      canExpand={canExpand}
      parts={BRAIN_REGIONS.map((def) => ({
        id: def.id,
        kind: 'brainRegion' as const,
        label: mergedRegions[def.id]?.name ?? def.id,
        // orange once tau has reached the region at this stage
        color: glowFor(def.id, bucket) > 0.05 ? '#fb923c' : '#9bdcf5',
      }))}
      switcher={
        <div className="seg seg-dark" role="group" aria-label={t('brainViewLabel')}>
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={brainView === v.id} onClick={() => setBrainView(v.id)}>
              {t(v.label)}
            </button>
          ))}
        </div>
      }
      layers={
        <>
          {LAYERS.map((l) => (
            <LayerToggle key={l.id} label={t(l.label)} on={brainLayers[l.id]} onChange={() => toggleBrainLayer(l.id)} />
          ))}
          <LayerToggle label={t('isolate')} on={isolateOnSelect} onChange={() => setIsolateOnSelect(!isolateOnSelect)} />
        </>
      }
      scene={(fixed) => <BrainScene fixedStage={fixed} />}
    />
  )
}
