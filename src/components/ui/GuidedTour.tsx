import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { getTour } from '../../i18n/content'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

export function GuidedTour() {
  const { tourOpen, setTourOpen, tourStep, setTourStep, setStage, setPlaying, lang } = useAppStore()
  const { t } = useT()
  const trapRef = useFocusTrap<HTMLDivElement>(tourOpen)
  const TOUR = useMemo(() => getTour(lang), [lang])
  const step = TOUR[tourStep] ?? TOUR[0]

  const go = (n: number) => {
    const clamped = Math.max(0, Math.min(TOUR.length - 1, n))
    setTourStep(clamped)
    const step = TOUR[clamped]
    setStage(step.stage)
    useAppStore.getState().setSelection(step.sel)
    setPlaying(false)
  }

  // Arrow-key paging (ignored while typing in inputs).
  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') go(Math.min(TOUR.length - 1, useAppStore.getState().tourStep + 1))
      else if (e.key === 'ArrowLeft') go(Math.max(0, useAppStore.getState().tourStep - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, TOUR.length])

  return (
    <AnimatePresence>
      {tourOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(2,6,12,.6)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-label={t('tourDialog')}
          onClick={() => setTourOpen(false)}
        >
          <motion.div
            ref={trapRef}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl max-w-[520px] w-full p-4 sm:p-5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider opacity-60">{t('tourKicker')(tourStep + 1, TOUR.length)}</div>
                <h2 className="text-lg font-bold">{step.title}</h2>
              </div>
              <button type="button" aria-label={t('tourClose')} onClick={() => setTourOpen(false)} className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg glass active:scale-95 shrink-0">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm mt-2 leading-relaxed">{step.text}</p>
            <p className="text-xs mt-2 opacity-70">{step.focus}</p>
            <div
              className="mt-3 h-1.5 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={tourStep + 1}
              aria-valuemin={1}
              aria-valuemax={TOUR.length}
              aria-label={t('tourKicker')(tourStep + 1, TOUR.length)}
              style={{ background: 'rgba(148,163,184,.25)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${((tourStep + 1) / TOUR.length) * 100}%`, background: 'linear-gradient(90deg,#0e7490,#22d3ee)' }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 mt-4">
              <button
                type="button"
                disabled={tourStep === 0}
                onClick={() => go(tourStep - 1)}
                className="inline-flex items-center justify-center gap-1 text-xs px-4 rounded-lg glass disabled:opacity-40 active:scale-95"
                style={{ minHeight: 44 }}
              >
                <ChevronLeft size={15} /> {t('back')}
              </button>
              <div className="flex gap-1.5" aria-hidden>
                {TOUR.map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full" style={{ background: i === tourStep ? '#22d3ee' : 'rgba(148,163,184,.4)' }} />
                ))}
              </div>
              {tourStep < TOUR.length - 1 ? (
                <button
                  type="button"
                  onClick={() => go(tourStep + 1)}
                  className="inline-flex items-center justify-center gap-1 text-xs px-4 rounded-lg text-white active:scale-95"
                  style={{ background: '#0e7490', minHeight: 44 }}
                >
                  {t('next')} <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTourOpen(false)}
                  className="text-xs px-4 rounded-lg text-white active:scale-95"
                  style={{ background: '#0e7490', minHeight: 44 }}
                >
                  {t('finish')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
