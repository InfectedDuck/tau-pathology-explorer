import { CELL_PARTS } from '../data/cellParts'
import { REGIONS } from '../data/regions'
import { STAGES } from '../data/stages'
import { QUIZ } from '../data/quiz'

declare global {
  interface Window {
    __APP_ENV__?: { VITE_API_URL?: string }
  }
}

/**
 * Base-URL precedence: container runtime (`/env.js`, set via
 * `docker run -e VITE_API_URL=…`) wins over the build-time Vite variable.
 * Exported pure for unit tests.
 */
export function resolveApiBase(runtimeUrl: string | undefined, buildUrl: string | undefined): string {
  return `${runtimeUrl || buildUrl || ''}`.replace(/\/$/, '')
}

function runtimeEnvUrl(): string {
  try {
    if (typeof window !== 'undefined') return window.__APP_ENV__?.VITE_API_URL ?? ''
  } catch { /* ignore */ }
  return ''
}

function buildTimeUrl(): string {
  try {
    return (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  } catch { return '' }
}

const BASE = resolveApiBase(runtimeEnvUrl(), buildTimeUrl())

async function get<T>(path: string, fallback: T): Promise<T> {
  if (!BASE) return fallback
  try {
    const ctl = new AbortController()
    const id = window.setTimeout(() => ctl.abort(), 2500)
    const r = await fetch(`${BASE}${path}`, { signal: ctl.signal })
    window.clearTimeout(id)
    if (!r.ok) return fallback
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

export const api = {
  stages: () => get('/api/stages', STAGES),
  regions: () => get('/api/regions', Object.values(REGIONS)),
  cellParts: () => get('/api/cell-parts', Object.values(CELL_PARTS)),
  quiz: () => get('/api/quiz', QUIZ),
  content: () => get<Record<string, string> | null>('/api/content', null),
  base: BASE,
}
