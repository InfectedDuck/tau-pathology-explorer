import { useT } from '../../hooks/useT'
import { useAppStore, type HighlightKey } from '../../store/useAppStore'

/**
 * Interactive colour key — hover / focus / tap lights up the matching
 * structures in the 3D views (via store.highlight). Tap again to clear.
 */
export function Legend() {
  const { t } = useT()
  const { highlight, setHighlight } = useAppStore()
  const items: { key: HighlightKey; c: string; label: string }[] = [
    { key: 'healthy', c: '#2dd4bf', label: t('legendHealthy') },
    { key: 'early', c: '#e69f00', label: t('legendEarly') },
    { key: 'tangle', c: '#d55e00', label: t('legendTangle') },
    { key: 'transport', c: '#7dd3fc', label: t('legendTransport') },
  ]
  return (
    <div className="legend" role="group" aria-label={t('legendLabel')}>
      {items.map((it) => {
        const on = highlight === it.key
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            title={it.label}
            onMouseEnter={() => setHighlight(it.key)}
            onMouseLeave={() => setHighlight(null)}
            onFocus={() => setHighlight(it.key)}
            onBlur={() => setHighlight(null)}
            onClick={() => setHighlight(on ? null : it.key)}
          >
            <i aria-hidden style={{ background: it.c, boxShadow: on ? `0 0 8px ${it.c}` : undefined }} />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
