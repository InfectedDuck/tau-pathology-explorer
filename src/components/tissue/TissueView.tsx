import { Edges, Instance, Instances, RoundedBox, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { affectedRatioFor, bucketOf, pseudo, TISSUE_COUNT } from '../../data/tissueStats'
import { lerp4 } from '../../hooks/useSmoothStage'
import { useAppStore } from '../../store/useAppStore'

/** Real Cajal Purkinje neuron (NIH 3D 3DPX-000786, CC-BY-SA) — instanced for the tissue network. */
const PK_URL = '/models/neuron-pk.glb'

interface NeuronPoint {
  pos: THREE.Vector3
  affected: boolean
  dead: boolean
  severity: number
}

function cellColor(n: NeuronPoint): string {
  return n.dead ? '#334155' : n.affected ? '#fb923c' : '#2dd4bf'
}

/* Organic proxy geometries — a soma blob + tapered neurite tubes merged,
   so instanced cells read as neurons instead of plain spheres. */

function somaBlob(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.24, 2)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 9 + seed) * Math.cos(v.y * 11 + seed * 1.7) + Math.sin(v.z * 8 + seed * 2.2) * 0.6
    v.multiplyScalar(1 + (n / 3) * 0.3)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

function neuriteTube(seed: number, len = 0.55): THREE.BufferGeometry {
  const a = seed * 2.1
  const dir = new THREE.Vector3(Math.cos(a), Math.sin(a * 1.3) * 0.7, Math.sin(a) * 0.8).normalize()
  const mid = dir.clone().multiplyScalar(len * 0.55)
  mid.y += Math.sin(seed * 3) * 0.08
  const end = dir.clone().multiplyScalar(len)
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, end)
  return new THREE.TubeGeometry(curve, 6, 0.05, 6, false)
}

function neuronProxyGeometry(): THREE.BufferGeometry {
  const soma = somaBlob(1.7)
  const n1 = neuriteTube(0.6).translate(0.1, 0.05, 0)
  const n2 = neuriteTube(2.4).translate(-0.08, -0.06, 0.05)
  const n3 = neuriteTube(4.4, 0.45).translate(0, 0.08, -0.08)
  const merged = mergeGeometries([soma, n1, n2, n3])
  merged?.computeVertexNormals()
  return merged ?? soma
}

function astrocyteGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.2 + seed * 0.06, 1)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const spike = Math.pow(Math.abs(Math.sin(v.x * 14 + seed * 9) * Math.cos(v.y * 12 + seed * 5)), 0.6)
    v.multiplyScalar(1 + spike * 0.55)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

function InstancedCells({ neurons, geometry }: { neurons: NeuronPoint[]; geometry: THREE.BufferGeometry }) {
  const { setSelection } = useAppStore()
  const highlight = useAppStore((s) => s.highlight)
  return (
    // eslint-disable-next-line react/no-unknown-property
    <Instances limit={neurons.length} frustumCulled={false} geometry={geometry}>
      <meshStandardMaterial
        roughness={0.5}
        metalness={0.05}
        emissive="#2dd4bf"
        emissiveIntensity={highlight === 'healthy' ? 0.35 : highlight === 'early' ? 0.18 : 0}
      />
      {neurons.map((n, i) => (
        <Instance
          key={i}
          position={n.pos}
          scale={n.dead ? 0.45 : n.affected ? 1 - n.severity * 0.25 : 1}
          rotation={[pseudo(i, 33) * 0.9 - 0.45, pseudo(i, 21) * Math.PI * 2, pseudo(i, 44) * 0.9 - 0.45]}
          color={cellColor(n)}
          onClick={(e) => {
            e.stopPropagation()
            setSelection({ kind: 'cellPart', id: n.affected ? 'tangle' : 'microtubule' })
          }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = 'auto' }}
        />
      ))}
    </Instances>
  )
}

/** Real scan-mesh cells (high quality). Suspends until the GLB arrives. */
function RealInstancedCells({ neurons }: { neurons: NeuronPoint[] }) {
  const { scene } = useGLTF(PK_URL)
  const geo = useMemo(() => {
    let src: THREE.BufferGeometry | null = null
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!src && m.isMesh && m.geometry) src = m.geometry as THREE.BufferGeometry
    })
    const g = (src ?? new THREE.IcosahedronGeometry(0.24, 2)).clone()
    g.computeBoundingBox()
    const bb = g.boundingBox!
    const size = bb.getSize(new THREE.Vector3())
    const center = bb.getCenter(new THREE.Vector3())
    const s = 0.62 / (Math.max(size.x, size.y, size.z) || 1)
    g.translate(-center.x, -center.y, -center.z)
    g.scale(s, s, s)
    g.computeVertexNormals()
    return g
  }, [scene])
  return <InstancedCells neurons={neurons} geometry={geo} />
}

/** Proxy cells (Eco / fallback): soma blob + neurite tubes, one draw call. */
function ProxyInstancedCells({ neurons }: { neurons: NeuronPoint[] }) {
  const geo = useMemo(() => neuronProxyGeometry(), [])
  return <InstancedCells neurons={neurons} geometry={geo} />
}

function TissueCells({ neurons }: { neurons: NeuronPoint[] }) {
  const quality = useAppStore((s) => s.quality)
  const proxy = <ProxyInstancedCells neurons={neurons} />
  if (quality !== 'high') return proxy
  return <Suspense fallback={proxy}><RealInstancedCells neurons={neurons} /></Suspense>
}

/** Tangles as a second instanced draw call (only affected, living cells). */
function InstancedTangles({ neurons }: { neurons: NeuronPoint[] }) {
  const highlight = useAppStore((s) => s.highlight)
  const tangled = useMemo(
    () => neurons.map((n, i) => ({ n, i })).filter(({ n }) => n.affected && !n.dead),
    [neurons],
  )
  const tangleGeo = useMemo(() => new THREE.TorusKnotGeometry(0.11, 0.04, 40, 8), [])
  if (tangled.length === 0) return null
  return (
    // eslint-disable-next-line react/no-unknown-property
    <Instances limit={tangled.length} geometry={tangleGeo} frustumCulled={false}>
      <meshPhysicalMaterial color="#431407" emissive="#d55e00" emissiveIntensity={highlight === 'tangle' ? 2.2 : 1.0} roughness={0.4} clearcoat={0.5} />
      {tangled.map(({ n }, k) => (
        <Instance key={k} position={n.pos} scale={1 - n.severity * 0.25} />
      ))}
    </Instances>
  )
}

export function TissueView({ stage }: { stage: number }) {
  const { showNeurons, showGlia, showTangles, showSynapses, quality, highlight } = useAppStore()
  const gliaRef = useRef<THREE.Group>(null)
  // transmission pass is expensive and glitchy on mobile GPUs — Eco uses plain transparency.

  const bucket = bucketOf(stage)

  const neurons = useMemo(() => {
    const arr: NeuronPoint[] = []
    const affectedRatio = affectedRatioFor(bucket)
    const deadFrac = Math.max(0, Math.min(1, (bucket - 2.2) / 0.8))
    for (let i = 0; i < TISSUE_COUNT; i++) {
      const gx = (i % 6) - 2.5
      const gy = (Math.floor(i / 6) % 4) - 1.5
      const gz = (Math.floor(i / 24) % 2) - 0.5
      const pos = new THREE.Vector3(
        gx * 1.05 + (pseudo(i, 1) - 0.5) * 0.5,
        gy * 1.05 + (pseudo(i, 2) - 0.5) * 0.5,
        gz * 1.6 + (pseudo(i, 3) - 0.5) * 0.6
      )
      const r = pseudo(i, 9)
      const affected = r < affectedRatio
      const dead = affected && deadFrac > 0 && r < affectedRatio * 0.85 * deadFrac + 0.02 * deadFrac
      arr.push({ pos, affected, dead, severity: affected ? Math.min(1, (affectedRatio - r + 0.1) * 3) : 0 })
    }
    return arr
  }, [bucket])

  const synLines = useMemo(() => {
    const pts: number[] = []
    const drop = Math.max(0, Math.min(1, (bucket - 1.2) / 1.8))
    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        if (neurons[i].dead || neurons[j].dead) continue
        const d = neurons[i].pos.distanceTo(neurons[j].pos)
        if (d < 1.35 && pseudo(i * 10 + j, 5) > 0.45 + drop * 0.35) {
          if (drop > 0.3 && pseudo(i + j, 7) < drop * 0.6) continue
          pts.push(neurons[i].pos.x, neurons[i].pos.y, neurons[i].pos.z, neurons[j].pos.x, neurons[j].pos.y, neurons[j].pos.z)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [neurons, bucket])

  const glia = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      pos: new THREE.Vector3((pseudo(i, 11) - 0.5) * 5.4, (pseudo(i, 12) - 0.5) * 3.6, (pseudo(i, 13) - 0.5) * 2.2),
      seed: pseudo(i, 14),
      geo: astrocyteGeometry(pseudo(i, 14)),
    }))
  }, [])

  const reactive = stage > 1.4
  const reactiveAmt = Math.max(0, Math.min(1, (stage - 1.2) / 1.3))
  const tissueThin = lerp4([1, 1, 0.92, 0.82], stage)
  const synOpacity = lerp4([0.55, 0.5, 0.35, 0.18], stage)

  const gliaBaseY = useRef<number[] | null>(null)

  useFrame((state) => {
    if (!gliaRef.current) return
    // Oscillate around captured base positions — never accumulate drift.
    if (!gliaBaseY.current) {
      gliaBaseY.current = gliaRef.current.children.map((c) => c.position.y)
    }
    const base = gliaBaseY.current
    const t = state.clock.elapsedTime
    gliaRef.current.children.forEach((c, i) => {
      c.position.y = (base[i] ?? c.position.y) + Math.sin(t * 1.2 + i) * 0.05
    })
    void state
  })

  const cells = <TissueCells neurons={neurons} />

  return (
    <group scale={[1, tissueThin, 1]}>
      {/* showcase block — rounded vitrine instead of a hard box */}
      <RoundedBox args={[6.4, 4.4, 3.2]} radius={0.18} smoothness={4}>
        <meshPhysicalMaterial color="#0ea5e9" transparent opacity={quality === 'high' ? 0.07 : 0.1} roughness={0.15} clearcoat={quality === 'high' ? 1 : 0} clearcoatRoughness={0.15} transmission={quality === 'high' ? 0.5 : 0} thickness={quality === 'high' ? 0.6 : 0} depthWrite={false} />
        <Edges scale={1} threshold={20} color="#22d3ee" />
      </RoundedBox>

      {showNeurons && cells}

      {showNeurons && showTangles && <InstancedTangles neurons={neurons} />}

      {showSynapses && (
        // eslint-disable-next-line react/no-unknown-property
        <lineSegments geometry={synLines}>
          <lineBasicMaterial color="#7dd3fc" transparent opacity={highlight === 'transport' ? Math.min(1, synOpacity + 0.35) : synOpacity} />
        </lineSegments>
      )}

      {showGlia && (
        <group ref={gliaRef}>
          {glia.map((g, i) => (
            <mesh
              key={i}
              geometry={g.geo}
              position={[
                reactive ? g.pos.x * (0.9 - reactiveAmt * 0.45) : g.pos.x,
                reactive ? g.pos.y * (0.9 - reactiveAmt * 0.45) : g.pos.y,
                g.pos.z,
              ]}
              scale={1 + reactiveAmt * 0.55}
            >
              <meshPhysicalMaterial
                color={stage < 0.6 ? '#2dd4bf' : stage < 1.6 ? '#eab308' : '#ef4444'}
                emissive={stage < 0.6 ? '#0f766e' : '#9a3412'}
                emissiveIntensity={0.7}
                transparent
                opacity={0.92}
                roughness={0.5}
                clearcoat={0.4}
                flatShading={false}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* counter lives outside canvas (App healthyCount) — no hidden proxy mesh needed */}
    </group>
  )
}

if (typeof window !== 'undefined') {
  try {
    useGLTF.preload(PK_URL)
  } catch { /* offline / test env — proxy cells cover it */ }
}
