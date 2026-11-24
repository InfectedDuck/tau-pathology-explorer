import { AnimatePresence, motion } from 'framer-motion'
import { Hand } from 'lucide-react'
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

/** First-run hint on how to move around the 3D views. Dismisses forever. */
export function Coachmark() {
  const selection = useAppStore((s) => s.selection)
  const tourOpen = useAppStore((s) => s.tourOpen)
  const [dismissed, setDismissed] = useState(false)
  const { t } = useT()
  const [seen] = useState(wasSeen)
  const show = !seen && !dismissed && !selection && !tourOpen

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          role="status"
          className="coach"
        >
          <Hand size={17} aria-hidden className="shrink-0" style={{ color: 'var(--accent)' }} />
          <p>{t('coachmark')}</p>
          <button type="button" onClick={dismiss} className="btn btn-primary shrink-0">
            {t('gotIt')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
