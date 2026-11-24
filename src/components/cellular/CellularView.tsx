import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { lerp4 } from '../../hooks/useSmoothStage'
import { useAppStore } from '../../store/useAppStore'

/** NIH 3D "Neuron" (3DPX-015796, CC-BY-NC-SA 4.0) — see public/models/ATTRIBUTION.md. */
const NEURON_URL = '/models/neuron-nih.glb'

/* Organic helpers — folded-protein blobs + tubes, never plain spheres/cylinders. */

function displace(geo: THREE.BufferGeometry, amt: number, freq: number, seed: number): THREE.BufferGeometry {
  const p = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n =
      Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 1.25 + seed * 1.7) +
      Math.sin(v.z * freq * 0.9 + seed * 2.1) * 0.6
    v.multiplyScalar(1 + (n / 2.6) * amt)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

function proteinBlobGeo(seed: number, r = 0.07, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail)
  return displace(g, 0.38, 6.5, seed)
}

function vesicleGeo(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.09, 2)
  return displace(g, 0.14, 5.0, seed)
}

function boutonGeo(seed: number): THREE.BufferGeometry {
  // teardrop bouton via lathe
  const pts: THREE.Vector2[] = []
  const N = 12
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const r = Math.sin(t * Math.PI) * 0.16 * (1 - 0.3 * t)
    pts.push(new THREE.Vector2(Math.max(0.001, r), (t - 0.5) * 0.34))
  }
  const g = new THREE.LatheGeometry(pts, 18)
  return displace(g, 0.12, 6.0, seed)
}

function trackTubeSeg(y: number, z: number, x0: number, x1: number, r = 0.038): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x0, y, z),
    new THREE.Vector3(x0 + (x1 - x0) * 0.5, y + 0.015, z),
    new THREE.Vector3(x1, y, z),
  ])
  return new THREE.TubeGeometry(curve, 16, r, 8, false)
}

function axonTube(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, 0, 0),
    new THREE.Vector3(2.0, 0.06, 0.02),
    new THREE.Vector3(4.0, -0.05, -0.02),
    new THREE.Vector3(6.0, 0, 0),
  ])
  return new THREE.TubeGeometry(curve, 40, 0.3, 14, false)
}

function dendriteTube(seed: number): THREE.BufferGeometry {
  const s = Math.sin(seed * 3.1)
  const c = Math.cos(seed * 1.7)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.55, 0.35 * s + 0.2, 0.15 * c),
    new THREE.Vector3(-1.0, 0.6 * s + 0.35, 0.3 * c),
    new THREE.Vector3(-1.45, 0.75 * s + 0.4, 0.4 * c),
  ])
  return new THREE.TubeGeometry(curve, 16, 0.09, 8, false)
}

function mitoGeo(seed: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const r = Math.sin(t * Math.PI) * 0.13 * (1 + 0.1 * Math.sin(seed + t * 6))
    pts.push(new THREE.Vector2(Math.max(0.001, r), (t - 0.5) * 0.52))
  }
  const g = new THREE.LatheGeometry(pts, 18)
  return displace(g, 0.18, 7.0, seed)
}

function TauParticles({ stage }: { stage: number }) {
  const { setSelection } = useAppStore()
  const highlight = useAppStore((s) => s.highlight)
  const bucket = Math.max(0, Math.min(3, Math.round(stage)))

  const geos = useMemo(() => Array.from({ length: 26 }, (_, i) => proteinBlobGeo(i * 1.37 + 0.5, stage >= 1.5 && i < 16 ? 0.11 : 0.07, 2)), [stage])
  const positions = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 26; i++) {
      const t = (i / 26) * 5.2 + 0.6
      const lane = (i % 3 - 1) * 0.22
      if (bucket === 0) pts.push(new THREE.Vector3(t, lane * 0.4, lane * 0.6))
      else if (bucket === 1) pts.push(new THREE.Vector3(t + Math.sin(i * 1.7) * 0.6, 0.6 + Math.cos(i) * 0.5, Math.sin(i * 2.1) * 0.6))
      else if (bucket === 2) {
        if (i < 16) pts.push(new THREE.Vector3(Math.sin(i) * 0.5, Math.cos(i * 1.3) * 0.5, Math.sin(i * 2) * 0.4))
        else pts.push(new THREE.Vector3(t, 0.8 + Math.sin(i) * 0.3, Math.cos(i) * 0.3))
      } else {
        if (i < 20) pts.push(new THREE.Vector3(Math.sin(i * 0.8) * 0.4, Math.cos(i) * 0.4, 0))
        else pts.push(new THREE.Vector3(t, 1.0, 0.5))
      }
    }
    return pts
  }, [bucket])

  const color = stage < 0.6 ? '#2dd4bf' : stage < 1.6 ? '#e69f00' : '#fb923c'

  return (
    <group>
      {positions.map((p, i) => (
        <mesh
          key={i}
          position={p}
          geometry={geos[i]}
          rotation={[i * 1.1, i * 0.7, 0]}
          onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'tau' }) }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = 'auto' }}
        >
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.75 + (highlight === 'early' || highlight === 'tangle' ? 0.9 : 0)} roughness={0.35} clearcoat={0.6} transparent opacity={stage >= 2.6 && i >= 20 ? 0.4 : 1} />
        </mesh>
      ))}
    </group>
  )
}

function Transport({ stage }: { stage: number }) {
  const ves = useRef<THREE.Group>(null)
  const mito = useRef<THREE.Group>(null)
  const { setSelection } = useAppStore()
  const highlight = useAppStore((s) => s.highlight)
  const boost = highlight === 'transport' ? 0.9 : 0

  const vesGeos = useMemo(() => Array.from({ length: 5 }, (_, i) => vesicleGeo(i * 2.2)), [])
  const mitoGeos = useMemo(() => [mitoGeo(1.1), mitoGeo(4.4)], [])

  useFrame((state, delta) => {
    const s = lerp4([1.2, 0.7, 0.25, 0], stage)
    if (ves.current) {
      ves.current.children.forEach((c, i) => {
        c.position.x += delta * s * (0.8 + (i % 3) * 0.2)
        if (c.position.x > 6) c.position.x = 0.6
      })
    }
    if (mito.current) {
      mito.current.children.forEach((c, i) => {
        c.position.x += delta * s * 0.5
        if (c.position.x > 6) c.position.x = 0.8 + i * 0.5
      })
    }
    void state
  })
  const dim = lerp4([1, 0.9, 0.6, 0.25], stage)

  return (
    <>
      <group ref={ves}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0.8 + i * 0.9, (i % 2 ? 0.12 : -0.12), 0.1]} geometry={vesGeos[i]} onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'synapse' }) }}>
            <meshPhysicalMaterial color="#bae6fd" emissive="#0ea5e9" emissiveIntensity={0.1 + dim * 0.8 + boost} roughness={0.15} clearcoat={1} transparent opacity={dim} />
          </mesh>
        ))}
      </group>
      <group ref={mito}>
        {[0, 1].map((i) => (
          <mesh
            key={i}
            position={[1.2 + i * 2.2, i ? 0.18 : -0.18, -0.12]}
            geometry={mitoGeos[i]}
            rotation={[0.3, 0, Math.PI / 2]}
            onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'mitochondrion' }) }}
          >
            <meshPhysicalMaterial color={stage >= 1.6 ? '#94a3b8' : '#f9a8d4'} emissive={stage >= 1.6 ? '#475569' : '#ec4899'} emissiveIntensity={0.55 + boost * 0.7} roughness={0.4} clearcoat={0.5} transparent opacity={dim} />
          </mesh>
        ))}
      </group>
    </>
  )
}

function SeedTransfer({ stage }: { stage: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => proteinBlobGeo(9.9, 0.09, 2), [])
  useFrame((state) => {
    if (!ref.current) return
    const t = (state.clock.elapsedTime * 0.25) % 1
    ref.current.position.set(6 + t * 1.2, 0 + t * 0.8, Math.sin(t * Math.PI) * 0.3)
    const vis = stage > 0.6 && stage < 2.6
    ref.current.visible = vis
    const s = vis ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.12 : 0.001
    ref.current.scale.setScalar(s)
    void state
  })
  return (
    <mesh ref={ref} geometry={geo}>
      <meshPhysicalMaterial color="#e69f00" emissive="#d55e00" emissiveIntensity={1.3} roughness={0.3} clearcoat={0.7} />
    </mesh>
  )
}

/** Real Cajal Purkinje neuron (NIH 3D, CC-BY-SA) as the faint neighbor cell. */
const PK_URL = '/models/neuron-pk.glb'

function NeighborNeuron() {
  const { scene } = useGLTF(PK_URL)
  const fitted = useMemo(() => {
    const cloned = scene.clone(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = 1.5 / (Math.max(size.x, size.y, size.z) || 1)
    cloned.position.set(-center.x * s, -center.y * s, -center.z * s)
    cloned.scale.setScalar(s)
    const mat = new THREE.MeshStandardMaterial({
      color: '#7b8ba3',
      transparent: true,
      opacity: 0.6,
      roughness: 0.6,
      metalness: 0.05,
    })
    cloned.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = mat
        m.castShadow = false
        m.receiveShadow = false
      }
    })
    return cloned
  }, [scene])
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={fitted} />
}
/** Real neuron morphology as the cell-body context; teaching overlays stay schematic. */
function RealNeuronMesh({ stage }: { stage: number }) {
  const { setSelection } = useAppStore()
  const highlight = useAppStore((s) => s.highlight)
  const { scene } = useGLTF(NEURON_URL)
  const fitted = useMemo(() => {
    const cloned = scene.clone(true)
    const first = new THREE.Box3().setFromObject(cloned)
    const s1 = first.getSize(new THREE.Vector3())
    if (s1.y >= s1.x && s1.y >= s1.z) cloned.rotation.z = -Math.PI / 2
    else if (s1.z >= s1.x && s1.z >= s1.y) cloned.rotation.y = Math.PI / 2
    cloned.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = 6.4 / (Math.max(size.x, size.y, size.z) || 1)
    cloned.position.set(2.4 - center.x * s, -center.y * s, -center.z * s)
    cloned.scale.setScalar(s)
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#8fd4e8',
      emissive: '#0e7490',
      emissiveIntensity: highlight === 'healthy' ? 0.55 : 0,
      roughness: 0.42,
      metalness: 0.05,
      clearcoat: 0.5,
      transparent: true,
      opacity: 0.92,
    })
    cloned.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = mat
        m.castShadow = false
        m.receiveShadow = false
      }
    })
    return cloned
  }, [scene, highlight])

  return (
    // eslint-disable-next-line react/no-unknown-property
    <primitive
      object={fitted}
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: stage >= 1.5 ? 'tangle' : 'tau' }) }}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    />
  )
}

class NeuronModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Organic fallback soma/dendrites/axon — folded blobs + tubes, no plain spheres. */
function ProceduralCellBody({ somaDim, dendriteScale, somaDark, stage }: { somaDim: number; dendriteScale: number; somaDark: number; stage: number }) {
  const { setSelection } = useAppStore()
  const somaGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.9, 3)
    return displace(g, 0.22, 3.2, 2.2)
  }, [])
  const axonGeo = useMemo(() => axonTube(), [])
  const dendGeos = useMemo(() => [dendriteTube(1.3), dendriteTube(2.9), dendriteTube(4.1), dendriteTube(5.6)], [])
  return (
    <group>
      <mesh
        position={[0, 0, 0]}
        scale={somaDim}
        geometry={somaGeo}
        onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: stage >= 1.5 ? 'tangle' : 'tau' }) }}
      >
        <meshPhysicalMaterial color={somaDark > 0.5 ? '#334155' : '#38bdf8'} emissive={somaDark > 0.5 ? '#0f172a' : '#0e7490'} emissiveIntensity={0.35 - somaDark * 0.15} transparent opacity={0.94} roughness={0.45} clearcoat={0.5} />
      </mesh>

      <group scale={dendriteScale} position={[-0.2, 0, 0]}>
        {dendGeos.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshPhysicalMaterial color={somaDark > 0.5 ? '#475569' : '#7dd3fc'} transparent opacity={0.95 - somaDark * 0.55} roughness={0.5} clearcoat={0.3} />
          </mesh>
        ))}
      </group>

      <mesh geometry={axonGeo} position={[0.4, 0, 0]}>
        <meshPhysicalMaterial color={somaDark > 0.5 ? '#1e293b' : '#0ea5e9'} transparent opacity={0.55} roughness={0.4} clearcoat={0.4} />
      </mesh>
    </group>
  )
}

export function CellularView({ stage }: { stage: number }) {
  const { setSelection } = useAppStore()
  const highlight = useAppStore((s) => s.highlight)
  const mtBoost = highlight === 'transport' ? 1.2 : 0
  const tangleBoost = highlight === 'tangle' ? 0.9 : 0
  const dendriteScale = lerp4([1, 0.95, 0.8, 0.62], stage)
  const somaDim = lerp4([1, 0.92, 0.78, 0.55], stage)
  const mtOpacity = lerp4([1, 0.75, 0.45, 0.22], stage)
  const synOpacity = lerp4([1, 0.85, 0.5, 0.18], stage)
  const somaDark = Math.max(0, Math.min(1, (stage - 1.6) / 1.4))
  const tangleAmt = Math.max(0, Math.min(1, (stage - 1.15) / 1.2))
  const mtFrag = stage > 1.5

  const mtSegs = useMemo(() => {
    const rows = [-0.14, 0, 0.14]
    return rows.map((y, li) => ({
      prox: trackTubeSeg(y, li * 0.04, 0.9, 3.1),
      dist: trackTubeSeg(y, li * 0.04, 4.0, 6.1),
    }))
  }, [])
  const boutonGeos = useMemo(() => [boutonGeo(3.1), boutonGeo(5.7), boutonGeo(8.3)], [])

  const fallbackBody = (
    <ProceduralCellBody somaDim={somaDim} dendriteScale={dendriteScale} somaDark={somaDark} stage={stage} />
  )

  return (
    <group position={[-2.2, -0.2, 0]}>
      <NeuronModelBoundary fallback={fallbackBody}>
        <Suspense fallback={fallbackBody}>
          <RealNeuronMesh stage={stage} />
        </Suspense>
      </NeuronModelBoundary>

      {/* Tangle */}
      {tangleAmt > 0.02 && (
        <mesh
          position={[0, 0, 0.1]}
          scale={0.15 + tangleAmt * 0.55}
          onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'tangle' }) }}
        >
          <torusKnotGeometry args={[0.42, 0.13, 96, 12]} />
          <meshPhysicalMaterial color="#431407" emissive="#d55e00" emissiveIntensity={0.35 + tangleAmt * 0.6 + tangleBoost} transparent opacity={tangleAmt} roughness={0.4} clearcoat={0.5} />
        </mesh>
      )}

      {/* Microtubule tracks — paired tube segments; outer lanes fragment (gap) */}
      {mtSegs.map((s, li) => (
        <group key={li}>
          <mesh
            geometry={s.prox}
            onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'microtubule' }) }}
          >
            <meshPhysicalMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={1.0 + mtBoost} transparent opacity={mtOpacity} roughness={0.25} clearcoat={0.8} />
          </mesh>
          {!(mtFrag && li !== 1) && (
            <mesh
              geometry={s.dist}
              onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'microtubule' }) }}
            >
              <meshPhysicalMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={1.0 + mtBoost} transparent opacity={mtOpacity} roughness={0.25} clearcoat={0.8} />
            </mesh>
          )}
        </group>
      ))}

      <TauParticles stage={stage} />
      <Transport stage={stage} />

      {/* Synaptic boutons — teardrop terminals */}
      <group position={[6, 0, 0]}>
        {[0.25, 0, -0.25].map((dy, i) => (
          <mesh
            key={i}
            position={[0.25, dy, 0]}
            rotation={[0, 0, -Math.PI / 2]}
            geometry={boutonGeos[i]}
            onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'cellPart', id: 'synapse' }) }}
          >
            <meshPhysicalMaterial color="#e0f2fe" emissive="#0ea5e9" emissiveIntensity={0.7} transparent opacity={synOpacity} roughness={0.2} clearcoat={1} />
          </mesh>
        ))}
      </group>

      {/* Neighbor neuron (real scan mesh, faint) + seed */}
      <group position={[7.6, 0.9, 0]} scale={0.7}>
        <Suspense fallback={null}>
          <NeighborNeuron />
        </Suspense>
      </group>
      <SeedTransfer stage={stage} />
    </group>
  )
}

if (typeof window !== 'undefined') {
  try {
    useGLTF.preload(NEURON_URL)
    useGLTF.preload(PK_URL)
  } catch { /* offline / test env — Suspense fallback covers it */ }
}
