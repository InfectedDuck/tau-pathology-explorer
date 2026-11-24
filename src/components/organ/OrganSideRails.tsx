import { BRAIN_REGION_ORDER, glowFor } from './OrganView'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAppStore } from '../../store/useAppStore'

/**
 * Side-rail region picker — replaces in-canvas word labels.
 * - Desktop (sm+): docks to the left / right edges of the showcase rectangle.
 * - Mobile: horizontal 44px chip bar BELOW the canvas (scrollable, thumb-safe),
 *   so the small 3D view is never covered by overlay buttons.
 */
export function OrganSideRails({ stage }: { stage: number }) {
  const { selection, setSelection, showBrainLabels } = useAppStore()
  const isMobile = useIsMobile()
  if (!showBrainLabels) return null

  const chip = (id: string, label: string, short: string, blurb: string) => {
    const g = glowFor(id, stage)
    const active = selection?.kind === 'brainRegion' && selection.id === id
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        aria-label={`${label} — ${blurb}`}
        title={`${label} — ${blurb}`}
        onClick={() => setSelection({ kind: 'brainRegion', id })}
        className="flex items-center gap-2 text-left rounded-xl px-3 border transition-all shrink-0 active:scale-95"
        style={{
          minHeight: 44,
          background: active
            ? 'rgba(14,116,144,.92)'
            : g > 0.05
              ? `rgba(154,52,18,${Math.min(0.88, 0.55 + g * 0.2)})`
              : 'rgba(7,11,20,.68)',
          borderColor: active ? '#22d3ee' : g > 0.05 ? 'rgba(251,146,60,.7)' : 'rgba(148,163,184,.35)',
          boxShadow: active ? '0 0 0 1px #22d3ee, 0 4px 14px rgba(0,0,0,.4)' : '0 4px 14px rgba(0,0,0,.35)',
          color: '#f1f5f9',
          fontSize: 12,
        }}
      >
        <span
          aria-hidden
          className="shrink-0 inline-grid place-items-center rounded-md font-bold"
          style={{
            width: 30,
            height: 24,
            fontSize: 10,
            background: g > 0.05 ? '#fed7aa' : 'rgba(148,163,184,.25)',
            color: g > 0.05 ? '#7c2d12' : '#e2e8f0',
          }}
        >
          {short}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold leading-tight">{label}</span>
          <span className="block opacity-70 leading-tight" style={{ fontSize: 10 }}>{blurb}</span>
        </span>
        <span
          aria-hidden
          className="shrink-0 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: g > 0.9 ? '#fb923c' : g > 0.05 ? '#fdba74' : 'rgba(148,163,184,.5)',
            boxShadow: g > 0.05 ? '0 0 6px #fb923c' : 'none',
          }}
        />
      </button>
    )
  }

  // Mobile: static chip bar under the canvas — never covers the 3D view.
  if (isMobile) {
    return (
      <div
        className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5"
        role="group"
        aria-label="Brain regions"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
      >
        {BRAIN_REGION_ORDER.map((r) => chip(r.id, r.label, r.short, r.blurb))}
      </div>
    )
  }

  const left = BRAIN_REGION_ORDER.filter((r) => r.side === 'left')
  const right = BRAIN_REGION_ORDER.filter((r) => r.side === 'right')

  const rail = (items: typeof left, edge: 'left' | 'right') => (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${edge === 'left' ? 'left-1.5' : 'right-1.5'} z-20 hidden sm:flex flex-col gap-1.5 max-w-[132px]`}
      role="group"
      aria-label={edge === 'left' ? 'Left brain regions' : 'Right brain regions'}
    >
      {items.map((r) => chip(r.id, r.label, r.short, r.blurb))}
    </div>
  )

  return (
    <>
      {rail(left, 'left')}
      {rail(right, 'right')}
    </>
  )
}
