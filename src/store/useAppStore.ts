import { create } from 'zustand'

export type StageIndex = 0 | 1 | 2 | 3
export type SelectedKind = 'cellPart' | 'brainRegion' | null
/** Legend-linked 3D highlight, set on legend hover/focus/tap. */
export type HighlightKey = 'healthy' | 'early' | 'tangle' | 'transport'

export interface Selection {
  kind: Exclude<SelectedKind, null>
  id: string
}

interface AppState {
  stage: StageIndex
  setStage: (s: StageIndex) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  speed: 0.5 | 1 | 2
  setSpeed: (s: 0.5 | 1 | 2) => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (t: 'dark' | 'light') => void
  compare: boolean
  setCompare: (c: boolean) => void
  selection: Selection | null
  setSelection: (s: Selection | null) => void
  /** Dim non-selected brain regions when a region is selected (focus mode). */
  isolateOnSelect: boolean
  setIsolateOnSelect: (v: boolean) => void
  /** Transient legend hover highlight consumed by the 3D views. */
  highlight: HighlightKey | null
  setHighlight: (h: HighlightKey | null) => void
  showNeurons: boolean
  showGlia: boolean
  showTangles: boolean
  showSynapses: boolean
  toggleTissue: (key: 'showNeurons' | 'showGlia' | 'showTangles' | 'showSynapses') => void
  showBrainLabels: boolean
  setShowBrainLabels: (v: boolean) => void
  tourOpen: boolean
  setTourOpen: (open: boolean) => void
  tourStep: number
  setTourStep: (n: number) => void
  quizOpen: boolean
  setQuizOpen: (open: boolean) => void
  bloom: boolean
  setBloom: (b: boolean) => void
  quality: 'high' | 'low'
  setQuality: (q: 'high' | 'low') => void
  editorOpen: boolean
  setEditorOpen: (open: boolean) => void
  refsOpen: boolean
  setRefsOpen: (open: boolean) => void
  overrides: Record<string, string>
  setOverride: (key: string, value: string) => void
  resetOverrides: () => void
  lang: 'en' | 'tr'
  setLang: (l: 'en' | 'tr') => void
}

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('tau-overrides') || '{}') as Record<string, string>
  } catch { return {} }
}

function initialLang(): 'en' | 'tr' {
  try {
    const s = localStorage.getItem('tau-lang')
    if (s === 'en' || s === 'tr') return s
  } catch { /* ignore */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) return 'tr'
  } catch { /* ignore */ }
  return 'en'
}

function initialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('tau-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* ignore */ }
  return 'dark'
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true
    if (Math.min(window.innerWidth, window.innerHeight) < 500) return true
    if (window.innerWidth < 768 && 'ontouchstart' in window) return true
  } catch { /* ignore */ }
  return false
}

function initialBloom(): boolean {
  try {
    const saved = localStorage.getItem('tau-bloom')
    if (saved === '0') return false
    if (saved === '1') return true
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  // Bloom + EffectComposer black-screens some mobile GPUs — default off on touch devices.
  if (isMobileDevice()) return false
  return true
}

function initialQuality(): 'high' | 'low' {
  try {
    const saved = localStorage.getItem('tau-quality')
    if (saved === 'high' || saved === 'low') return saved
  } catch { /* ignore */ }
  // Mobile GPUs: start in Eco (no shadows/bloom/transmission) to avoid jank.
  return isMobileDevice() ? 'low' : 'high'
}

export const useAppStore = create<AppState>((set) => ({
  stage: 0,
  setStage: (stage) => set({ stage }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  speed: 1,
  setSpeed: (speed) => set({ speed }),
  theme: initialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('tau-theme', next) } catch { /* ignore */ }
      return { theme: next }
    }),
  setTheme: (theme) => {
    try { localStorage.setItem('tau-theme', theme) } catch { /* ignore */ }
    set({ theme })
  },
  compare: false,
  setCompare: (compare) => set({ compare }),
  selection: null,
  setSelection: (selection) => set({ selection }),
  isolateOnSelect: true,
  setIsolateOnSelect: (isolateOnSelect) => set({ isolateOnSelect }),
  highlight: null,
  setHighlight: (highlight) => set({ highlight }),
  showNeurons: true,
  showGlia: true,
  showTangles: true,
  showSynapses: true,
  toggleTissue: (key) => set((s) => ({ [key]: !s[key] } as Partial<AppState>)),
  showBrainLabels: true,
  setShowBrainLabels: (showBrainLabels) => set({ showBrainLabels }),
  tourOpen: false,
  setTourOpen: (tourOpen) => set({ tourOpen }),
  tourStep: 0,
  setTourStep: (tourStep) => set({ tourStep }),
  quizOpen: false,
  setQuizOpen: (quizOpen) => set({ quizOpen }),
  bloom: initialBloom(),
  setBloom: (bloom) => {
    try { localStorage.setItem('tau-bloom', bloom ? '1' : '0') } catch { /* ignore */ }
    set({ bloom })
  },
  quality: initialQuality(),
  setQuality: (quality) => {
    try { localStorage.setItem('tau-quality', quality) } catch { /* ignore */ }
    set({ quality })
  },
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  refsOpen: false,
  setRefsOpen: (refsOpen) => set({ refsOpen }),
  overrides: loadOverrides(),
  setOverride: (key, value) =>
    set((s) => {
      const next = { ...s.overrides, [key]: value }
      try { localStorage.setItem('tau-overrides', JSON.stringify(next)) } catch { /* ignore */ }
      return { overrides: next }
    }),
  resetOverrides: () => {
    try { localStorage.removeItem('tau-overrides') } catch { /* ignore */ }
    set({ overrides: {} })
  },
  lang: initialLang(),
  setLang: (lang) => {
    try { localStorage.setItem('tau-lang', lang) } catch { /* ignore */ }
    try { document.documentElement.lang = lang } catch { /* ignore */ }
    set({ lang })
  },
}))
