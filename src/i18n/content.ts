import { CELL_PARTS } from '../data/cellParts'
import { QUIZ as EN_QUIZ } from '../data/quiz'
import { REGIONS } from '../data/regions'
import { STAGES as EN_STAGES } from '../data/stages'
import { TOUR as EN_TOUR } from '../data/tour'
import type { Lang } from './strings'

const TR_STAGES = [
  { label: 'Sağlıklı', braak: 'Braak 0', description: 'Tau mikrotübülleri stabilize eder. Taşıma hızlı, devreler yoğun, beyin hacmi normal.', cellular: 'Tau mikrotübüllere bağlı • hızlı aksonal taşıma', tissue: 'Yoğun ağ • sakin glia • yumak yok', organ: 'Tau parlaması yok • tam hipokampus hacmi' },
  { label: 'Erken', braak: 'Braak I–II', description: 'Entorinal kortekste hiperfosforile tau ayrışır. Mikrotübüller gevşer, taşıma yavaşlar.', cellular: 'Tau ayrılır • taşıma yavaşlar • tohumlar yayılır', tissue: '~%15 nöron etkilendi • mikroglia alarma geçti', organ: 'Entorinal parlama başlar • bellek geçidi zorlanır' },
  { label: 'Orta', braak: 'Braak III–IV', description: 'Çift helikal filamentler yumak oluşturur. Nöronlar küçülür, glia reaktif olur, hipokampus küçülür.', cellular: 'Filamentler → somada yumak • raylar parçalanır', tissue: '~%40 etkilendi • reaktif glia kümelenir • boşluklar', organ: 'Hipokampus + temporal parlama • incelme başlar' },
  { label: 'İleri', braak: 'Braak V–VI', description: 'Yaygın yumaklar, nöron kaybı, kortikal incelme, genişlemiş ventriküller, neokortikal yetmezlik.', cellular: 'Taşıma durdu • dendritler kayboldu • hücre öldü', tissue: '~%70 kayıp • doku inceldi • bağlantılar seyrek', organ: 'Frontal/parietal parlama • atrofi + ventrikül büyümesi' },
]

const TR_QUIZ = [
  { id: 'q1', q: 'Sağlıklı aksonda tau’nun normal görevi nedir?', options: ['Mikrotübülleri stabilize etmek', 'Amiloid plak yapmak', 'Mikrogliaları öldürmek', 'Nörotransmitterleri engellemek'], answer: 0, explain: 'Tau, motorların kargoyu taşıması için raylara bağlanır.', see: { kind: 'cellPart', id: 'microtubule' } as const, seeStage: 0 as const },
  { id: 'q2', q: 'Hiperfosforilasyon tau’ya ne yapar?', options: ['Bağlanmayı güçlendirir', 'Tau’nun ayrılıp yanlış katlanmasına yol açar', 'Yumakları çözer', 'Dendrit büyütür'], answer: 1, explain: 'Fazla fosfat tau’yu bıraktırır, sonra çift helikal filament olur.', see: { kind: 'cellPart', id: 'tau' } as const, seeStage: 1 as const },
  { id: 'q3', q: 'Braak I–II’de ilk etkilenen bölge hangisidir?', options: ['Frontal lob', 'Entorinal korteks', 'Parietal lob', 'Oksipital lob'], answer: 1, explain: 'Tau önce entorinal kortekste başlar, sonra hipokampus.', see: { kind: 'brainRegion', id: 'entorhinal' } as const, seeStage: 1 as const },
  { id: 'q4', q: 'Bilişsel gerileme ile en iyi ne örtüşür?', options: ['Yalnızca plak sayısı', 'Sinaps kaybı + yumak yükü', 'Beyin ağırlığı', 'Ventrikül rengi'], answer: 1, explain: 'Sinaps kaybı ve Braak evresi semptomları plaklardan iyi yansıtır.', see: { kind: 'cellPart', id: 'synapse' } as const, seeStage: 2 as const },
  { id: 'q5', q: 'Orta-ileri evrede reaktif mikroglia ne yapar?', options: ['Küçük ve sakin kalır', 'Büyür ve hasar etrafında kümelenir', 'Nörona dönüşür', 'Beyni terk eder'], answer: 1, explain: 'Amipsi olur, renk/boyut değiştirir, yumak çevresini sarar.', see: { kind: 'cellPart', id: 'tangle' } as const, seeStage: 2 as const },
]

const TR_TOUR = [
  { title: '1 — Sağlıklı devreler', text: 'Tau (turkuaz) mikrotübül raylarında. Veziküller ve mitokondriler akıyor. Üç panel de yoğun ve sakin.', stage: 0 as const, focus: 'Kutu 1: bağlı tau, hızlı taşıma. Kutu 2: 48/48 sağlıklı. Kutu 3: parlama yok.', sel: { kind: 'cellPart', id: 'tau' } as const },
  { title: '2 — Erken ayrışma (Braak I–II)', text: 'Tau hiperfosforile olup yüzer. Turuncu tohumun sinapsı aşıp komşu nörona geçtiğini izle.', stage: 1 as const, focus: 'Kutu 1: yüzen tau + tohum. Kutu 3: entorinal parlamaya başlar.', sel: { kind: 'cellPart', id: 'synapse' } as const },
  { title: '3 — Filament ve yumaklar (Braak III–IV)', text: 'Tau filament olup somada koyu yumak yapar. Raylar parçalanır. Glia kızarıp toplanır.', stage: 2 as const, focus: 'Kutu 1: yumak + boşluk. Kutu 2: boşluklar. Kutu 3: hipokampus küçülür.', sel: { kind: 'cellPart', id: 'tangle' } as const },
  { title: '4 — Yetmezlik ve atrofi (Braak V–VI)', text: 'Taşıma durur, dendritler solar, nöronlar ölür. Doku incelir, ventriküller şişer, frontal/parietal parlar.', stage: 3 as const, focus: 'Yumak/bölgeye tıkla, yan paneli aç. Karşılaştır modunu dene.', sel: { kind: 'brainRegion', id: 'hippocampus' } as const },
]

export function getStages(lang: Lang) {
  if (lang === 'tr') return EN_STAGES.map((s, i) => ({ ...s, ...TR_STAGES[i] }))
  return EN_STAGES
}

const TR_REGIONS: Record<string, { name: string; func: string; tauEffect: string; symptom: string; stage: string }> = {
  entorhinal: {
    name: 'Entorinal korteks',
    func: 'Neokorteks ile hipokampus arasında bellek geçidi. Mekansal yön bulma için grid hücreleri içerir.',
    tauEffect: 'İlk tau birikimi. Perforan yol zayıflar, hipokampusa giriş bozulur.',
    symptom: 'Kaybolma, eşyaları yanlış yere koyma, hafif yeni bellek aksaklıkları.',
    stage: 'Braak I–II (Erken)',
  },
  hippocampus: {
    name: 'Hipokampus',
    func: 'Yeni epizodik anıları kodlar ve uzun süreli depolama için pekiştirir.',
    tauEffect: 'Yumaklar CA1 piramidal hücreleri doldurur. Hacim gözle görülür küçülür, nörogenez azalır.',
    symptom: 'Yeni anı oluşturamama, soruları tekrarlama, hızlı unutma.',
    stage: 'Braak III–IV (Orta)',
  },
  temporal: {
    name: 'Temporal lob',
    func: 'Dil, nesne tanıma, anlamsal bellek ve işitsel işlem.',
    tauEffect: 'Tau yanal yayılır. Kortikal incelme girusları daraltır, sinapslar budanır.',
    symptom: 'Kelime bulma güçlüğü, nesneleri adlandırmada zorluk, konuşmayı yanlış anlama.',
    stage: 'Braak IV–V (Orta–İleri)',
  },
  parietal: {
    name: 'Parietal lob',
    func: 'Dikkat, görsel-uzamsal bütünleme, hesaplama ve praksis.',
    tauEffect: 'Asosiyasyon korteks yükü artar. Sulkuslar genişler, PET’te metabolik düşüş.',
    symptom: 'Yön bulma, giyinme, hesaplama, çoklu görevde zorluk.',
    stage: 'Braak V (İleri)',
  },
  frontal: {
    name: 'Frontal lob',
    func: 'Yürütücü kontrol, planlama, yargı, kişilik ve çalışma belleği.',
    tauEffect: 'Geç neokortikal istila. Ağlar kopar, ventriküller genişler.',
    symptom: 'Apati, zayıf yargı, disinhibisyon, inisiyatif kaybı.',
    stage: 'Braak V–VI (İleri)',
  },
  amygdala: {
    name: 'Amigdala',
    func: 'Tehdit/duygu merkezi. Anılara korku ve önem etiketi ekler.',
    tauEffect: 'Tau bazolateral çekirdekleri doldurur. Duygusal bellek bozulur.',
    symptom: 'Kaygı, ajitasyon, sosyal ipuçlarını yanlış okuma.',
    stage: 'Braak III–IV (Orta)',
  },
  thalamus: {
    name: 'Talamus',
    func: 'Duyu aktarma istasyonu. Koku dışı tüm duyular buradan kortekse geçer.',
    tauEffect: 'Aktarma nöronları eşzamanını kaybeder, dikkat kapısı zayıflar.',
    symptom: 'Dalgalı dikkat, yavaş yanıt, duyusal küntlük.',
    stage: 'Braak IV–V (Orta–İleri)',
  },
  hypothalamus: {
    name: 'Hipotalamus',
    func: 'Talamus altı komuta merkezi. Uyku, açlık, susuzluk, ısı, hormonlar.',
    tauEffect: 'Oreksin / sirkadiyen devreler bozulur. HPA ekseni ve ritim parçalanır.',
    symptom: 'Sundowning, uyku-uyanıklık tersine dönmesi, iştah değişimi.',
    stage: 'Braak III–V (Orta)',
  },
}

const TR_CELLS: Record<string, { name: string; role: string; wrong: string; clinical: string }> = {
  tau: {
    name: 'Tau proteini',
    role: 'Normalde aksonda mikrotübül raylarına bağlanır ve stabilize eder, rayları düz tutan traversler gibi.',
    wrong: 'Hiperfosforilasyon tau’nun ayrılıp yanlış katlanmasına ve çift helikal filament olarak topaklanmasına yol açar.',
    clinical: 'BOS p-tau temel Alzheimer biyobelirtecidir. Ayrışma yumaklara giden ilk adımdır.',
  },
  microtubule: {
    name: 'Mikrotübül',
    role: 'Vezikül ve mitokondri taşıyan kinezin/dinein motorları için otoyol görevi gören paralel içi boş tüpler.',
    wrong: 'Tau olmadan mikrotübüller parçalanır ve depolimerize olur. Raylar kırılır, kargo durur, akson aç kalır.',
    clinical: 'Taşıma yetmezliği hücre ölümünden önceki erken sinaptik işlev bozukluğunu açıklar.',
  },
  mitochondrion: {
    name: 'Mitokondri',
    role: 'Ateşleme için ATP sağlamak ve kalsiyumu tamponlamak üzere mikrotübüller boyunca sinapslara gider.',
    wrong: 'Taşıma durunca sinapslar enerjisiz kalır, kalsiyum dengesi bozulur, terminaller solar.',
    clinical: 'FDG-PET hipometabolizması hastalardaki bu enerji yetmezliğini yansıtır.',
  },
  synapse: {
    name: 'Sinaps',
    role: 'Akson terminali dendritlerle iletişim kurar. Veziküller bellek kodlaması için nörotransmitter salar.',
    wrong: 'Tau tohumları sinapsı prion benzeri şekilde aşıp sonraki nöronda yanlış katlanmayı tetikleyebilir. Terminaller geri çekilir.',
    clinical: 'Sinaps kaybı bilişsel gerileme ile plaklardan daha iyi örtüşür.',
  },
  tangle: {
    name: 'Nörofibriler yumak',
    role: 'Normal rolü yok — somayı dolduran hiperfosforile tau filamentlerinin patolojik demeti.',
    wrong: 'Yumaklar somayı boğar, organelleri iter, iltihabı tetikler ve ölümden sonra hayalet yumaklara dönüşür.',
    clinical: 'Yumak yükü + Braak evresi demans şiddetini izler. Hayalet yumaklar hücre dışında kalır.',
  },
}

export function getRegions(lang: Lang) {
  if (lang !== 'tr') return REGIONS
  return Object.fromEntries(
    Object.entries(REGIONS).map(([id, r]) => [id, { ...r, ...(TR_REGIONS[id] ?? {}) }]),
  ) as typeof REGIONS
}

export function getCells(lang: Lang) {
  if (lang !== 'tr') return CELL_PARTS
  return Object.fromEntries(
    Object.entries(CELL_PARTS).map(([id, c]) => [id, { ...c, ...(TR_CELLS[id] ?? {}) }]),
  ) as typeof CELL_PARTS
}

export function getQuiz(lang: Lang) {
  return lang === 'tr' ? TR_QUIZ : EN_QUIZ
}

export function getTour(lang: Lang) {
  return lang === 'tr' ? TR_TOUR : EN_TOUR
}
