import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'
import { GlossText } from './GlossText'

export function SidePanel() {
  const { selection, setSelection } = useAppStore()
  const trapRef = useFocusTrap<HTMLElement>(!!selection)
  const { mergedCells, mergedRegions } = useMergedContent()
  const { t } = useT()

  let title = ''
  let body: { label: string; value: string }[] = []

  if (selection?.kind === 'cellPart' && mergedCells[selection.id]) {
    const p = mergedCells[selection.id]
    title = p.name
    body = [
      { label: t('normalRole'), value: p.role },
      { label: t('whatGoesWrong'), value: p.wrong },
      { label: t('clinicalRelevance'), value: p.clinical },
    ]
  } else if (selection?.kind === 'brainRegion' && mergedRegions[selection.id]) {
    const r = mergedRegions[selection.id]
    title = r.name
    body = [
      { label: t('funcLabel'), value: r.func },
      { label: t('tauEffectLabel'), value: r.tauEffect },
      { label: t('symptomLabel'), value: r.symptom },
      { label: t('stageLabel'), value: r.stage },
    ]
  }

  return (
    <AnimatePresence>
      {selection && (
        <motion.aside
          ref={trapRef as React.Ref<HTMLElement>}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          role="dialog"
          aria-modal="false"
          aria-label={title}
          className="fixed z-50 glass overflow-y-auto shadow-2xl rounded-t-2xl inset-x-0 bottom-0 max-h-[85dvh] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:inset-x-auto sm:bottom-auto sm:top-0 sm:right-0 sm:h-full sm:w-[360px] sm:max-h-none sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            {/* grab handle for the mobile bottom sheet */}
            <span aria-hidden className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-current opacity-30" />
            <h2 className="text-base font-bold leading-tight pr-2 pt-1 sm:pt-0">{title}</h2>
            <button
              type="button"
              onClick={() => setSelection(null)}
              aria-label={t('closeDetails')}
              autoFocus
              className="min-w-[44px] min-h-[44px] rounded-lg grid place-items-center glass active:scale-95 shrink-0"
              onKeyDown={(e) => { if (e.key === 'Escape') setSelection(null) }}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {body.map((b) => (
              <div key={b.label} className="rounded-xl p-3.5 border border-current/10" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
                <div className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">{b.label}</div>
                <div className="text-sm mt-1 leading-relaxed"><GlossText text={b.value} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] opacity-60">{t('sideNote')}</p>
          {/* thumb-reach close on mobile */}
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="sm:hidden mt-3 w-full rounded-xl text-sm font-semibold min-h-[48px] text-white active:scale-[.98]"
            style={{ background: '#0e7490' }}
          >
            {t('closeDetails')}
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
