import { Pause, Play } from 'lucide-react'
import { useEffect } from 'react'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { useAppStore, type StageIndex } from '../../store/useAppStore'
import { GlossText } from './GlossText'

const SPEEDS = [0.5, 1, 2] as const

/** Disease timeline: play / scrub through the four Braak-stage groups. All three boxes follow it. */
export function TimelineDock({ wide }: { wide: boolean }) {
  const { stage, setStage, playing, setPlaying, speed, setSpeed } = useAppStore()
  const { mergedStages } = useMergedContent()
  const { t } = useT()
  const info = mergedStages[stage]

  useEffect(() => {
    if (!playing) return
    const intervalMs = speed === 2 ? 1500 : speed === 0.5 ? 4200 : 2700
    const id = window.setInterval(() => {
      useAppStore.getState().setStage(((useAppStore.getState().stage + 1) % 4) as StageIndex)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [playing, speed])

  return (
    <section aria-label={t('timeline')} className="dock glass">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? t('pause') : t('play')}
        className="dock-play"
      >
        {playing ? <Pause size={19} aria-hidden /> : <Play size={19} aria-hidden className="ml-0.5" />}
      </button>

      <div className="dock-info">
        <div>
          <b className="font-display">{info.label}</b>
          <span>{info.braak}</span>
        </div>
        <p><GlossText text={info.description} /></p>
      </div>

      {wide ? (
        <div className="seg dock-speed" role="group" aria-label={t('speed')}>
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="btn dock-speed"
          aria-label={`${t('speed')}: ${speed}×`}
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        >
          {speed}×
        </button>
      )}

      <div className="dock-track">
        <div className="dock-slider">
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={stage}
            onChange={(e) => setStage(Number(e.target.value) as StageIndex)}
            className="tau-range"
            aria-label="Disease stage slider"
            aria-valuetext={`${info.label}, ${info.braak}`}
          />
        </div>
        <div className="dock-stops" role="tablist" aria-label="Stages">
          {mergedStages.map((s) => (
            <button
              key={s.index}
              type="button"
              role="tab"
              aria-selected={stage === s.index}
              className="stage-tab"
              onClick={() => setStage(s.index)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') setStage(Math.min(3, stage + 1) as StageIndex)
                if (e.key === 'ArrowLeft') setStage(Math.max(0, stage - 1) as StageIndex)
              }}
            >
              <b>{s.label}</b>
              <span>{s.braak}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
