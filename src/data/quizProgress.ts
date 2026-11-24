import type { Lang } from '../i18n/strings'
import type { QuizQ } from './quiz'

/**
 * Quiz progress helpers — pure + storage-safe (memory fallback outside browsers).
 * Best scores are tracked per language so switching EN↔TR never mixes results.
 */

// Spelled without a colon so it also works as a DOM storage key everywhere.
export function bestKeyFor(lang: Lang): string {
  return `tau-quiz-best-${lang}`
}

const mem = new Map<string, string>()

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
  } catch { /* ignore */ }
  return mem.has(key) ? mem.get(key)! : null
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value); return }
  } catch { /* ignore */ }
  mem.set(key, value)
}

export function readBest(lang: Lang): number {
  // One-time migration: an older app version stored a shared key.
  const raw = storageGet(bestKeyFor(lang)) ?? storageGet('tau-quiz-best')
  const n = Number(raw ?? 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function writeBest(lang: Lang, score: number): void {
  const prev = readBest(lang)
  if (score > prev) storageSet(bestKeyFor(lang), String(score))
}

export function missedIds(answers: Record<string, number>, quiz: QuizQ[]): string[] {
  return quiz.filter((q) => answers[q.id] !== undefined && answers[q.id] !== q.answer).map((q) => q.id)
}
