import { Camera, Database, Layers, Maximize2, Minimize2, Minus, Plus, RotateCcw, Tag } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useStageBucket } from '../../lib/smoothStage'
import { useAppStore, type BoxId, type Selection } from '../../store/useAppStore'
import { GlossText } from '../ui/GlossText'
import { Stage3D, type HomeSpec, type RigApi } from './Stage3D'

export interface PartChip {
  id: string
  kind: Selection['kind']
  label: string
  color: string
  /** not present at the current stage (e.g. tangle while healthy) */
  dim?: boolean
}

interface ViewerCardProps {
  box: BoxId
  index: string
  kicker: string
  title: string
  caption: string
  /** where the model comes from; opens the credits */
  source?: string
  /** accessible description of the 3D view */
  label: string
  home: HomeSpec
  minDistance: number
  metersPerUnit: number
  viewKey?: string
  parts: PartChip[]
  /** segmented control shown top-right (zoom level, view mode) */
  switcher?: ReactNode
  /** content of the layers popover */
  layers?: ReactNode
  badge?: ReactNode
  /** this box is shown on its own (phone, or expanded on desktop) */
  solo: boolean
  /** show the expand / collapse control */
  canExpand: boolean
  scene: (fixedStage?: number) => ReactNode
}

const SPLIT_INSETS = { top: 6, bottom: 34 }

/**
 * One "box": a dark specimen window with its title, the list of parts you can
 * jump to, and the viewing tools (zoom, reset, labels, layers, snapshot,
 * expand). In compare mode it splits into healthy vs current stage.
 */
export function ViewerCard({
  box, index, kicker, title, caption, source, label, home, minDistance, metersPerUnit, viewKey, parts, switcher, layers, badge, solo, canExpand, scene,
}: ViewerCardProps) {
  const { t } = useT()
  const selection = useAppStore((s) => s.selection)
  const setSelection = useAppStore((s) => s.setSelection)
  const showLabels = useAppStore((s) => s.showLabels)
  const setShowLabels = useAppStore((s) => s.setShowLabels)
  const compare = useAppStore((s) => s.compare)
  const expanded = useAppStore((s) => s.expanded)
  const setExpanded = useAppStore((s) => s.setExpanded)
  const setActiveBox = useAppStore((s) => s.setActiveBox)
  const setCreditsOpen = useAppStore((s) => s.setCreditsOpen)
  const { mergedStages } = useMergedContent()
  const stageRounded = Math.max(0, Math.min(3, Math.round(useStageBucket(1))))
  const rigA = useRef<RigApi | null>(null)
  const rigB = useRef<RigApi | null>(null)
  const boxRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLElement>(null)
  const footRef = useRef<HTMLElement>(null)
  const [layersOpen, setLayersOpen] = useState(false)
  // how much of the window the title block and the chip row cover, so the camera can frame around them
  const [insets, setInsets] = useState({ top: 104, bottom: 60 })
  // tall box: compare halves stack; wide box: they sit side by side
  const [stacked, setStacked] = useState(true)
  useEffect(() => {
    const measure = () => {
      const top = Math.max(40, (headRef.current?.offsetHeight ?? 126) - 22)
      const bottom = Math.max(36, (footRef.current?.offsetHeight ?? 78) - 18)
      setInsets((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }))
      const el = boxRef.current
      if (el) setStacked(el.clientWidth / Math.max(1, el.clientHeight) < 1.25)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    if (headRef.current) ro.observe(headRef.current)
    if (footRef.current) ro.observe(footRef.current)
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [])

  const split = compare && (solo || box === 'brain')
  const focusKey = selection ? `${selection.kind}:${selection.id}` : null
  const rigs = () => [rigA.current, rigB.current].filter(Boolean) as RigApi[]

  // close the layers popover on outside press / Escape
  useEffect(() => {
    if (!layersOpen) return
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest?.('[data-layers]')) setLayersOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayersOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [layersOpen])

  const snapshot = () => {
    const canvas = boxRef.current?.querySelector('canvas')
    if (!canvas) return
    try {
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `tau-${box}-${mergedStages[stageRounded].label.toLowerCase()}.png`
      a.click()
    } catch { /* ignore */ }
  }

  // on phones the details sheet covers the lower part of the box; keep the subject above it
  const sheet = solo && !canExpand && selection ? 232 : 0
  // stacked compare halves sit between the title block and the chip row, so nothing overlaps them
  const framing = split && stacked ? SPLIT_INSETS : sheet > insets.bottom ? { top: insets.top, bottom: sheet } : insets

  const stage = (fixed: number | undefined, which: 'a' | 'b') => (
    <Stage3D
      label={label}
      home={home}
      minDistance={minDistance}
      metersPerUnit={metersPerUnit}
      viewKey={`${viewKey ?? 'v'}${split ? '-split' : ''}`}
      focusKey={focusKey}
      rigRef={which === 'a' ? rigA : rigB}
      insets={framing}
    >
      {scene(fixed)}
    </Stage3D>
  )

  return (
    <section ref={boxRef} aria-label={title} className="viewer h-full w-full" data-box={box}>
      {split ? (
        <div className="viewer-split" data-stacked={stacked} style={stacked ? { top: insets.top + 10, bottom: insets.bottom + 6 } : undefined}>
          <div>
            {stage(0, 'a')}
            <span className="split-tag" style={{ background: '#2dd4bf' }}>{t('healthy')}</span>
          </div>
          <div>
            {stage(undefined, 'b')}
            <span className="split-tag" style={{ background: '#fb923c' }}>{mergedStages[stageRounded].label}</span>
          </div>
        </div>
      ) : (
        stage(undefined, 'a')
      )}

      <header ref={headRef} className="viewer-head">
        <div className="min-w-0">
          <div className="viewer-kicker"><b>{index}</b>{kicker}</div>
          <h2 className="viewer-title">{title}</h2>
          <p className="viewer-caption"><GlossText text={caption} /></p>
          {source && (
            <button type="button" className="viewer-source" onClick={() => setCreditsOpen(true)}>
              <Database size={11} aria-hidden /> {source}
            </button>
          )}
          {badge && (
            <div>
              <span className="viewer-badge" role="status" aria-live="polite">{badge}</span>
            </div>
          )}
        </div>
        {switcher && <div className="shrink-0">{switcher}</div>}
      </header>

      <div className="viewer-tools" role="toolbar" aria-label={t('viewTools')}>
        <button type="button" className="tool" aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => rigs().forEach((r) => r.zoomBy(0.6))}>
          <Plus size={17} aria-hidden />
        </button>
        <button type="button" className="tool" aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => rigs().forEach((r) => r.zoomBy(1.65))}>
          <Minus size={17} aria-hidden />
        </button>
        <button type="button" className="tool" aria-label={t('resetView')} title={t('resetView')} onClick={() => rigs().forEach((r) => r.reset())}>
          <RotateCcw size={16} aria-hidden />
        </button>
        <span className="tool-sep" aria-hidden />
        <button type="button" className="tool" aria-pressed={showLabels} aria-label={t('labels')} title={t('labels')} onClick={() => setShowLabels(!showLabels)}>
          <Tag size={16} aria-hidden />
        </button>
        {layers && (
          <button
            type="button"
            className="tool"
            data-layers
            aria-pressed={layersOpen}
            aria-label={t('layers')}
            title={t('layers')}
            onClick={() => setLayersOpen((v) => !v)}
          >
            <Layers size={16} aria-hidden />
          </button>
        )}
        <button type="button" className="tool" aria-label={t('snapshot')} title={t('snapshot')} onClick={snapshot}>
          <Camera size={16} aria-hidden />
        </button>
        {canExpand && (
          <button
            type="button"
            className="tool"
            aria-pressed={expanded}
            aria-label={expanded ? t('collapse') : t('expand')}
            title={expanded ? t('collapse') : t('expand')}
            onClick={() => {
              setActiveBox(box)
              setExpanded(!expanded)
            }}
          >
            {expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          </button>
        )}
      </div>

      {layers && layersOpen && (
        <div className="viewer-pop" data-layers role="group" aria-label={t('layers')}>
          <h3>{t('layers')}</h3>
          {layers}
        </div>
      )}

      <footer ref={footRef} className="viewer-foot">
        <div className="chip-row" role="group" aria-label={t('partsLabel')}>
          {parts.map((p) => {
            const on = selection?.kind === p.kind && selection.id === p.id
            return (
              <button
                key={`${p.kind}:${p.id}`}
                type="button"
                className="chip"
                aria-pressed={on}
                data-dim={p.dim || undefined}
                style={{ ['--c' as string]: p.color }}
                onClick={() => setSelection(on ? null : { kind: p.kind, id: p.id })}
              >
                <i aria-hidden />
                {p.label}
              </button>
            )
          })}
        </div>
      </footer>
    </section>
  )
}

/** Toggle row for the layers popover. */
export function LayerToggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" className="check" aria-pressed={on} onClick={onChange}>
      <span>{label}</span>
      <span className="sw" aria-hidden />
    </button>
  )
}
