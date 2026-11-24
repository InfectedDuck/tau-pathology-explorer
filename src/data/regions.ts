export interface RegionInfo {
  id: string
  name: string
  short: string
  func: string
  tauEffect: string
  symptom: string
  stage: string
}

export const REGIONS: Record<string, RegionInfo> = {
  entorhinal: {
    id: 'entorhinal',
    name: 'Entorhinal cortex',
    short: 'EC',
    func: 'Memory gateway between neocortex and hippocampus. Contains grid cells for spatial navigation.',
    tauEffect: 'First tau accumulation. Perforant path weakens, input to hippocampus degrades.',
    symptom: 'Getting lost, misplacing items, subtle new-memory lapses.',
    stage: 'Braak I–II (Early)',
  },
  hippocampus: {
    id: 'hippocampus',
    name: 'Hippocampus',
    short: 'HC',
    func: 'Encodes new episodic memories and consolidates them for long-term storage.',
    tauEffect: 'Tangles fill CA1 pyramidal cells. Volume shrinks visibly, neurogenesis drops.',
    symptom: 'Cannot form new memories, repeats questions, rapid forgetting.',
    stage: 'Braak III–IV (Middle)',
  },
  temporal: {
    id: 'temporal',
    name: 'Temporal lobe',
    short: 'TMP',
    func: 'Language, object recognition, semantic memory and auditory processing.',
    tauEffect: 'Tau spreads laterally. Cortical thinning narrows gyri, synapses prune.',
    symptom: 'Word-finding difficulty, trouble naming objects, misunderstanding speech.',
    stage: 'Braak IV–V (Middle–Late)',
  },
  parietal: {
    id: 'parietal',
    name: 'Parietal lobe',
    short: 'PAR',
    func: 'Attention, visuospatial integration, calculation and praxis.',
    tauEffect: 'Association cortex burden rises. Sulci widen, metabolic drop on PET.',
    symptom: 'Trouble with directions, dressing, calculations, multitasking.',
    stage: 'Braak V (Late)',
  },
  frontal: {
    id: 'frontal',
    name: 'Frontal lobe',
    short: 'FRT',
    func: 'Executive control, planning, judgment, personality and working memory.',
    tauEffect: 'Late neocortical invasion. Networks disconnect, ventricles enlarge.',
    symptom: 'Apathy, poor judgment, disinhibition, loss of initiative.',
    stage: 'Braak V–VI (Late)',
  },
  amygdala: {
    id: 'amygdala',
    name: 'Amygdala',
    short: 'AMY',
    func: 'Almond-shaped threat / emotion hub. Tags memories with fear and salience.',
    tauEffect: 'Tau fills basolateral nuclei early–middle. Fear conditioning and emotional memory distort.',
    symptom: 'Anxiety, agitation, misread social cues, emotional outbursts.',
    stage: 'Braak III–IV (Middle)',
  },
  thalamus: {
    id: 'thalamus',
    name: 'Thalamus',
    short: 'THA',
    func: 'Egg-shaped relay station. Every sense except smell passes through it to cortex.',
    tauEffect: 'Relay neurons desynchronize as cortical input degenerates. Attention gating weakens.',
    symptom: 'Fluctuating attention, slowed responses, sensory blunting.',
    stage: 'Braak IV–V (Middle–Late)',
  },
  hypothalamus: {
    id: 'hypothalamus',
    name: 'Hypothalamus',
    short: 'HYP',
    func: 'Fingertip-sized command center below thalamus. Sleep, hunger, thirst, temperature, hormones.',
    tauEffect: 'Tiny orexin / suprachiasmatic circuits disrupted. HPA axis and circadian rhythms fragment.',
    symptom: 'Sundowning, sleep–wake reversal, appetite and weight change.',
    stage: 'Braak III–V (Middle)',
  },
}
