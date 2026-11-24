import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useAppStore } from '../../store/useAppStore'

const REFS = [
  { cite: 'Braak H, Braak E. Neuropathological staging of Alzheimer-related changes. Acta Neuropathol. 1991;82(4):239-259.', note: 'Original Braak I–VI: entorhinal → hippocampus → neocortex.', link: 'https://doi.org/10.1007/BF00308809' },
  { cite: 'Goedert M, Spillantini MG. Propagation of Tau aggregates. Mol Brain. 2017;10:18.', note: 'Prion-like seed spread across synapses — basis for Box 1 transfer.', link: 'https://doi.org/10.1186/s13041-017-0293-7' },
  { cite: 'DeTure MA, Dickson DW. The neuropathological diagnosis of Alzheimer disease. Mol Neurodegener. 2019;14:32.', note: 'Tangles vs plaques: synapse loss tracks cognition best.', link: 'https://doi.org/10.1186/s13024-019-0333-5' },
  { cite: 'Scheff SW et al. Synaptic loss in AD. Neurobiol Aging. 2007 — review.', note: 'Why Box 2 synapse disappearance matters clinically.', link: 'https://doi.org/10.1016/j.neurobiolaging.2006.09.011' },
  { cite: 'Jack CR Jr et al. NIA-AA Research Framework. Alzheimers Dement. 2018.', note: 'AT(N) biomarkers: p-tau, FDG-PET hypometabolism.', link: 'https://doi.org/10.1016/j.jalz.2018.02.018' },
]

export function ReferencesPanel() {
  const { refsOpen, setRefsOpen } = useAppStore()
  const trapRef = useFocusTrap<HTMLDivElement>(refsOpen)
  return (
    <AnimatePresence>
      {refsOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(2,6,12,.6)', backdropFilter: 'blur(6px)' }}
          role="dialog" aria-modal="true" aria-label="References"
          onClick={() => setRefsOpen(false)}>
          <motion.div ref={trapRef} initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl max-w-[600px] w-full p-4 sm:p-5 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold inline-flex items-center gap-2"><BookOpen size={16} /> References for students</h2>
              <button type="button" aria-label="Close references" onClick={() => setRefsOpen(false)} className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg glass active:scale-95 shrink-0"><X size={18} /></button>
            </div>
            <ul className="mt-3 space-y-2.5">
              {REFS.map((r) => (
                <li key={r.cite} className="text-xs leading-relaxed rounded-xl p-3 border" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
                  <div>{r.cite}</div>
                  <div className="opacity-70 mt-1">{r.note}</div>
                  <a href={r.link} target="_blank" rel="noreferrer" className="underline opacity-80 break-all">{r.link}</a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] mt-3 opacity-60">Stylized 3D is illustrative, not to scale. Numbers (48 neurons, % affected) are teaching placeholders.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
