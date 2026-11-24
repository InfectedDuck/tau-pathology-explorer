import { AnimatePresence, motion } from 'framer-motion'
import { Database, X } from 'lucide-react'
import { MODEL_CREDITS, NEUROMORPHO_CITE } from '../../data/credits'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

/** Where every 3D model comes from, with the credit each licence asks for. */
export function CreditsPanel() {
  const { creditsOpen, setCreditsOpen } = useAppStore()
  const { t } = useT()
  const trapRef = useFocusTrap<HTMLDivElement>(creditsOpen)
  return (
    <AnimatePresence>
      {creditsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4"
          style={{ background: 'var(--scrim)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-label={t('creditsTitle')}
          onClick={() => setCreditsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setCreditsOpen(false)
          }}
        >
          <motion.div
            ref={trapRef}
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl max-w-[680px] w-full p-4 sm:p-5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-semibold inline-flex items-center gap-2">
                <Database size={17} aria-hidden /> {t('creditsTitle')}
              </h2>
              <button type="button" aria-label={t('close')} onClick={() => setCreditsOpen(false)} className="btn btn-icon shrink-0">
                <X size={17} aria-hidden />
              </button>
            </div>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
              Cell shapes and molecular structures are real research data. How they are arranged, coloured and animated through
              the disease stages is a teaching model, not patient data; cell counts and percentages are illustrative. The axon
              cutaway is schematic, drawn to realistic proportions. The CA1 neuron’s axon ends where it left the tissue slice.
            </p>
            <ul className="mt-3 space-y-2.5">
              {MODEL_CREDITS.map((c) => (
                <li key={c.what} className="field text-xs leading-relaxed">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <b className="text-[13.5px]">{c.what}</b>
                    <span className="field-label" style={{ color: 'var(--accent)' }}>{c.license}</span>
                  </div>
                  <div style={{ color: 'var(--muted)' }}>{c.where}</div>
                  <div className="mt-1.5">{c.source}</div>
                  <div className="mt-1" style={{ color: 'var(--muted)' }}>{c.cite}</div>
                  <a href={c.url} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: 'var(--accent)' }}>{c.url}</a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {NEUROMORPHO_CITE} Protein structures: RCSB Protein Data Bank (rcsb.org). Models keep their own licences; the
              app’s code does not relicense them. Full details: /models/ATTRIBUTION.md.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
