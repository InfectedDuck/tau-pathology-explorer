import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, X, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { PART_COLOR } from '../../data/parts'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import type { UiKey } from '../../i18n/strings'
import { useAppStore, type BoxId, type NeuronLevel, type Selection } from '../../store/useAppStore'
import { GlossText } from './GlossText'

type StepKey = Extract<UiKey, 'zoomAxon' | 'zoomMolecule' | 'zoomFilament' | 'zoomNeuron' | 'zoomTissue'>

/** The next zoom step that makes sense from the selected part: brain -> tissue -> neuron -> axon -> molecules. */
function nextStep(sel: Selection, box: BoxId, level: NeuronLevel, solo: boolean): { label: StepKey; go: () => void } | null {
  const s = useAppStore.getState()
  if (sel.kind === 'brainRegion') {
    return solo ? { label: 'zoomTissue', go: () => { s.setSelection(null); s.setActiveBox('tissue') } } : null
  }
  if (box === 'tissue' && solo && (sel.id === 'neuron' || sel.id === 'tangle')) {
    return { label: 'zoomNeuron', go: () => { s.setNeuronLevel('cell'); s.setSelection(null); s.setActiveBox('neuron') } }
  }
  if (level === 'cell' && sel.id === 'axon') return { label: 'zoomAxon', go: () => { s.setSelection(null); s.setNeuronLevel('axon') } }
  if (level === 'cell' && sel.id === 'tangle') return { label: 'zoomFilament', go: () => { s.setNeuronLevel('molecule'); s.setSelection({ kind: 'cellPart', id: 'phf' }) } }
  if (level === 'axon' && (sel.id === 'microtubule' || sel.id === 'tau')) {
    return { label: 'zoomMolecule', go: () => { s.setNeuronLevel('molecule'); s.setSelection({ kind: 'cellPart', id: sel.id === 'tau' ? 'tau' : 'tubulin' }) } }
  }
  return null
}

/**
 * Explainer for the selected part. Desktop: a side card. Phones: a bottom
 * sheet that peeks over the timeline so the 3D view stays visible, and
 * expands on demand.
 */
export function DetailPanel({ wide, solo }: { wide: boolean; solo: boolean }) {
  const selection = useAppStore((s) => s.selection)
  const setSelection = useAppStore((s) => s.setSelection)
  const activeBox = useAppStore((s) => s.activeBox)
  const level = useAppStore((s) => s.neuronLevel)
  const { mergedCells, mergedRegions } = useMergedContent()
  const { t } = useT()
  const [open, setOpen] = useState(false)

  let title = ''
  let body: { label: string; value: string }[] = []
  let color = '#22d3ee'
  if (selection?.kind === 'cellPart' && mergedCells[selection.id]) {
    const p = mergedCells[selection.id]
    title = p.name
    color = PART_COLOR[selection.id] ?? color
    body = [
      { label: t('normalRole'), value: p.role },
      { label: t('whatGoesWrong'), value: p.wrong },
      { label: t('clinicalRelevance'), value: p.clinical },
    ]
  } else if (selection?.kind === 'brainRegion' && mergedRegions[selection.id]) {
    const r = mergedRegions[selection.id]
    title = r.name
    color = '#fb923c'
    body = [
      { label: t('funcLabel'), value: r.func },
      { label: t('tauEffectLabel'), value: r.tauEffect },
      { label: t('symptomLabel'), value: r.symptom },
      { label: t('stageLabel'), value: r.stage },
    ]
  }
  const shown = selection && title ? selection : null
  const step = shown ? nextStep(shown, activeBox, level, solo) : null
  // on a wide grid the card floats over the far side from the box it describes
  const side = !solo && shown?.kind === 'brainRegion' ? 'left' : 'right'
  const fields = wide || open ? body : body.slice(0, 1)

  return (
    <AnimatePresence>
      {shown && (
        <motion.aside
          key={wide ? 'side' : 'sheet'}
          initial={wide ? { opacity: 0, x: side === 'left' ? -16 : 16 } : { y: 40, opacity: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={wide ? { opacity: 0, x: side === 'left' ? -16 : 16 } : { y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          aria-label={title}
          className={wide ? 'detail detail-side' : 'detail detail-sheet'}
          data-float={wide && !solo ? side : undefined}
          data-open={open}
        >
          {!wide && (
            <button type="button" className="detail-grab" aria-label={open ? t('showLess') : t('showMore')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <span className="sheet-handle" aria-hidden />
            </button>
          )}
          <div className="flex items-start justify-between gap-2">
            <h2 className="detail-title" aria-live="polite">
              <i aria-hidden style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
              {title}
            </h2>
            <div className="flex gap-1.5 shrink-0">
              {!wide && (
                <button type="button" className="btn btn-icon" aria-label={open ? t('showLess') : t('showMore')} onClick={() => setOpen((v) => !v)}>
                  {open ? <ChevronDown size={17} aria-hidden /> : <ChevronUp size={17} aria-hidden />}
                </button>
              )}
              <button type="button" className="btn btn-icon" aria-label={t('closeDetails')} onClick={() => setSelection(null)}>
                <X size={17} aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            {fields.map((b) => (
              <div key={b.label} className="field">
                <div className="field-label">{b.label}</div>
                <div className={`text-[13.5px] mt-1 leading-relaxed ${!wide && !open ? 'line-clamp-2' : ''}`}><GlossText text={b.value} /></div>
              </div>
            ))}
          </div>

          {step && (
            <button type="button" className="btn btn-primary w-full mt-3" onClick={step.go}>
              <ZoomIn size={15} aria-hidden /> {t(step.label)}
            </button>
          )}
          {(wide || open) && <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>{t('sideNote')}</p>}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
