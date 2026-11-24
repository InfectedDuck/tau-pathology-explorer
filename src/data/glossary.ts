import type { Lang } from '../i18n/strings'

export interface GlossTerm {
  /** Aliases matched case-insensitively; longest wins on overlap. */
  match: string[]
  def: string
}

export const GLOSSARY: Record<Lang, GlossTerm[]> = {
  en: [
    { match: ['Braak stage', 'Braak'], def: 'Post-mortem map (I–VI) of where tau tangles spread, from entorhinal cortex to neocortex.' },
    { match: ['hyperphosphorylation'], def: 'Excess phosphate groups that make tau detach and misfold.' },
    { match: ['paired helical filament'], def: 'Twisted tau strand; the building block of tangles.' },
    { match: ['neurofibrillary tangle', 'tangle'], def: 'Dense bundle of tau filaments choking the neuron’s body.' },
    { match: ['microtubule'], def: 'Hollow tube serving as a cargo highway inside the axon.' },
    { match: ['synapse'], def: 'Junction where one neuron signals the next.' },
    { match: ['microglia'], def: 'The brain’s immune cells; turn reactive and swarm damage.' },
    { match: ['gliosis'], def: 'Reactive scarring response by glial cells.' },
    { match: ['atrophy'], def: 'Tissue shrinkage caused by neuron loss.' },
    { match: ['FDG-PET'], def: 'Brain scan showing where energy use drops.' },
    { match: ['p-tau'], def: 'Phosphorylated tau measured in spinal fluid; a core Alzheimer marker.' },
    { match: ['hippocampus'], def: 'Seahorse-shaped structure that encodes new memories.' },
    { match: ['entorhinal cortex'], def: 'Memory gateway between neocortex and hippocampus; the first region hit by tau.' },
    { match: ['tau'], def: 'Protein that stabilizes microtubule tracks in healthy axons.' },
  ],
  tr: [
    { match: ['Braak evresi', 'Braak'], def: 'Tau yumaklarının entorinal korteksten neokortekse yayılım haritası (I–VI).' },
    { match: ['hiperfosforilasyon'], def: 'Tau’nun ayrılıp yanlış katlanmasına yol açan aşırı fosfat yükü.' },
    { match: ['çift helikal filament', 'helikal filament'], def: 'Bükülmüş tau ipliği; yumakların yapı taşı.' },
    { match: ['nörofibriler yumak', 'yumak'], def: 'Nöron gövdesini boğan yoğun tau filament demeti.' },
    { match: ['mikrotübül'], def: 'Akson içinde kargo otoyolu görevi gören içi boş tüp.' },
    { match: ['sinaps'], def: 'Bir nöronun diğerine sinyal ilettiği bağlantı noktası.' },
    { match: ['mikroglia'], def: 'Beynin bağışıklık hücreleri; hasar çevresinde toplanır.' },
    { match: ['gliozis', 'gliosis'], def: 'Glia hücrelerinin reaktif yara yanıtı.' },
    { match: ['atrofi'], def: 'Nöron kaybına bağlı doku küçülmesi.' },
    { match: ['FDG-PET'], def: 'Enerji kullanımının nerede düştüğünü gösteren beyin taraması.' },
    { match: ['p-tau'], def: 'Beyin omurilik sıvısında ölçülen fosforile tau; temel Alzheimer belirteci.' },
    { match: ['hipokampus', 'hipokampüs'], def: 'Yeni anıları kodlayan denizatı biçimli yapı.' },
    { match: ['entorinal korteks'], def: 'Neokorteks ile hipokampus arasındaki bellek geçidi; tau’nun ilk vurduğu bölge.' },
    { match: ['tau'], def: 'Sağlıklı aksonlarda mikrotübül raylarını stabilize eden protein.' },
  ],
}

export type GlossPart = string | { term: string; def: string }

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split text into plain/glossary spans. Longest match wins at each position,
 * matches never overlap, original casing is preserved.
 */
export function glossParts(text: string, lang: Lang): GlossPart[] {
  if (!text) return [text]
  const terms = GLOSSARY[lang] ?? GLOSSARY.en
  interface Hit { start: number; end: number; term: string; def: string }
  const hits: Hit[] = []
  for (const t of terms) {
    for (const alias of t.match) {
      const re = new RegExp(escapeRegExp(alias), 'gi')
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        hits.push({ start: m.index, end: m.index + m[0].length, term: m[0], def: t.def })
        if (m[0].length === 0) re.lastIndex++
      }
    }
  }
  // earliest start first; at the same start the longest match wins
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const parts: GlossPart[] = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue // overlaps an accepted (longer/earlier) match
    if (h.start > pos) parts.push(text.slice(pos, h.start))
    parts.push({ term: h.term, def: h.def })
    pos = h.end
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return parts.length > 0 ? parts : [text]
}
