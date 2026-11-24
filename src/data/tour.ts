import type { Selection, StageIndex } from '../store/useAppStore'

export interface TourStep {
  title: string
  text: string
  stage: StageIndex
  focus: string
  /** 3D hotspot auto-selected (and explained) when the step opens. */
  sel: Selection
}

export const TOUR: TourStep[] = [
  {
    title: '1 — Healthy circuits',
    text: 'Tau (teal) sits on microtubule rails. Vesicles and mitochondria stream. All three panels are dense and calm.',
    stage: 0,
    focus: 'Look at Box 1: tau bound, fast transport. Box 2: 48/48 healthy. Box 3: no glow.',
    sel: { kind: 'cellPart', id: 'tau' },
  },
  {
    title: '2 — Early detachment (Braak I–II)',
    text: 'Tau hyperphosphorylates and floats off. Watch the orange seed hop the synapse to the neighbor neuron.',
    stage: 1,
    focus: 'Box 1: floating tau + seed transfer. Box 3: entorhinal glow starts.',
    sel: { kind: 'cellPart', id: 'synapse' },
  },
  {
    title: '3 — Filaments and tangles (Braak III–IV)',
    text: 'Tau twists into filaments, a dark tangle fills the soma. Tracks fragment. Glia turn red and swarm.',
    stage: 2,
    focus: 'Box 1: tangle + gaps. Box 2: gaps appear. Box 3: hippocampus shrinks.',
    sel: { kind: 'cellPart', id: 'tangle' },
  },
  {
    title: '4 — Failure and atrophy (Braak V–VI)',
    text: 'Transport stops, dendrites wither, neurons die. Tissue thins, ventricles swell, frontal/parietal glow.',
    stage: 3,
    focus: 'Click any tangle or brain region for the side-panel explainer. Try Compare mode.',
    sel: { kind: 'brainRegion', id: 'hippocampus' },
  },
]
