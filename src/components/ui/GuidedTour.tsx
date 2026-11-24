import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { getTour } from '../../i18n/content'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

/**
 * Four-step guided tour. A bar between the 3D boxes and the timeline — it
 * never covers a box, so each step's hotspot stays in view while you read.
 * Arrow keys page, Esc closes.
 */
export function GuidedTour() {
  const { tourOpen, setTourOpen, tourStep, setTourStep, setStage, setPlaying, lang } = useAppStore()
  const { t } = useT()
  const TOUR = useMemo(() => getTour(lang), [lang])
  const step = TOUR[tourStep] ?? TOUR[0]

  const go = (n: number) => {
    const clamped = Math.max(0, Math.min(TOUR.length - 1, n))
    setTourStep(clamped)
    setStage(TOUR[clamped].stage)
    useAppStore.getState().setSelection(TOUR[clamped].sel)
    setPlaying(false)
  }

  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') go(useAppStore.getState().tourStep + 1)
      else if (e.key === 'ArrowLeft') go(useAppStore.getState().tourStep - 1)
      else if (e.key === 'Escape') setTourOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, TOUR])

  return (
    <AnimatePresence>
      {tourOpen && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          role="dialog"
          aria-modal="false"
          aria-label={t('tourDialog')}
          className="tour-bar"
        >
          <div className="tour-head">
            <div className="field-label" style={{ color: 'var(--accent)' }}>{t('tourKicker')(tourStep + 1, TOUR.length)}</div>
            <h2 className="font-display" aria-live="polite">{step.title}</h2>
          </div>
          <div className="tour-body">
            <p>{step.text}</p>
            <p className="tour-focus">{step.focus}</p>
          </div>
          <div className="tour-nav">
            <button type="button" disabled={tourStep === 0} onClick={() => go(tourStep - 1)} className="btn disabled:opacity-40" aria-label={t('back')}>
              <ChevronLeft size={15} aria-hidden /> <span>{t('back')}</span>
            </button>
            <div
              className="flex gap-1.5"
              role="progressbar"
              aria-valuenow={tourStep + 1}
              aria-valuemin={1}
              aria-valuemax={TOUR.length}
              aria-label={t('tourKicker')(tourStep + 1, TOUR.length)}
            >
              {TOUR.map((_, i) => (
                <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === tourStep ? 18 : 6, background: i <= tourStep ? 'var(--accent)' : 'var(--line-strong)' }} />
              ))}
            </div>
            {tourStep < TOUR.length - 1 ? (
              <button type="button" onClick={() => go(tourStep + 1)} className="btn btn-primary">
                {t('next')} <ChevronRight size={15} aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={() => setTourOpen(false)} className="btn btn-primary">
                {t('finish')}
              </button>
            )}
            <button type="button" aria-label={t('tourClose')} onClick={() => setTourOpen(false)} className="btn btn-icon">
              <X size={17} aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
