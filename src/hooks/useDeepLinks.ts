import { useEffect } from 'react'
import { useAppStore, type StageIndex } from '../store/useAppStore'

/** ?stage=0-3&compare=1&theme=dark&bloom=0&quality=low&lang=en — read on load, write on change */
export function useDeepLinks() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const s = useAppStore.getState()
      const st = Number(q.get('stage'))
      if (st >= 0 && st <= 3) s.setStage(st as StageIndex)
      if (q.get('compare') === '1') s.setCompare(true)
      if (q.get('theme') === 'dark' || q.get('theme') === 'light') s.setTheme(q.get('theme') as 'dark' | 'light')
      if (q.get('bloom') === '0') s.setBloom(false)
      if (q.get('bloom') === '1') s.setBloom(true)
      if (q.get('quality') === 'low' || q.get('quality') === 'high') s.setQuality(q.get('quality') as 'high' | 'low')
      if (q.get('lang') === 'en' || q.get('lang') === 'tr') s.setLang(q.get('lang') as 'en' | 'tr')
      const sel = q.get('sel')
      if (sel) {
        const [kind, id] = sel.split(':')
        if ((kind === 'cellPart' || kind === 'brainRegion') && id) s.setSelection({ kind, id })
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const unsub = useAppStore.subscribe((s) => {
      try {
        const q = new URLSearchParams()
        q.set('stage', String(s.stage))
        if (s.compare) q.set('compare', '1')
        q.set('theme', s.theme)
        q.set('bloom', s.bloom ? '1' : '0')
        q.set('quality', s.quality)
        q.set('lang', s.lang)
        if (s.selection) q.set('sel', `${s.selection.kind}:${s.selection.id}`)
        const url = `${window.location.pathname}?${q.toString()}`
        window.history.replaceState(null, '', url)
      } catch { /* ignore */ }
    })
    return unsub
  }, [])
}

export function shareUrl(): string {
  return window.location.href
}
