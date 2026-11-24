import { useT } from '../../hooks/useT'
import { useAppStore, type BoxId } from '../../store/useAppStore'

const BOXES: { id: BoxId; label: 'boxNeuron' | 'boxTissue' | 'boxBrain'; n: string }[] = [
  { id: 'neuron', label: 'boxNeuron', n: '01' },
  { id: 'tissue', label: 'boxTissue', n: '02' },
  { id: 'brain', label: 'boxBrain', n: '03' },
]

/** Switches which scale box is on screen when only one fits (phones, or an expanded box on desktop). */
export function BoxTabs({ inline = false }: { inline?: boolean }) {
  const { t } = useT()
  const activeBox = useAppStore((s) => s.activeBox)
  const setActiveBox = useAppStore((s) => s.setActiveBox)
  return (
    <div className={`seg box-tabs ${inline ? 'box-tabs-inline' : ''}`} role="tablist" aria-label={t('boxesLabel')}>
      {BOXES.map((b) => (
        <button key={b.id} type="button" role="tab" aria-selected={activeBox === b.id} onClick={() => setActiveBox(b.id)}>
          <span className="num">{b.n}</span>
          {t(b.label)}
        </button>
      ))}
    </div>
  )
}
