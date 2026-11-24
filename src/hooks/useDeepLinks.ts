import { useEffect } from 'react'
import { useAppStore, type BoxId, type BrainView, type NeuronLevel, type StageIndex } from '../store/useAppStore'

const BOXES: BoxId[] = ['neuron', 'tissue', 'brain']
const LEVELS: NeuronLevel[] = ['cell', 'axon', 'molecule']
const VIEWS: BrainView[] = ['glass', 'whole', 'cutaway']

/**
 * Shareable state in the URL — read once on load, rewritten on change:
 * ?stage=0-3&box=neuron|tissue|brain&level=cell|axon|molecule&view=glass|whole|cutaway
 * &x=1 (expanded)&compare=1&theme=dark&bloom=0&quality=low&lang=en&sel=cellPart:tau
 */
export function useDeepLinks() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const s = useAppStore.getState()
      const st = Number(q.get('stage'))
      if (q.has('stage') && st >= 0 && st <= 3) s.setStage(Math.round(st) as StageIndex)
      if (q.get('compare') === '1') s.setCompare(true)
      if (q.get('theme') === 'dark' || q.get('theme') === 'light') s.setTheme(q.get('theme') as 'dark' | 'light')
      if (q.get('bloom') === '0') s.setBloom(false)
      if (q.get('bloom') === '1') s.setBloom(true)
      if (q.get('quality') === 'low' || q.get('quality') === 'high') s.setQuality(q.get('quality') as 'high' | 'low')
      if (q.get('lang') === 'en' || q.get('lang') === 'tr') s.setLang(q.get('lang') as 'en' | 'tr')
      const box = q.get('box') as BoxId | null
      if (box && BOXES.includes(box)) s.setActiveBox(box)
      const level = q.get('level') as NeuronLevel | null
      if (level && LEVELS.includes(level)) s.setNeuronLevel(level)
      const view = q.get('view') as BrainView | null
      if (view && VIEWS.includes(view)) s.setBrainView(view)
      if (q.get('x') === '1') s.setExpanded(true)
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
        q.set('box', s.activeBox)
        if (s.neuronLevel !== 'cell') q.set('level', s.neuronLevel)
        if (s.brainView !== 'cutaway') q.set('view', s.brainView)
        if (s.expanded) q.set('x', '1')
        if (s.compare) q.set('compare', '1')
        q.set('theme', s.theme)
        q.set('bloom', s.bloom ? '1' : '0')
        q.set('quality', s.quality)
        q.set('lang', s.lang)
        if (s.selection) q.set('sel', `${s.selection.kind}:${s.selection.id}`)
        const url = `${window.location.pathname}?${q.toString()}`
        if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url)
      } catch { /* ignore */ }
    })
    return unsub
  }, [])
}

export function shareUrl(): string {
  return window.location.href
}
