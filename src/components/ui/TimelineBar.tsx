import { useEffect } from 'react'
import { Pause, Play } from 'lucide-react'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useAppStore, type StageIndex } from '../../store/useAppStore'
import { GlossText } from './GlossText'

export function TimelineBar() {
  const { stage, setStage, playing, setPlaying, speed, setSpeed } = useAppStore()
  const { mergedStages } = useMergedContent()
  const { t } = useT()
  const info = mergedStages[stage]

  useEffect(() => {
    if (!playing) return
    const intervalMs = speed === 2 ? 1400 : speed === 0.5 ? 4000 : 2500
    const id = window.setInterval(() => {
      const next = ((useAppStore.getState().stage + 1) % 4) as StageIndex
      useAppStore.getState().setStage(next)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [playing, speed])

  return (
    <section aria-label="Disease timeline" className="glass rounded-2xl p-4 md:p-5 mx-4 md:mx-6 mb-4 md:mb-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? t('pause') : t('play')}
            className="w-12 h-12 rounded-full grid place-items-center text-white shrink-0 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0e7490,#0ea5e9)', touchAction: 'manipulation' }}
          >
            {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden className="ml-0.5" />}
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{info.label} <span className="opacity-60 font-normal">• {info.braak}</span></div>
            <div className="text-xs opacity-70 max-w-[560px] leading-snug"><GlossText text={info.description} /></div>
          </div>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t('speed')}>
          {([0.5, 1, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`text-xs px-3 rounded-lg border active:scale-95 ${speed === s ? 'text-white border-transparent' : 'glass'}`}
              style={{ ...(speed === s ? { background: '#0e7490' } : undefined), minHeight: 44, minWidth: 52 }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 py-1">
        <span className="text-[11px] uppercase tracking-wider opacity-60 shrink-0">{t('healthy')}</span>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={stage}
          onChange={(e) => setStage(Number(e.target.value) as StageIndex)}
          className="tau-range flex-1"
          aria-label="Disease stage slider"
          aria-valuetext={`${info.label}, ${info.braak}`}
        />
        <span className="text-[11px] uppercase tracking-wider opacity-60 shrink-0">{t('late')}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Stages">
        {mergedStages.map((s) => (
          <button
            key={s.index}
            role="tab"
            aria-selected={stage === s.index}
            onClick={() => setStage(s.index)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setStage(Math.min(3, stage + 1) as StageIndex)
              if (e.key === 'ArrowLeft') setStage(Math.max(0, stage - 1) as StageIndex)
            }}
            className={`text-left rounded-xl p-3 border text-xs active:scale-[.98] ${stage === s.index ? 'border-cyan-400 bg-cyan-400/10' : 'glass'}`}
            style={{ minHeight: 56 }}
          >
            <div className="font-semibold text-[13px]">{s.label}</div>
            <div className="opacity-60">{s.braak}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
