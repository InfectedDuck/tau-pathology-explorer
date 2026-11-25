import { Suspense, lazy, useEffect } from 'react'
import { ContentEditor } from './components/ui/ContentEditor'
import { Coachmark } from './components/ui/Coachmark'
import { BoxTabs } from './components/ui/BoxTabs'
import { CreditsPanel } from './components/ui/CreditsPanel'
import { DetailPanel } from './components/ui/DetailPanel'
import { GuidedTour } from './components/ui/GuidedTour'
import { Header } from './components/ui/Header'
import { QuizPanel } from './components/ui/QuizPanel'
import { ReferencesPanel } from './components/ui/ReferencesPanel'
import { TimelineDock } from './components/ui/TimelineDock'
import { api } from './data/api'
import { boxForSelection, levelForPart } from './data/parts'
import { PROJECT, authorLine } from './data/team'
import { useAutoQuality } from './hooks/useAutoQuality'
import { useDeepLinks } from './hooks/useDeepLinks'
import { useWideLayout } from './hooks/useLayout'
import { useMergedContent } from './hooks/useMergedContent'
import { useT } from './hooks/useT'
import { useAppStore, type BoxId, type StageIndex } from './store/useAppStore'

// each box is its own chunk, so a phone only downloads the one on screen
const NeuronBox = lazy(() => import('./components/neuron/NeuronBox').then((m) => ({ default: m.NeuronBox })))
const TissueBox = lazy(() => import('./components/tissue/TissueBox').then((m) => ({ default: m.TissueBox })))
const BrainBox = lazy(() => import('./components/brain/BrainBox').then((m) => ({ default: m.BrainBox })))

const BOXES: Record<BoxId, typeof NeuronBox> = { neuron: NeuronBox, tissue: TissueBox, brain: BrainBox }

export default function App() {
  const { stage, theme, lang, activeBox, expanded, tourOpen, selection } = useAppStore()
  const { mergedStages } = useMergedContent()
  const { t } = useT()
  const wide = useWideLayout()
  const fps = useAutoQuality()
  const info = mergedStages[stage]
  // one box at a time on small screens, or when a box is expanded on desktop
  const solo = !wide || expanded
  const Active = BOXES[activeBox]
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

  // A selection made anywhere (tour, quiz, shared link, chips) brings its
  // box and zoom level into view.
  useEffect(() => {
    if (!selection) return
    const s = useAppStore.getState()
    if (selection.kind === 'cellPart') {
      const level = levelForPart(selection.id, s.neuronLevel)
      const box = boxForSelection(selection, s.activeBox, s.neuronLevel)
      if (box === 'neuron' && level && level !== s.neuronLevel) s.setNeuronLevel(level)
      if (box !== s.activeBox) s.setActiveBox(box)
    } else if (s.activeBox !== 'brain') {
      s.setActiveBox('brain')
    }
  }, [selection])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useAppStore.getState()
      if (e.key === 'Escape') s.setSelection(null)
      else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') s.setStage((Number(e.key) - 1) as StageIndex)
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        s.setPlaying(!s.playing)
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) s.setCompare(!s.compare)
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
    if (!api.base) return
    fetch(`${api.base}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, ts: Date.now() }),
    }).catch(() => undefined)
  }, [stage])

  return (
    <div className="app" data-layout={wide ? 'wide' : 'compact'} data-tour={tourOpen || undefined}>
      <Header wide={wide} fps={fps} />

      <div aria-live="polite" role="status" className="sr-only">
        {info.label}, {info.braak}. {info.description}
      </div>

      {!wide && <BoxTabs />}
      <Coachmark />

      <main className="stage">
        <Suspense fallback={<div className="flex-1" />}>
          {solo ? (
            <div className="solo" key={activeBox}>
              <Active solo canExpand={wide} />
            </div>
          ) : (
            <div className="grid3">
              <NeuronBox solo={false} canExpand />
              <TissueBox solo={false} canExpand />
              <BrainBox solo={false} canExpand />
            </div>
          )}
        </Suspense>
        {!tourOpen && <DetailPanel wide={wide} solo={solo} />}
      </main>

      <GuidedTour />

      <TimelineDock wide={wide} />

      {wide && (
        <footer className="app-foot">
          <span>
            <b className="app-foot-team">© {PROJECT.year} {authorLine(lang)} · {PROJECT.university}</b>
            <span className="hidden min-[1300px]:inline"> · Teaching model: real cell shapes and protein structures, stylised disease progression. Not patient data.</span>
          </span>
          <button type="button" onClick={() => useAppStore.getState().setCreditsOpen(true)}>{t('credits')}</button>
        </footer>
      )}

      <QuizPanel />
      <ContentEditor />
      <ReferencesPanel />
      <CreditsPanel />
    </div>
  )
}
