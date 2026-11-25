import {
  BookOpen, Brain, Check, Clapperboard, Gauge, GitCompareArrows, GraduationCap, Info, Languages, Link2, Map, Menu as MenuIcon, Moon, Pencil, Sparkles, Sun, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { shareUrl } from '../../hooks/useDeepLinks'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useT } from '../../hooks/useT'
import { PROJECT } from '../../data/team'
import { getTour } from '../../i18n/content'
import { buildStoryboardHtml, captureAllStages, downloadHtml } from '../../hooks/useStoryboard'
import { useAppStore } from '../../store/useAppStore'
import { BoxTabs } from './BoxTabs'
import { FpsBadge } from './FpsBadge'
import { Legend } from './Legend'

export function Header({ wide, fps }: { wide: boolean; fps: number }) {
  const {
    theme, toggleTheme, compare, setCompare, setTourOpen, setTourStep, setQuizOpen, bloom, setBloom, quality, setQuality,
    setEditorOpen, setRefsOpen, setCreditsOpen, lang, setLang, menuOpen, setMenuOpen, expanded,
  } = useAppStore()
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const [boarding, setBoarding] = useState(0)
  const { mergedStages } = useMergedContent()

  const share = async () => {
    const url = shareUrl()
    try {
      if (!wide && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Tau Pathology Explorer', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') window.prompt('Copy link:', url)
    }
  }

  const storyboard = async () => {
    if (boarding > 0) return
    setBoarding(1)
    try {
      const shots = await captureAllStages(useAppStore.getState().setStage, (done) => setBoarding(done))
      downloadHtml('tau-storyboard.html', buildStoryboardHtml(shots, mergedStages))
    } finally {
      setBoarding(0)
    }
  }

  const startTour = () => {
    const s = useAppStore.getState()
    const first = getTour(lang)[0]
    setTourStep(0)
    s.setPlaying(false)
    s.setStage(first.stage)
    s.setSelection(first.sel)
    setTourOpen(true)
    setMenuOpen(false)
  }

  // close the menu on Escape / outside press
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-menu]')) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [menuOpen, setMenuOpen])

  const close = (fn: () => void) => () => {
    fn()
    setMenuOpen(false)
  }

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <Brain size={20} />
        </div>
        <div className="min-w-0">
          <h1>Tau Pathology Explorer</h1>
          <p>{PROJECT.university} · {t('subtitle')}</p>
        </div>
      </div>

      {wide && (expanded ? <BoxTabs inline /> : <div className="hidden min-[1500px]:block"><Legend /></div>)}

      <div className="actions">
        {wide && <FpsBadge fps={fps} />}
        <button type="button" className="btn btn-primary" onClick={startTour}>
          <Map size={15} aria-hidden /> {t('tour')}
        </button>
        {wide && (
          <>
            <button type="button" className="btn" onClick={() => setQuizOpen(true)}>
              <GraduationCap size={15} aria-hidden /> {t('quiz')}
            </button>
            <button type="button" className="btn" aria-pressed={compare} title={t('compare')} onClick={() => setCompare(!compare)}>
              <GitCompareArrows size={15} aria-hidden /> <span className="hidden min-[1240px]:inline">{t('compare')}</span>
            </button>
            <button type="button" className="btn btn-icon" aria-label={t('share')} title={t('share')} onClick={share}>
              {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
            </button>
            <button type="button" className="btn btn-icon" aria-label={t('language')} title={t('language')} onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}>
              <span className="text-[11.5px] font-bold">{lang === 'en' ? 'TR' : 'EN'}</span>
            </button>
            <button type="button" className="btn btn-icon" aria-label={t('theme')} title={t('theme')} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-icon"
          data-menu
          aria-label={t('menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={17} aria-hidden /> : <MenuIcon size={17} aria-hidden />}
        </button>
      </div>

      {menuOpen && (
        <>
          {!wide && <div className="menu-scrim" aria-hidden />}
          <div className={wide ? 'menu menu-pop' : 'menu menu-sheet'} data-menu role="menu" aria-label={t('menu')}>
            {!wide && <div className="sheet-handle" aria-hidden />}
            {!wide && (
              <>
                <button type="button" role="menuitem" className="menu-item" onClick={close(() => setQuizOpen(true))}>
                  <GraduationCap size={17} aria-hidden /> {t('quiz')}
                </button>
                <button type="button" role="menuitemcheckbox" aria-checked={compare} className="menu-item" onClick={close(() => setCompare(!compare))}>
                  <GitCompareArrows size={17} aria-hidden /> {t('compare')} <small>{compare ? 'On' : 'Off'}</small>
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={share}>
                  {copied ? <Check size={17} aria-hidden /> : <Link2 size={17} aria-hidden />} {copied ? t('copied') : t('share')}
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}>
                  <Languages size={17} aria-hidden /> {t('language')} <small>{lang === 'en' ? 'English' : 'Türkçe'}</small>
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={toggleTheme}>
                  {theme === 'dark' ? <Moon size={17} aria-hidden /> : <Sun size={17} aria-hidden />} {t('theme')} <small>{theme === 'dark' ? t('themeDark') : t('themeLight')}</small>
                </button>
                <hr />
              </>
            )}
            <button type="button" role="menuitemcheckbox" aria-checked={quality === 'high'} className="menu-item" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}>
              <Gauge size={17} aria-hidden /> {t('quality')} <small>{quality === 'high' ? t('qualityHigh') : t('qualityEco')}</small>
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={bloom} className="menu-item" onClick={() => setBloom(!bloom)}>
              <Sparkles size={17} aria-hidden /> {t('glow')} <small>{bloom ? 'On' : 'Off'}</small>
            </button>
            <hr />
            <button type="button" role="menuitem" className="menu-item" disabled={boarding > 0} onClick={storyboard}>
              <Clapperboard size={17} aria-hidden /> {boarding > 0 ? t('capturing')(boarding) : t('storyboard')}
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={close(() => setEditorOpen(true))}>
              <Pencil size={17} aria-hidden /> {t('edit')}
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={close(() => setRefsOpen(true))}>
              <BookOpen size={17} aria-hidden /> {t('refsTitle')}
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={close(() => setCreditsOpen(true))}>
              <Info size={17} aria-hidden /> {t('credits')}
            </button>
            {!wide && (
              <>
                <hr />
                <div className="px-1 pt-1"><Legend /></div>
              </>
            )}
          </div>
        </>
      )}
    </header>
  )
}
