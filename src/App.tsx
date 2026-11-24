import { Suspense, lazy, useEffect } from 'react'
import { SceneShell } from './components/scene3d/SceneShell'
import { ContentEditor } from './components/ui/ContentEditor'
import { FpsBadge } from './components/ui/FpsBadge'
import { GuidedTour } from './components/ui/GuidedTour'
import { Header } from './components/ui/Header'
import { Legend } from './components/ui/Legend'
import { QuizPanel } from './components/ui/QuizPanel'
import { ReferencesPanel } from './components/ui/ReferencesPanel'
import { SidePanel } from './components/ui/SidePanel'
import { Coachmark } from './components/ui/Coachmark'
import { TimelineBar } from './components/ui/TimelineBar'
import { GlossText } from './components/ui/GlossText'
import { useDeepLinks } from './hooks/useDeepLinks'
import { useMergedContent } from './hooks/useMergedContent'
import { useSmoothStage } from './hooks/useSmoothStage'
import { useT } from './hooks/useT'
import { api } from './data/api'
import { healthyCountFor } from './data/tissueStats'
import { useAppStore, type StageIndex } from './store/useAppStore'

const CellularView = lazy(() => import('./components/cellular/CellularView').then((m) => ({ default: m.CellularView })))
const TissueViewLazy = lazy(() => import('./components/tissue/TissueView').then((m) => ({ default: m.TissueView })))
const OrganViewLazy = lazy(() => import('./components/organ/OrganView').then((m) => ({ default: m.OrganView })))
const OrganSideRailsLazy = lazy(() => import('./components/organ/OrganSideRails').then((m) => ({ default: m.OrganSideRails })))

// Shared with TissueView via data/tissueStats so the badge matches rendered cells.
function healthyCount(stageFloat: number) {
  return healthyCountFor(stageFloat)
}

function Panel({
  kicker,
  title,
  caption,
  canvasLabel,
  children,
  overlay,
  controls,
}: {
  kicker: string
  title: string
  caption: string
  canvasLabel: string
  children: React.ReactNode
  overlay?: React.ReactNode
  controls?: React.ReactNode
}) {
  const { t } = useT()
  return (
    <section aria-label={title} className="glass rounded-2xl p-3 md:p-4 flex flex-col gap-2">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 font-semibold">{kicker}</div>
        <h2 className="text-base md:text-lg font-bold leading-tight">{title}</h2>
        <p className="text-xs opacity-70 mt-1 min-h-[32px]"><GlossText text={caption} /></p>
      </div>
      <div className="relative">
        <SceneShell label={canvasLabel}>
          <Suspense fallback={null}>{children}</Suspense>
        </SceneShell>
        {overlay}
      </div>
      {controls}
      <p className="text-[11px] opacity-60">{t('dragHint')}</p>    </section>
  )
}

function BrainCompare({ stage }: { stage: number }) {
  const rounded = Math.max(0, Math.min(3, Math.round(stage)))
  const { mergedStages } = useMergedContent()
  const { t } = useT()
  const info = mergedStages[rounded]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="relative">
        <SceneShell label="Healthy brain reference" cameraPosition={[5, 3.5, 6]} compact>
          <Suspense fallback={null}>
            <OrganViewLazy stage={0} />
          </Suspense>
        </SceneShell>
        <span className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-md bg-emerald-600/90 text-white">{t('healthy')}</span>
      </div>
      <div className="relative">
        <SceneShell label={`Affected brain ${info.label}`} cameraPosition={[5, 3.5, 6]} compact>
          <Suspense fallback={null}>
            <OrganViewLazy stage={stage} />
          </Suspense>
        </SceneShell>
        <OrganSideRailsLazy stage={stage} />
        <span className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md bg-orange-600/90 text-white">
          {info.label}
        </span>
      </div>
    </div>
  )
}

function LabelsToggle() {
  const { showBrainLabels, setShowBrainLabels } = useAppStore()
  const { t } = useT()
  return (
    <button
      type="button"
      aria-pressed={showBrainLabels}
      aria-label={t('labels')}
      title={t('labels')}
      onClick={() => setShowBrainLabels(!showBrainLabels)}
      className={`text-xs px-4 rounded-lg border active:scale-95 ${showBrainLabels ? 'text-white border-transparent' : 'glass'}`}
      style={{ ...(showBrainLabels ? { background: '#0e7490' } : undefined), minHeight: 44 }}
    >
      {t('labels')} · 8
    </button>
  )
}

function IsolateToggle() {
  const { isolateOnSelect, setIsolateOnSelect } = useAppStore()
  const { t } = useT()
  return (
    <button
      type="button"
      aria-pressed={isolateOnSelect}
      title={t('isolate')}
      onClick={() => setIsolateOnSelect(!isolateOnSelect)}
      className={`text-xs px-4 rounded-lg border active:scale-95 ${isolateOnSelect ? 'text-white border-transparent' : 'glass'}`}
      style={{ ...(isolateOnSelect ? { background: '#0e7490' } : undefined), minHeight: 44 }}
    >
      {t('isolate')}
    </button>
  )
}

export default function App() {
  const { stage, theme, lang, compare, showNeurons, showGlia, showTangles, showSynapses, toggleTissue } = useAppStore()
  const { mergedStages } = useMergedContent()
  const { t } = useT()
  const smooth = useSmoothStage(stage)
  const rounded = Math.max(0, Math.min(3, Math.round(smooth))) as StageIndex
  const smoothInfo = mergedStages[rounded]
  // bucketed like TissueView so the counter matches the rendered cells
  const healthy = healthyCount(Math.round(smooth * 4) / 4)
  useDeepLinks()

  // One-time boot merge of professor-shared content (local edits always win,
  // offline-safe: api.content() resolves null without a backend).
  useEffect(() => {
    if (!api.base) return
    let cancelled = false
    api.content().then((server) => {
      if (cancelled || !server) return
      const s = useAppStore.getState()
      for (const [k, v] of Object.entries(server)) {
        if (!(k in s.overrides)) s.setOverride(k, String(v))
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ignore */ }
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') useAppStore.getState().setSelection(null)
      else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        useAppStore.getState().setStage((Number(e.key) - 1) as StageIndex)
      } else if (e.key === ' ') {
        e.preventDefault()
        const s = useAppStore.getState()
        s.setPlaying(!s.playing)
      } else if (e.key.toLowerCase() === 'c') {
        const s = useAppStore.getState()
        s.setCompare(!s.compare)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // lightweight progress ping (works offline, persists if API present)
  useEffect(() => {
    try {
      const k = 'tau-progress'
      const prev = JSON.parse(localStorage.getItem(k) || '{"visits":[]}') as { visits: number[] }
      prev.visits.push(stage)
      localStorage.setItem(k, JSON.stringify({ visits: prev.visits.slice(-50) }))
    } catch { /* ignore */ }
    const base = api.base
    if (!base) return
    fetch(`${base}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, ts: Date.now() }),
    }).catch(() => undefined)
  }, [stage])

  return (
    <div className="min-h-full">
      <Header />

      <div aria-live="polite" role="status" className="sr-only">
        {smoothInfo.label}, {smoothInfo.braak}. {smoothInfo.description}
      </div>

      <div className="px-4 md:px-6 pb-3 flex flex-wrap items-center gap-2">
        <Legend />
        <FpsBadge />
      </div>

      <main className="grid gap-3 md:gap-4 px-4 md:px-6 pb-4 grid-cols-1 lg:grid-cols-3">
        <Panel
          kicker={t('cellularKicker')}
          title={t('cellularTitle')}
          caption={smoothInfo.cellular}
          canvasLabel="3D neuron with microtubules, tau, vesicles and tangle — drag to rotate, pinch to zoom"
        >
          <CellularView stage={smooth} />
        </Panel>

        <Panel
          kicker={t('tissueKicker')}
          title={t('tissueTitle')}
          caption={smoothInfo.tissue}
          canvasLabel="3D tissue block with neuron network and glia"
          overlay={
            <div className="absolute top-2 left-2 text-[11px] px-2.5 py-1.5 rounded-lg glass" role="status" aria-live="polite">
              {t('healthyNeurons')}: <strong>{healthy} / 48</strong> <span className="opacity-60">{t('illustrative')}</span>
            </div>
          }
          controls={
            <div className="flex flex-wrap gap-2 mt-1" role="group" aria-label="Tissue visibility toggles">
              {(
                [
                  ['showNeurons', t('neurons'), showNeurons],
                  ['showGlia', t('glia'), showGlia],
                  ['showTangles', t('tangles'), showTangles],
                  ['showSynapses', t('synapses'), showSynapses],
                ] as const
              ).map(([key, label, val]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={val}
                  onClick={() => toggleTissue(key)}
                  className={`text-xs px-4 rounded-lg border active:scale-95 ${val ? 'text-white border-transparent' : 'glass'}`}
                  style={{ ...(val ? { background: '#0e7490' } : undefined), minHeight: 44 }}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <TissueViewLazy stage={smooth} />
        </Panel>

        {compare ? (
          <section aria-label="Whole brain comparison" className="glass rounded-2xl p-3 md:p-4 flex flex-col gap-2 lg:col-span-1 col-span-1">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 font-semibold">{t('organKicker')}</div>
              <h2 className="text-base md:text-lg font-bold leading-tight">{t('organCompareTitle')}</h2>
              <p className="text-xs opacity-70 mt-1 min-h-[32px]">{smoothInfo.organ}</p>
            </div>
            <BrainCompare stage={smooth} />
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <LabelsToggle />
              <IsolateToggle />
            </div>
            <p className="text-[11px] opacity-60">{t('dragHint')}</p>
          </section>
        ) : (
          <Panel
            kicker={t('organKicker')}
            title={t('organTitle')}
            caption={smoothInfo.organ}
            canvasLabel="3D brain with Braak staging glow — pick regions from the side rails"
            overlay={
              <Suspense fallback={null}>
                <OrganSideRailsLazy stage={smooth} />
              </Suspense>
            }
            controls={
              <div className="flex flex-wrap gap-2 mt-1" role="group" aria-label={t('labels')}>
                <LabelsToggle />
                <IsolateToggle />
              </div>
            }
          >
            <OrganViewLazy stage={smooth} />
          </Panel>
        )}
      </main>

      <TimelineBar />
      <Coachmark />
      <SidePanel />
      <GuidedTour />
      <QuizPanel />
      <ContentEditor />
      <ReferencesPanel />

      <footer className="px-4 md:px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-[11px] opacity-60 max-w-[900px]">
        <p>
          Teaching model: tau hyperphosphorylation → detachment → paired filaments → somatic tangles → transport failure →
          synapse loss → gliosis → atrophy along Braak I→VI (entorhinal → hippocampus → amygdala → thalamus → hypothalamus → temporal → parietal → frontal).
          Palette is color-blind safe (Okabe-Ito). Counts and shapes are stylized, not patient data.
          Brain meshes: brain atlas © Z-Anatomy contributors + BodyParts3D/DBCLS, CC BY-SA 4.0 (via brainproject). Neuron meshes: Purkinje cell from Cajal exhibit via NIH 3D, CC-BY-SA; hero neuron by destacados tv via NIH 3D, CC-BY-NC-SA 4.0 (see public/models/ATTRIBUTION.md).
          {api.base ? ` API: ${api.base}` : ' Runs fully offline; set VITE_API_URL to use FastAPI.'}
        </p>
      </footer>
    </div>
  )
}
