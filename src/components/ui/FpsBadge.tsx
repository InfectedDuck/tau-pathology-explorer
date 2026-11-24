import { useAppStore } from '../../store/useAppStore'

/** Small frame-rate readout for wide screens. The watchdog itself lives in hooks/useAutoQuality. */
export function FpsBadge({ fps }: { fps: number }) {
  const quality = useAppStore((s) => s.quality)
  return (
    <span
      className="hidden xl:inline-flex items-center gap-1.5 text-[11px] tabular-nums"
      style={{ color: 'var(--muted)' }}
      role="status"
      aria-label={`Frames per second ${fps}, quality ${quality}`}
      title="Measured frame rate. Quality drops to Eco automatically if it stays low."
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fps >= 45 ? '#009e73' : fps >= 28 ? '#e69f00' : '#d55e00' }} aria-hidden />
      {fps} fps
    </span>
  )
}
