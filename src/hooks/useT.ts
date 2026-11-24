import { UI_STRINGS, type UiKey } from '../i18n/strings'
import { useAppStore } from '../store/useAppStore'

export function useT() {
  const lang = useAppStore((s) => s.lang)
  type Fn = (...args: never[]) => string
  const t = ((key: UiKey): string | Fn => {
    const v = (UI_STRINGS[lang] as Record<string, string | Fn>)[key]
    return v ?? key
  }) as {
    (key: 'capturing'): (n: number) => string
    (key: 'quizTitle'): (n: number) => string
    (key: 'tourKicker'): (a: number, b: number) => string
    (key: Exclude<UiKey, 'capturing' | 'quizTitle' | 'tourKicker'>): string
    (key: UiKey): string | Fn
  }
  return { t, lang }
}
