import { useT } from '../../hooks/useT'
import { useAppStore, type HighlightKey } from '../../store/useAppStore'

/**
 * Interactive legend — hover/focus/tap lights up the matching structures
 * in the 3D views (via store.highlight). Touch: tap toggles, tap again clears.
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
    <div className="flex flex-wrap items-center gap-2 text-[11px]" role="group" aria-label={t('legendLabel')}>
      {items.map((it) => {
        const on = highlight === it.key
        return (
          <button
            key={it.label}
            type="button"
            aria-pressed={on}
            title={it.label}
            onMouseEnter={() => setHighlight(it.key)}
            onMouseLeave={() => setHighlight(null)}
            onFocus={() => setHighlight(it.key)}
            onBlur={() => setHighlight(null)}
            onClick={() => setHighlight(on ? null : it.key)}
            className="inline-flex items-center gap-1.5 px-2.5 rounded-lg glass active:scale-95 transition-all"
            style={{
              minHeight: 44,
              outline: on ? '2px solid #22d3ee' : undefined,
              outlineOffset: 1,
              background: on ? 'rgba(14,116,144,.25)' : undefined,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: it.c, boxShadow: on ? `0 0 8px ${it.c}` : undefined }}
              aria-hidden
            />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
