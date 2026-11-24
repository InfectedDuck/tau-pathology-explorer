export interface StageInfo {
  index: 0 | 1 | 2 | 3
  label: string
  braak: string
  description: string
  cellular: string
  tissue: string
  organ: string
}

export const STAGES: StageInfo[] = [
  {
    index: 0,
    label: 'Healthy',
    braak: 'Braak 0',
    description: 'Tau stabilizes microtubules. Transport is smooth, circuits are dense, brain volume is normal.',
    cellular: 'Tau bound to microtubules • fast axonal transport',
    tissue: 'Dense network • calm glia • no tangles',
    organ: 'No tau glow • full hippocampal volume',
  },
  {
    index: 1,
    label: 'Early',
    braak: 'Braak I–II',
    description: 'Hyperphosphorylated tau detaches in entorhinal cortex. Microtubules loosen, transport slows.',
    cellular: 'Tau detaches • transport slows • seeds spread',
    tissue: '~15% neurons affected • microglia alerted',
    organ: 'Entorhinal glow begins • memory gateway strained',
  },
  {
    index: 2,
    label: 'Middle',
    braak: 'Braak III–IV',
    description: 'Paired helical filaments form tangles. Neurons shrink, glia turn reactive, hippocampus shrinks.',
    cellular: 'Filaments → somatic tangle • tracks fragment',
    tissue: '~40% affected • reactive glia cluster • gaps appear',
    organ: 'Hippocampus + temporal glow • thinning starts',
  },
  {
    index: 3,
    label: 'Late',
    braak: 'Braak V–VI',
    description: 'Widespread tangles, neuron loss, cortical thinning, enlarged ventricles, neocortical failure.',
    cellular: 'Transport stopped • dendrites lost • cell dies',
    tissue: '~70% lost • tissue thins • connections sparse',
    organ: 'Frontal/parietal glow • atrophy + ventricles enlarged',
  },
]
