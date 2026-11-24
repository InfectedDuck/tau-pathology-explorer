import { AnimatePresence, motion } from 'framer-motion'
import { MousePointerClick } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

const SEEN_KEY = 'tau-coachmark-seen'

function wasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

/** First-run hint pointing at the tappable 3D parts. Dismisses forever. */
export function Coachmark() {
  const { selection } = useAppStore()
  const [dismissed, setDismissed] = useState(false)
  const { t } = useT()
  const [seen] = useState(wasSeen)
  if (seen || dismissed || selection) return null

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        role="status"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 glass rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl max-w-[92vw]"
      >
        <MousePointerClick size={18} aria-hidden className="shrink-0 opacity-70" />
        <p className="text-xs leading-snug">{t('coachmark')}</p>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-semibold px-4 rounded-lg text-white shrink-0 active:scale-95"
          style={{ background: '#0e7490', minHeight: 44 }}
        >
          {t('gotIt')}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
