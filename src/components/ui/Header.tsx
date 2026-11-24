import { Brain, Contrast, GitCompareArrows, GraduationCap, Link2, Map, Moon, Sparkles, Sun, Gauge, Check, Pencil, BookOpen, Clapperboard, Languages, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { shareUrl } from '../../hooks/useDeepLinks'
import { useMergedContent } from '../../hooks/useMergedContent'
import { TOUR } from '../../data/tour'
import { buildStoryboardHtml, captureAllStages, downloadHtml } from '../../hooks/useStoryboard'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

const BTN = 'inline-flex items-center justify-center gap-1.5 text-xs px-3.5 rounded-lg glass active:scale-95'

export function Header() {
  const { theme, toggleTheme, compare, setCompare, setTourOpen, setTourStep, setQuizOpen, bloom, setBloom, quality, setQuality, setEditorOpen, setRefsOpen, lang, setLang } = useAppStore()
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const [boarding, setBoarding] = useState(0)
  const { mergedStages } = useMergedContent()

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy link:', shareUrl())
    }
  }

  const storyboard = async () => {
    if (boarding > 0) return
    setBoarding(1)
    try {
      const shots = await captureAllStages(useAppStore.getState().setStage, (done) => setBoarding(done))
      const html = buildStoryboardHtml(shots, mergedStages)
      downloadHtml('tau-storyboard.html', html)
    } finally {
      setBoarding(0)
    }
  }

  const secondary = (
    <>
      <button type="button" onClick={() => setLang(lang === 'en' ? 'tr' : 'en')} aria-pressed={lang === 'tr'} title="Dil / Language" className={BTN} style={{ minHeight: 44 }}>
        <Languages size={15} aria-hidden /> {lang === 'en' ? 'TR' : 'EN'}
      </button>
      <button type="button" onClick={() => setBloom(!bloom)} aria-pressed={bloom} title="Toggle glow postprocessing" className={BTN} style={{ minHeight: 44 }}>
        <Sparkles size={15} aria-hidden /> {bloom ? t('glowOn') : t('glowOff')}
      </button>
      <button type="button" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} aria-pressed={quality === 'high'} title="Toggle render quality" className={BTN} style={{ minHeight: 44 }}>
        <Gauge size={15} aria-hidden /> {quality === 'high' ? 'High' : 'Eco'}
      </button>
      <button type="button" onClick={share} title="Copy shareable link to this exact view" className={BTN} style={{ minHeight: 44 }}>
        {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />} {copied ? t('copied') : t('share')}
      </button>
      <button type="button" onClick={storyboard} disabled={boarding > 0} title="Capture all 4 stages to a lecture HTML file" className={`${BTN} disabled:opacity-60`} style={{ minHeight: 44 }}>
        <Clapperboard size={15} aria-hidden /> {boarding > 0 ? t('capturing')(boarding) : t('storyboard')}
      </button>
      <button type="button" onClick={() => setEditorOpen(true)} title="Professor mode: edit captions" className={BTN} style={{ minHeight: 44 }}>
        <Pencil size={15} aria-hidden /> {t('edit')}
      </button>
      <button type="button" onClick={() => setRefsOpen(true)} title="References" className={BTN} style={{ minHeight: 44 }}>
        <BookOpen size={15} aria-hidden /> {t('refs')}
      </button>
    </>
  )

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center gap-3 min-h-[44px]">
        <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg,#0e7490,#22d3ee)' }} aria-hidden>
          <Brain color="white" size={22} />
        </div>
        <div>
          <h1 className="text-base md:text-xl font-bold tracking-tight leading-none">Tau Pathology Explorer</h1>
          <p className="text-xs md:text-sm opacity-70">{t('subtitle')}</p>
        </div>
      </div>
      {/* primary actions — always visible, thumb-sized */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setTourStep(0); useAppStore.getState().setSelection(TOUR[0].sel); setTourOpen(true) }}
          className="inline-flex items-center justify-center gap-1.5 text-xs px-3.5 rounded-lg text-white active:scale-95"
          style={{ background: '#0e7490', minHeight: 44 }}
        >
          <Map size={15} aria-hidden /> {t('tour')}
        </button>
        <button type="button" onClick={() => setQuizOpen(true)} className={BTN} style={{ minHeight: 44 }}>
          <GraduationCap size={15} aria-hidden /> {t('quiz')}
        </button>
        <button type="button" onClick={() => setCompare(!compare)} aria-pressed={compare} className={BTN} style={{ minHeight: 44 }}>
          <GitCompareArrows size={15} aria-hidden /> {compare ? t('compareOn') : t('compareOff')}
        </button>
        <button type="button" onClick={toggleTheme} aria-label="Toggle dark and light theme" className={BTN} style={{ minHeight: 44 }}>
          {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
          {theme === 'dark' ? 'Light' : 'Dark'}
          <Contrast size={12} aria-hidden className="opacity-60" />
        </button>
        {/* desktop: all actions inline */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {secondary}
        </div>
        {/* mobile: secondary actions collapse into a disclosure so the header stays 2 rows */}
        <details className="sm:hidden group">
          <summary
            aria-label="More actions"
            className="inline-flex items-center justify-center gap-1.5 text-xs px-3.5 rounded-lg glass cursor-pointer active:scale-95 list-none [&::-webkit-details-marker]:hidden"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <MoreHorizontal size={16} aria-hidden /> More
          </summary>
          <div className="fixed inset-x-3 bottom-3 z-50 glass rounded-2xl p-3 grid grid-cols-2 gap-2 shadow-2xl open:block">
            {secondary}
          </div>
        </details>
      </div>
    </header>
  )
}
