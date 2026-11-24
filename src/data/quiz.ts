import type { Selection, StageIndex } from '../store/useAppStore'

export interface QuizQ {
  id: string
  q: string
  options: string[]
  answer: number
  explain: string
  /** 3D hotspot the "See in 3D" button jumps to, at the most illustrative stage. */
  see: Selection
  seeStage: StageIndex
}

export const QUIZ: QuizQ[] = [
  {
    id: 'q1',
    q: 'What is tau’s normal job in a healthy axon?',
    options: ['Stabilize microtubules', 'Make amyloid plaques', 'Kill microglia', 'Block neurotransmitters'],
    answer: 0,
    explain: 'Tau binds microtubule tracks so kinesin/dynein motors can move cargo smoothly.',
    see: { kind: 'cellPart', id: 'microtubule' },
    seeStage: 0,
  },
  {
    id: 'q2',
    q: 'What does hyperphosphorylation do to tau?',
    options: ['It strengthens binding', 'It makes tau detach and misfold', 'It dissolves tangles', 'It grows dendrites'],
    answer: 1,
    explain: 'Excess phosphate makes tau let go, then it clumps into paired helical filaments.',
    see: { kind: 'cellPart', id: 'tau' },
    seeStage: 1,
  },
  {
    id: 'q3',
    q: 'Which region is hit first in Braak I–II?',
    options: ['Frontal lobe', 'Entorhinal cortex', 'Parietal lobe', 'Occipital lobe'],
    answer: 1,
    explain: 'Tau starts in entorhinal cortex — the memory gateway — before hippocampus.',
    see: { kind: 'brainRegion', id: 'entorhinal' },
    seeStage: 1,
  },
  {
    id: 'q4',
    q: 'What best correlates with cognitive decline?',
    options: ['Plaque count alone', 'Synapse loss + tangle burden', 'Brain weight', 'Ventricle color'],
    answer: 1,
    explain: 'Synapse loss and Braak tangle stage track symptoms better than plaques.',
    see: { kind: 'cellPart', id: 'synapse' },
    seeStage: 2,
  },
  {
    id: 'q5',
    q: 'Reactive microglia in mid-late disease do what?',
    options: ['Stay small and calm', 'Enlarge, cluster around damage', 'Turn into neurons', 'Leave the brain'],
    answer: 1,
    explain: 'They become amoeboid, change color/shape, and surround tangles/debris.',
    see: { kind: 'cellPart', id: 'tangle' },
    seeStage: 2,
  },
]
