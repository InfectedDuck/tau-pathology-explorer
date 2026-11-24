/**
 * Teaching-region → atlas node-id mapping, verified against
 * public/models/brain-atlas/manifest.json (GLB bx_id == manifest id).
 * See regionNodes.test.ts — the contract test reads the real manifest.
 */
export const REGION_NODES: Record<string, number[]> = {
  frontal: [155, 156, 157, 158, 208, 209, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 261, 262, 284, 285, 297, 298, 303, 304, 305, 306, 307, 308, 319, 320, 321, 322, 335, 336, 359, 360, 361, 362, 399, 400, 407, 408],
  parietal: [11, 12, 269, 270, 286, 287, 301, 302, 314, 315, 371, 372, 386, 387],
  temporal: [143, 144, 169, 170, 212, 213, 229, 230, 299, 300, 380, 381, 382, 383, 390, 391, 392, 393, 405, 406],
  entorhinal: [190, 191],
  hippocampus: [122, 123],
  amygdala: [39, 40, 54, 55, 77, 78, 165, 166],
  thalamus: [24, 25, 153, 154, 161, 162, 186, 187, 194, 195, 290, 291, 421, 422, 423, 424, 425, 426],
  hypothalamus: [10, 19, 20, 163, 164, 182, 183, 218, 278, 279, 288, 289, 414, 415],
}
