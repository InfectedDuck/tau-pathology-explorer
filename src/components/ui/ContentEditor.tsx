import { AnimatePresence, motion } from 'framer-motion'
import { Download, RotateCcw, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../data/api'
import { useMergedContent } from '../../hooks/useMergedContent'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useAppStore } from '../../store/useAppStore'

/** Must match backend CONTENT_MAXLEN — the server truncates beyond this. */
const SERVER_MAXLEN = 2000

export function ContentEditor() {
  const { editorOpen, setEditorOpen, overrides, setOverride, resetOverrides } = useAppStore()
  const trapRef = useFocusTrap<HTMLDivElement>(editorOpen)
  const { mergedStages } = useMergedContent()
  const [tab, setTab] = useState(0)
  const [msg, setMsg] = useState('')

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tau-content-overrides.json'
    a.click()
  }

  const importJson = (file: File) => {
    file.text().then((t) => {
      try {
        const obj = JSON.parse(t) as Record<string, string>
        Object.entries(obj).forEach(([k, v]) => setOverride(k, String(v)))
        setMsg(`Imported ${Object.keys(obj).length} overrides`)
      } catch { setMsg('Invalid JSON') }
    })
  }

  const pushToApi = async () => {
    if (!api.base) { setMsg('Set VITE_API_URL to push'); return }
    const tooLong = Object.entries(overrides).filter(([, v]) => v.length > SERVER_MAXLEN)
    if (tooLong.length > 0) {
      setMsg(`Warning: ${tooLong.length} value(s) exceed ${SERVER_MAXLEN} chars and will be truncated by the server (e.g. ${tooLong[0][0]}). Shorten or split them first.`)
      return
    }
    try {
      const r = await fetch(`${api.base}/api/content`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overrides) })
      setMsg(r.ok ? 'Pushed to API' : 'Push failed')
    } catch { setMsg('Push failed (offline?)') }
  }

  const pullFromApi = async () => {
    setMsg('Loading shared content…')
    const server = await api.content()
    if (!server) { setMsg(api.base ? 'Pull failed (offline?)' : 'Set VITE_API_URL to pull'); return }
    let added = 0
    for (const [k, v] of Object.entries(server)) {
      // Local edits win — only fill keys this browser hasn't customized.
      if (!(k in overrides)) { setOverride(k, String(v)); added++ }
    }
    setMsg(added > 0 ? `Pulled ${added} shared value(s) (local edits kept)` : 'Already up to date — local edits kept')
  }

  // When the professor opens the editor with a backend configured, fill in
  // shared values once (local edits always win on conflict).
  useEffect(() => {
    if (!editorOpen || !api.base) return
    let cancelled = false
    api.content().then((server) => {
      if (cancelled || !server) return
      const current = useAppStore.getState().overrides
      let added = 0
      for (const [k, v] of Object.entries(server)) {
        if (!(k in current)) { useAppStore.getState().setOverride(k, String(v)); added++ }
      }
      if (added > 0) setMsg(`Loaded ${added} shared value(s) from API (local edits kept)`)
    }).catch(() => undefined)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen])

  return (
    <AnimatePresence>
      {editorOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(2,6,12,.6)', backdropFilter: 'blur(6px)' }}
          role="dialog" aria-modal="true" aria-label="Professor content editor"
          onClick={() => setEditorOpen(false)}>
          <motion.div ref={trapRef} initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl max-w-[640px] w-full p-4 sm:p-5 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Professor mode — edit captions</h2>
                <p className="text-xs opacity-70">Overrides save to this browser + exportable JSON. No code needed.</p>
              </div>
              <button type="button" aria-label="Close editor" onClick={() => setEditorOpen(false)} className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg glass active:scale-95 shrink-0"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1" role="tablist" aria-label="Stage to edit">
              {mergedStages.map((s, i) => (
                <button key={s.index} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
                  className={`text-xs px-4 rounded-lg border shrink-0 active:scale-95 ${tab === i ? 'text-white border-transparent' : 'glass'}`}
                  style={{ ...(tab === i ? { background: '#0e7490' } : undefined), minHeight: 44 }}>{s.label}</button>
              ))}
            </div>
            {(() => {
              const s = mergedStages[tab]
              const fields = [
                ['description', 'Stage description (timeline)'],
                ['cellular', 'Box 1 caption'],
                ['tissue', 'Box 2 caption'],
                ['organ', 'Box 3 caption'],
              ] as const
              return (
                <div className="mt-3 space-y-2.5">
                  {fields.map(([f, label]) => {
                    const key = `stage:${s.index}:${f}`
                    return (
                      <label key={key} className="block">
                        <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">{label}</span>
                        <textarea
                          value={overrides[key] ?? (s[f] as string)}
                          onChange={(e) => setOverride(key, e.target.value)}
                          rows={2}
                          className="mt-1 w-full text-sm rounded-lg p-2 border bg-transparent"
                          style={{ borderColor: 'rgba(148,163,184,.3)' }}
                        />
                      </label>
                    )
                  })}
                </div>
              )
            })()}
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" onClick={exportJson} className="inline-flex items-center justify-center gap-1 text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}><Download size={14} /> Export JSON</button>
              <label className="inline-flex items-center justify-center gap-1 text-xs px-4 rounded-lg glass cursor-pointer active:scale-95" style={{ minHeight: 44 }}>
                <Upload size={14} /> Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f) }} />
              </label>
              <button type="button" onClick={pushToApi} className="text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}>Push to API</button>
              <button type="button" onClick={pullFromApi} className="text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}>Pull from API</button>
              <button type="button" onClick={() => { resetOverrides(); setMsg('Reset to defaults') }} className="inline-flex items-center justify-center gap-1 text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}><RotateCcw size={14} /> Reset</button>
            </div>
            {msg && <p className="text-[11px] mt-2 opacity-70" role="status">{msg}</p>}
            <p className="text-[11px] mt-2 opacity-60">Keys: <code>stage:{'{0-3}'}:{'{description,cellular,tissue,organ}'}</code>, <code>region:{'{id}'}:{'{symptom,...}'}</code>. Advanced: edit JSON directly.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
