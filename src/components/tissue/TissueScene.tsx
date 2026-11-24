import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PART_COLOR } from '../../data/parts'
import { affectedRatioFor, pseudo, TISSUE_COUNT } from '../../data/tissueStats'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useMergedContent } from '../../hooks/useMergedContent'
import { lerp4 } from '../../hooks/useSmoothStage'
import { SWC_APICAL, SWC_AXON, SWC_BASAL, buildNeuriteGeometry, buildSomaGeometry, loadCellTree, rng, sampleSurface, type CellTree } from '../../lib/cellTree'
import { createNeuriteMaterial, pixelWorld } from '../../lib/neuriteMaterial'
import { smoothStage, useStageBucket } from '../../lib/smoothStage'
import { useAppStore } from '../../store/useAppStore'
import { Hotspot } from '../viewer/Hotspot'

/** 1 world unit = 100 µm */
const S = 0.01

const SLAB = { w: 900, d: 300, y0: -330 }
const VARIANTS = ['ca1-a', 'ca1-b', 'ca1-c'] as const
const SYN_PER_CELL = 90
const ASTRO = 8
const MICRO = 10
const HEALTHY_TINTS = ['#2dd4bf', '#27c3d9', '#3ddc97', '#4ab8f0', '#22d3b0']

interface NeuronState {
  affected: boolean
  dead: boolean
  severity: number
}

/** Same rule as data/tissueStats, so the on-screen counter always matches the cells. */
function neuronStates(bucket: number): NeuronState[] {
  const ratio = affectedRatioFor(bucket)
  const deadFrac = Math.max(0, Math.min(1, (bucket - 2.2) / 0.8))
  return Array.from({ length: TISSUE_COUNT }, (_, i) => {
    const r = pseudo(i, 9)
    const affected = r < ratio
    const dead = affected && deadFrac > 0 && r < ratio * 0.85 * deadFrac + 0.02 * deadFrac
    return { affected, dead, severity: affected ? Math.min(1, (ratio - r + 0.1) * 3) : 0 }
  })
}

function flameTangle(R: number): THREE.BufferGeometry {
  const rand = rng(23)
  const parts: THREE.BufferGeometry[] = []
  for (let f = 0; f < 7; f++) {
    const phase = rand() * Math.PI * 2
    const turns = 1 + rand() * 1.2
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 14; k++) {
      const u = k / 14
      const y = -0.9 * R + u * 4.6 * R
      const env = R * 1.12 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.6) * (1 - 0.86 * u) + 0.8
      const a = phase + u * turns * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * env, y, Math.sin(a) * env))
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 1.25, 4, false))
  }
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

/** Tubes + cell body as one geometry, ready for instancing. */
function cellGeometry(tree: CellTree, radial: number, apex: number, colors: Record<number | 'default', string>, minRadius: number): THREE.BufferGeometry {
  const neurites = buildNeuriteGeometry(tree, { radial, minRadius, flare: 0.42, somaApex: apex, colors })
  const soma = buildSomaGeometry(tree, { apex, detail: 2, color: colors.default })
  const merged = mergeGeometries([neurites, soma])
  merged.boundingBox = neurites.boundingBox
  merged.boundingSphere = neurites.boundingSphere
  neurites.dispose()
  soma.dispose()
  return merged
}

/** Pick instanced cells by a sphere round each cell body (branches are too fine to hit reliably). */
function pickBySoma(mesh: THREE.InstancedMesh, radius: number) {
  const m = new THREE.Matrix4()
  const c = new THREE.Vector3()
  const sphere = new THREE.Sphere()
  const hit = new THREE.Vector3()
  mesh.raycast = (raycaster, intersects) => {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      m.premultiply(mesh.matrixWorld)
      sphere.set(c.setFromMatrixPosition(m), radius * m.getMaxScaleOnAxis())
      if (raycaster.ray.intersectSphere(sphere, hit)) {
        intersects.push({ distance: hit.distanceTo(raycaster.ray.origin), point: hit.clone(), object: mesh, instanceId: i } as THREE.Intersection)
      }
    }
  }
}

/**
 * Box 2 — a slab of hippocampal CA1: 48 pyramidal neurons (three real human
 * reconstructions, instanced) with their cell bodies in one layer and apical
 * dendrites running up in parallel, plus real astrocyte and microglia shapes.
 * Disease: tau-bearing neurons turn amber, lose synapses and dendrites, then
 * die; astrocytes thicken; microglia pull in their branches and converge.
 */
export function TissueScene({ fixedStage }: { fixedStage?: number }) {
  const trees = [use(loadCellTree(VARIANTS[0])), use(loadCellTree(VARIANTS[1])), use(loadCellTree(VARIANTS[2]))]
  const astroTree = use(loadCellTree('astrocyte'))
  const microTrees = [use(loadCellTree('microglia-a')), use(loadCellTree('microglia-b'))]
  const { showNeurons, showGlia, showTangles, showSynapses, quality, highlight } = useAppStore()
  const selId = useAppStore((s) => (s.selection?.kind === 'cellPart' ? s.selection.id : null))
  const setSelection = useAppStore((s) => s.setSelection)
  const isMobile = useIsMobile()
  const { mergedCells } = useMergedContent()
  const bucket = useStageBucket(0.25, fixedStage)
  const radial = quality === 'high' ? (isMobile ? 4 : 5) : 3
  const [t0, t1, t2] = trees
  const [m0, m1] = microTrees

  // ---- static layout ------------------------------------------------------
  const layout = useMemo(() => {
    const neurons = Array.from({ length: TISSUE_COUNT }, (_, i) => {
      const col = i % 12
      const row = Math.floor(i / 12)
      const s = 0.74 + pseudo(i, 73) * 0.22
      return {
        variant: i % 3,
        slot: Math.floor(i / 3),
        pos: new THREE.Vector3(
          ((col + 0.5) / 12 - 0.5) * SLAB.w + (pseudo(i, 1) - 0.5) * 55,
          SLAB.y0 + (pseudo(i, 2) - 0.5) * 80,
          ((row + 0.5) / 4 - 0.5) * SLAB.d + (pseudo(i, 3) - 0.5) * 50,
        ),
        quat: new THREE.Quaternion().setFromEuler(new THREE.Euler((pseudo(i, 33) - 0.5) * 0.16, pseudo(i, 21) * Math.PI * 2, (pseudo(i, 44) - 0.5) * 0.16)),
        scale: new THREE.Vector3(s, s * (0.92 + pseudo(i, 74) * 0.16), s),
        tint: HEALTHY_TINTS[Math.floor(pseudo(i, 75) * HEALTHY_TINTS.length)],
      }
    })
    const astro = Array.from({ length: ASTRO }, (_, i) => ({
      pos: new THREE.Vector3((pseudo(i, 11) - 0.5) * SLAB.w * 0.92, -470 + pseudo(i, 12) * 900, (pseudo(i, 13) - 0.5) * SLAB.d),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(pseudo(i, 14) * 6, pseudo(i, 15) * 6, pseudo(i, 16) * 6)),
      s: 1.05 + pseudo(i, 17) * 0.5,
    }))
    const micro = Array.from({ length: MICRO }, (_, i) => ({
      variant: i % 2,
      slot: Math.floor(i / 2),
      pos: new THREE.Vector3((pseudo(i, 51) - 0.5) * SLAB.w * 0.95, -480 + pseudo(i, 52) * 820, (pseudo(i, 53) - 0.5) * SLAB.d),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(pseudo(i, 54) * 6, pseudo(i, 55) * 6, pseudo(i, 56) * 6)),
      s: 1.25 + pseudo(i, 57) * 0.5,
    }))
    return { neurons, astro, micro }
  }, [])

  // ---- geometry & materials ----------------------------------------------
  const geo = useMemo(() => {
    const nColors = { [SWC_AXON]: '#b9c9ff', [SWC_BASAL]: '#e9fbff', [SWC_APICAL]: '#ffffff', default: '#ffffff' } as Record<number | 'default', string>
    const white = { default: '#ffffff' } as Record<number | 'default', string>
    return {
      neurons: [t0, t1, t2].map((t) => cellGeometry(t, radial, 0.45, nColors, 0.5)),
      astro: cellGeometry(astroTree, Math.max(3, radial - 1), 0, white, 0.3),
      micro: [m0, m1].map((t) => cellGeometry(t, Math.max(3, radial - 1), 0, white, 0.4)),
      tangle: flameTangle(10),
    }
  }, [t0, t1, t2, astroTree, m0, m1, radial])

  const mats = useMemo(
    () => ({
      neuron: createNeuriteMaterial({ instanced: true, params: { roughness: 0.5 }, rim: '#b5f1ff' }),
      astro: createNeuriteMaterial({ params: { roughness: 0.55 }, rim: '#e9d5ff' }),
      micro: createNeuriteMaterial({ params: { roughness: 0.5 }, rim: '#fff7ae' }),
      tangle: new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#ff6a00', emissiveIntensity: 1.3, roughness: 0.45 }),
      edges: new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.16 }),
    }),
    [],
  )
  const synUniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 5 }, uBoost: { value: 0 } }), [])
  const synMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: synUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          attribute float aOn;
          uniform float uTime;
          uniform float uSize;
          varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
            float tw = 0.65 + 0.35 * sin( uTime * ( 1.5 + aSeed * 3.0 ) + aSeed * 40.0 );
            vA = aOn * tw;
            gl_PointSize = uSize * aOn * ( 0.7 + aSeed * 0.6 ) * clamp( 7.0 / max( 0.5, -mv.z ), 0.35, 3.2 );
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uBoost;
          varying float vA;
          void main() {
            float d = length( gl_PointCoord - 0.5 );
            float a = smoothstep( 0.5, 0.05, d ) * vA;
            if ( a < 0.01 ) discard;
            gl_FragColor = vec4( vec3( 0.55, 0.9, 1.0 ) * ( 1.0 + uBoost ), a * 0.9 );
          }`,
      }),
    [synUniforms],
  )
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(SLAB.w + 150, 1090, SLAB.d + 150)), [])

  // synapse points: positions are fixed, only their on/off state changes
  const syn = useMemo(() => {
    const pools = [t0, t1, t2].map((t, v) => sampleSurface(t, SYN_PER_CELL, [SWC_BASAL, SWC_APICAL], 300 + v, { minRadius: 0.5, flare: 0.42 }, 30))
    const n = TISSUE_COUNT * SYN_PER_CELL
    const positions = new Float32Array(n * 3)
    const seeds = new Float32Array(n)
    const heights = new Float32Array(n)
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    layout.neurons.forEach((cell, i) => {
      m.compose(cell.pos, cell.quat, cell.scale)
      const pool = pools[cell.variant]
      for (let k = 0; k < SYN_PER_CELL; k++) {
        p.fromArray(pool.positions, k * 3).applyMatrix4(m)
        positions.set([p.x, p.y, p.z], (i * SYN_PER_CELL + k) * 3)
        seeds[i * SYN_PER_CELL + k] = pseudo(i * SYN_PER_CELL + k, 81)
        heights[i * SYN_PER_CELL + k] = pool.height[k]
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    g.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1))
    return { geometry: g, seeds, heights }
  }, [t0, t1, t2, layout])

  useEffect(
    () => () => {
      geo.neurons.forEach((g) => g.dispose())
      geo.micro.forEach((g) => g.dispose())
      geo.astro.dispose()
      geo.tangle.dispose()
    },
    [geo],
  )
  useEffect(
    () => () => {
      mats.neuron.material.dispose(); mats.astro.material.dispose(); mats.micro.material.dispose(); mats.tangle.dispose(); mats.edges.dispose()
      synMat.dispose(); edgesGeo.dispose()
    },
    [mats, synMat, edgesGeo],
  )
  useEffect(() => () => syn.geometry.dispose(), [syn])

  const neuronRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const microRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const astroRef = useRef<THREE.InstancedMesh>(null)
  const tangleRef = useRef<THREE.InstancedMesh>(null)
  const rootRef = useRef<THREE.Group>(null)

  const states = useMemo(() => neuronStates(bucket), [bucket])

  // ---- per-stage state of every neuron, tangle and synapse ---------------
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const sc = new THREE.Vector3()
    const c = new THREE.Color()
    const dead = new THREE.Color('#465063')
    for (let v = 0; v < 3; v++) {
      const mesh = neuronRefs.current[v]
      if (!mesh) continue
      const g = mesh.geometry
      if (!g.getAttribute('aInstRetract')) {
        g.setAttribute('aInstRetract', new THREE.InstancedBufferAttribute(new Float32Array(16), 1))
        g.setAttribute('aInstTau', new THREE.InstancedBufferAttribute(new Float32Array(16), 1))
        pickBySoma(mesh, 26)
      }
      const retract = g.getAttribute('aInstRetract') as THREE.InstancedBufferAttribute
      const tau = g.getAttribute('aInstTau') as THREE.InstancedBufferAttribute
      layout.neurons.forEach((cell, i) => {
        if (cell.variant !== v) return
        const st = states[i]
        sc.copy(cell.scale).multiplyScalar(st.dead ? 0.82 : 1)
        mesh.setMatrixAt(cell.slot, m.compose(cell.pos, cell.quat, sc))
        mesh.setColorAt(cell.slot, st.dead ? dead : c.set(cell.tint))
        retract.setX(cell.slot, st.dead ? 460 : st.affected ? 18 + st.severity * 150 : 0)
        tau.setX(cell.slot, st.dead ? 0 : st.affected ? 0.2 + st.severity * 0.95 : 0)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      retract.needsUpdate = true
      tau.needsUpdate = true
    }
    if (tangleRef.current) {
      layout.neurons.forEach((cell, i) => {
        const st = states[i]
        const k = st.affected ? (st.dead ? 0.8 : 0.45 + st.severity * 0.6) * cell.scale.x : 0.0001
        tangleRef.current!.setMatrixAt(i, m.compose(cell.pos, cell.quat, sc.setScalar(k)))
      })
      tangleRef.current.instanceMatrix.needsUpdate = true
    }
    const on = syn.geometry.getAttribute('aOn') as THREE.BufferAttribute
    const baseLoss = lerp4([0, 0.06, 0.2, 0.38], bucket)
    for (let i = 0; i < TISSUE_COUNT; i++) {
      const st = states[i]
      const loss = st.dead ? 1 : st.affected ? 0.35 + st.severity * 0.6 : baseLoss
      const retract = st.dead ? 460 : st.affected ? 18 + st.severity * 150 : 0
      for (let k = 0; k < SYN_PER_CELL; k++) {
        const j = i * SYN_PER_CELL + k
        on.setX(j, syn.seeds[j] > loss && syn.heights[j] > retract ? 1 : 0)
      }
    }
    on.needsUpdate = true
  }, [states, layout, syn, bucket, geo])

  // glia: placed once, then animated in the frame loop
  useLayoutEffect(() => {
    if (astroRef.current) pickBySoma(astroRef.current, 30)
    microRefs.current.forEach((mesh) => mesh && pickBySoma(mesh, 16))
  }, [geo])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), [])
  // where each microglia heads once activated: the nearest tangle-bearing neuron
  const microTargets = useMemo(
    () =>
      layout.micro.map((mg) => {
        let best = mg.pos
        let bestD = Infinity
        layout.neurons.forEach((cell, i) => {
          if (!states[i].affected) return
          const d = cell.pos.distanceTo(mg.pos)
          if (d < bestD) {
            bestD = d
            best = cell.pos
          }
        })
        return best.clone().add(new THREE.Vector3(18, 22, 14))
      }),
    [layout, states],
  )
  const microPos = useRef(layout.micro.map((mg) => mg.pos.clone()))

  useFrame(({ camera, size, clock }, delta) => {
    const st = fixedStage ?? smoothStage.get()
    const t = clock.elapsedTime
    const px = pixelWorld(camera, size.height)
    const reactive = THREE.MathUtils.clamp((st - 0.9) / 1.4, 0, 1)
    for (const mat of [mats.neuron, mats.astro, mats.micro]) {
      mat.uniforms.uPixelWorld.value = px
      mat.uniforms.uObjScale.value = S
    }
    mats.neuron.uniforms.uMinPx.value = 0.95
    mats.neuron.uniforms.uTauGlow.value = 0.42 + Math.sin(t * 1.6) * 0.1 + (highlight === 'early' ? 0.5 : 0)
    mats.neuron.uniforms.uRimStrength.value = 0.42 + (highlight === 'healthy' || selId === 'neuron' ? 0.7 : 0)
    mats.tangle.emissiveIntensity = 1.2 + Math.sin(t * 2.1) * 0.2 + (highlight === 'tangle' || selId === 'tangle' ? 1.2 : 0)

    // astrocytes: reactive gliosis = thicker processes, hotter colour
    mats.astro.uniforms.uSwell.value = 1 + reactive * 1.5
    mats.astro.uniforms.uMinPx.value = 0.9 + reactive * 0.9
    mats.astro.uniforms.uRimStrength.value = 0.5 + reactive * 0.5 + (selId === 'astrocyte' ? 0.8 : 0)
    mats.astro.material.color.set('#b794f6').lerp(tmp.c.set('#f472b6'), reactive * 0.7)
    if (astroRef.current) {
      layout.astro.forEach((a, i) => {
        tmp.p.copy(a.pos)
        tmp.p.y += Math.sin(t * 0.5 + i) * 3
        astroRef.current!.setMatrixAt(i, tmp.m.compose(tmp.p, a.quat, tmp.s.setScalar(a.s * (1 + reactive * 0.25))))
      })
      astroRef.current.instanceMatrix.needsUpdate = true
    }

    // microglia: branches retract (ameboid), body swells, cells converge on damage
    mats.micro.uniforms.uRetract.value = reactive * 17
    mats.micro.uniforms.uRetractSoft.value = 6
    mats.micro.uniforms.uSwell.value = 1 + reactive * 1.2
    mats.micro.uniforms.uMinPx.value = 0.9 + reactive * 0.8
    mats.micro.uniforms.uRimStrength.value = 0.5 + (selId === 'microglia' || highlight === 'tangle' ? 0.8 : 0)
    mats.micro.material.color.set(PART_COLOR.microglia).lerp(tmp.c.set('#ff9f1c'), reactive * 0.75)
    layout.micro.forEach((mg, i) => {
      const goal = tmp.p.copy(mg.pos).lerp(microTargets[i], reactive * 0.82)
      microPos.current[i].lerp(goal, Math.min(1, delta * 1.4))
      const mesh = microRefs.current[mg.variant]
      if (!mesh) return
      tmp.s.setScalar(mg.s * (1 + reactive * 0.55))
      tmp.p.copy(microPos.current[i])
      tmp.p.x += Math.sin(t * 0.8 + i * 2) * 2.5
      mesh.setMatrixAt(mg.slot, tmp.m.compose(tmp.p, mg.quat, tmp.s))
      mesh.instanceMatrix.needsUpdate = true
    })

    synUniforms.uTime.value = t
    synUniforms.uSize.value = (isMobile ? 5.5 : 6.5) * Math.min(2, size.height / 520)
    synUniforms.uBoost.value = highlight === 'transport' || selId === 'synapse' ? 0.9 : 0
    if (rootRef.current) rootRef.current.scale.set(S, S * lerp4([1, 1, 0.95, 0.87], st), S)
  })

  const pick = (id: string | ((e: ThreeEvent<MouseEvent>) => string)) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      setSelection({ kind: 'cellPart', id: typeof id === 'function' ? id(e) : id })
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto'
    },
  })
  const name = (id: string) => mergedCells[id]?.short ?? id

  // label anchors: a healthy cell, a tangle-bearing cell and one of each glial type near the front
  const anchors = useMemo(() => {
    const front = (ok: (i: number) => boolean) => {
      let best = -1
      layout.neurons.forEach((cell, i) => {
        if (ok(i) && (best < 0 || cell.pos.z - Math.abs(cell.pos.x) * 0.25 > layout.neurons[best].pos.z - Math.abs(layout.neurons[best].pos.x) * 0.25)) best = i
      })
      return best
    }
    const healthy = front((i) => !states[i].affected && layout.neurons[i].pos.x < -60)
    const sick = front((i) => states[i].affected && !states[i].dead && layout.neurons[i].pos.x > 0)
    const at = (i: number): [number, number, number] | null => (i < 0 ? null : [layout.neurons[i].pos.x, layout.neurons[i].pos.y, layout.neurons[i].pos.z])
    return { healthy: at(healthy), sick: at(sick) }
  }, [layout, states])
  const astroAnchor = layout.astro[2].pos
  const microAnchor = layout.micro[1].pos
  const synAnchor: [number, number, number] = [-140, 120, 90]

  return (
    <group ref={rootRef} scale={S}>
      <lineSegments geometry={edgesGeo} material={mats.edges} position={[0, 5, 0]} raycast={() => null} />

      {showNeurons &&
        geo.neurons.map((g, v) => (
          <instancedMesh
            key={`${v}-${radial}`}
            ref={(el) => { neuronRefs.current[v] = el }}
            args={[g, mats.neuron.material, 16]}
            frustumCulled={false}
            {...pick((e) => {
              const cell = layout.neurons.findIndex((c) => c.variant === v && c.slot === e.instanceId)
              return cell >= 0 && states[cell].affected ? 'tangle' : 'neuron'
            })}
          />
        ))}

      {showNeurons && showTangles && (
        <instancedMesh ref={tangleRef} args={[geo.tangle, mats.tangle, TISSUE_COUNT]} frustumCulled={false} raycast={() => null} />
      )}

      {showSynapses && showNeurons && <points geometry={syn.geometry} material={synMat} frustumCulled={false} raycast={() => null} />}

      {showGlia && (
        <>
          <instancedMesh ref={astroRef} args={[geo.astro, mats.astro.material, ASTRO]} frustumCulled={false} {...pick('astrocyte')} />
          {geo.micro.map((g, v) => (
            <instancedMesh
              key={`${v}-${radial}`}
              ref={(el) => { microRefs.current[v] = el }}
              args={[g, mats.micro.material, MICRO / 2]}
              frustumCulled={false}
              {...pick('microglia')}
            />
          ))}
        </>
      )}

      {showNeurons && anchors.healthy && (
        <Hotspot id="neuron" position={anchors.healthy} radius={230} label={name('neuron')} color={PART_COLOR.neuron} angle={200} length={42} />
      )}
      {showNeurons && showTangles && anchors.sick && (
        <Hotspot id="tangle" position={anchors.sick} radius={90} label={name('tangle')} color={PART_COLOR.tangle} angle={20} length={42} />
      )}
      {showGlia && (
        <>
          <Hotspot id="astrocyte" position={[astroAnchor.x, astroAnchor.y, astroAnchor.z]} radius={90} label={name('astrocyte')} color={PART_COLOR.astrocyte} angle={-20} length={42} />
          <Hotspot id="microglia" position={[microAnchor.x, microAnchor.y, microAnchor.z]} radius={60} label={name('microglia')} color={PART_COLOR.microglia} angle={160} length={40} />
        </>
      )}
      {showSynapses && showNeurons && (
        <Hotspot id="synapse" position={synAnchor} radius={130} label={name('synapse')} color={PART_COLOR.synapse} angle={-150} length={40} />
      )}
    </group>
  )
}
