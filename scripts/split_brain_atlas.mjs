// Splits the full brain atlas into the two files the app loads, and thins out
// the densest meshes so integrated GPUs and phones keep a smooth frame rate.
//
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf meshoptimizer
//   node scripts/split_brain_atlas.mjs models-src/brain-atlas-full.glb public/models/brain-atlas
//
// Source: Z-Anatomy / BodyParts3D atlas (CC BY-SA 4.0), see public/models/ATTRIBUTION.md.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { draco, prune, simplifyPrimitive, weldPrimitive } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptSimplifier } from 'meshoptimizer'

const [, , input, outDir] = process.argv
if (!input || !outDir) {
  console.error('usage: node scripts/split_brain_atlas.mjs <full.glb> <outDir>')
  process.exit(1)
}

/** category -> fraction of triangles to keep (1 = untouched) */
const CORE = { cortex: 1, deep_grey: 1, diencephalon: 1, ventricles: 1, cerebellum: 0.34, brainstem: 0.5 }
const EXTRA = { tracts: 0.7, arteries: 0.3, veins_sinuses: 0.4, cranial_nerves: 0.3 }

async function build(keep, out) {
  await MeshoptSimplifier.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })
  const doc = await io.read(input)
  let nodes = 0
  let before = 0
  let after = 0
  for (const node of doc.getRoot().listNodes()) {
    const ex = node.getExtras() || {}
    const ratio = keep[ex.bx_cat]
    if (ratio === undefined) {
      node.dispose()
      continue
    }
    // keep only the fields the app reads
    node.setExtras({ bx_id: ex.bx_id, bx_cat: ex.bx_cat, bx_label: ex.bx_label, bx_side: ex.bx_side })
    nodes++
    for (const prim of node.getMesh().listPrimitives()) {
      const tris = (prim.getIndices()?.getCount() ?? 0) / 3
      before += tris
      if (ratio < 1 && tris > 400) {
        weldPrimitive(prim)
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.004 })
      }
      after += (prim.getIndices()?.getCount() ?? 0) / 3
    }
  }
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10 }))
  await io.write(out, doc)
  console.log(`${out}: ${nodes} structures, ${Math.round(before)} -> ${Math.round(after)} triangles`)
}

await build(CORE, `${outDir}/brain-core.glb`)
await build(EXTRA, `${outDir}/brain-extras.glb`)
