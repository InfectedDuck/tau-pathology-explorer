import { STAGES } from '../data/stages'

export interface StageShot {
  stage: number
  images: string[]
}

function canvasShots(): string[] {
  const out: string[] = []
  try {
    document.querySelectorAll('canvas').forEach((c) => {
      try {
        const url = (c as HTMLCanvasElement).toDataURL('image/png')
        if (url.length > 10000) out.push(url)
      } catch { /* tainted or empty */ }
    })
  } catch { /* ignore */ }
  return out
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function captureAllStages(
  setStage: (n: 0 | 1 | 2 | 3) => void,
  onProgress: (done: number, total: number) => void
): Promise<StageShot[]> {
  const shots: StageShot[] = []
  const prev = new URLSearchParams(window.location.search).get('stage')
  for (let s = 0; s < 4; s++) {
    setStage(s as 0 | 1 | 2 | 3)
    // let smooth damp (~0.08/frame) settle + bloom render
    await wait(1400)
    shots.push({ stage: s, images: canvasShots() })
    onProgress(s + 1, 4)
  }
  try {
    if (prev !== null) {
      const n = Number(prev)
      if (n >= 0 && n <= 3) setStage(n as 0 | 1 | 2 | 3)
    }
  } catch { /* ignore */ }
  return shots
}

export function buildStoryboardHtml(
  shots: StageShot[],
  captions: { label: string; braak: string; cellular: string; tissue: string; organ: string; description: string }[]
): string {
  const rows = shots.map((shot) => {
    const cap = captions[shot.stage] ?? STAGES[shot.stage]
    const imgs = shot.images.map((src, i) => `<img src="${src}" alt="stage ${shot.stage} view ${i + 1}" style="width:100%;border-radius:12px;border:1px solid #334155"/>`).join('')
    return `<section style="margin:0 0 28px 0">
      <h2 style="font-family:sans-serif;margin:0 0 4px 0">${cap.label} • ${cap.braak}</h2>
      <p style="font-family:sans-serif;opacity:.75;margin:0 0 12px 0">${cap.description}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${imgs}</div>
      <ul style="font-family:sans-serif;font-size:14px;line-height:1.5">
        <li><b>Cellular:</b> ${cap.cellular}</li>
        <li><b>Tissue:</b> ${cap.tissue}</li>
        <li><b>Organ:</b> ${cap.organ}</li>
      </ul>
    </section>`
  }).join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Tau Pathology Storyboard</title></head>
  <body style="background:#070b14;color:#e2e8f0;padding:24px;max-width:1000px;margin:0 auto">
  <h1 style="font-family:sans-serif">Tau Pathology Explorer — Storyboard</h1>
  <p style="font-family:sans-serif;opacity:.7">Healthy → Early → Middle → Late. Images captured from live 3D views. For teaching, not clinical data.</p>
  ${rows}
  <footer style="font-family:sans-serif;font-size:12px;opacity:.6">Generated ${new Date().toISOString()} • Braak I–VI: entorhinal → hippocampus → temporal → parietal → frontal</footer>
  </body></html>`
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
