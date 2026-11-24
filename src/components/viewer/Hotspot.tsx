import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { pixelWorld } from '../../lib/neuriteMaterial'
import { useAppStore, type Selection } from '../../store/useAppStore'
import type { RingGroup } from './ring'
import { ViewerCtx } from './viewerContext'

interface HotspotProps {
  id: string
  kind?: Selection['kind']
  position: [number, number, number]
  /** radius (local units) that should fill the view when this part is focused */
  radius: number
  label: string
  color: string
  /** leader-line direction in degrees (0 = right, 90 = down) and length in px */
  angle?: number
  length?: number
  /** only show the label when the camera is nearer / farther than this (world units) */
  showWithin?: number
  showBeyond?: number
  /** register the focus point but draw no label */
  silent?: boolean
  /**
   * Put the label on an ellipse around this point (same local space as
   * `position`) that clears `radius` — labels then ring the object like an
   * anatomical plate, whichever way it is turned. Hotspots sharing a `group`
   * keep out of each other's way.
   */
  radial?: { from: [number, number, number]; radius: number; group?: RingGroup }
  /** show just the tappable dot until the part is selected (small screens) */
  dotOnly?: boolean
}

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()

/**
 * A named part of the scene: a tappable label pinned to a 3D point, and the
 * spot the camera flies to when that part is selected anywhere in the app.
 */
export function Hotspot({
  id, kind = 'cellPart', position, radius, label, color, angle = -35, length = 38, showWithin, showBeyond, silent = false, radial, dotOnly = false,
}: HotspotProps) {
  const registry = useContext(ViewerCtx)
  const anchor = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const showLabels = useAppStore((s) => s.showLabels)
  const active = useAppStore((s) => s.selection?.kind === kind && s.selection.id === id)
  const setSelection = useAppStore((s) => s.setSelection)
  const key = `${kind}:${id}`

  useEffect(() => {
    if (!registry) return
    const entry = {
      position: () => (anchor.current ? anchor.current.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(...position)),
      radius: () => (anchor.current ? radius * anchor.current.getWorldScale(new THREE.Vector3()).x : radius),
    }
    registry.focus.set(key, entry)
    return () => {
      if (registry.focus.get(key) === entry) registry.focus.delete(key)
    }
  }, [registry, key, radius, position])

  const gated = showWithin !== undefined || showBeyond !== undefined
  useFrame(({ camera, size }) => {
    const group = anchor.current
    if (!group || !el.current) return
    if (gated) {
      const d = camera.position.distanceTo(group.getWorldPosition(tmp))
      const on = (showWithin === undefined || d < showWithin) && (showBeyond === undefined || d > showBeyond)
      el.current.style.opacity = on || active ? '1' : '0'
      el.current.style.pointerEvents = on || active ? '' : 'none'
    }
    if (radial && line.current && pill.current && group.parent) {
      // screen-space direction from the object's centre to this anchor
      const a = group.getWorldPosition(tmp)
      const depth = camera.position.distanceTo(a)
      const c = group.parent.localToWorld(tmp2.set(...radial.from))
      const scale = group.getWorldScale(new THREE.Vector3()).x
      a.project(camera)
      c.project(camera)
      let dx = (a.x - c.x) * size.width * 0.5
      let dy = -(a.y - c.y) * size.height * 0.5
      const off = Math.hypot(dx, dy)
      if (off < 6) {
        dx = Math.cos((angle * Math.PI) / 180)
        dy = Math.sin((angle * Math.PI) / 180)
      } else {
        dx /= off
        dy /= off
      }
      const clear = (radial.radius * scale) / Math.max(1e-6, depth * pixelWorld(camera, size.height))
      let lx: number
      let ly: number
      if (clear > Math.min(size.width, size.height) * 0.44) {
        // zoomed in past the ring: fall back to a short local leader
        lx = Math.cos((angle * Math.PI) / 180) * (length + 14)
        ly = Math.sin((angle * Math.PI) / 180) * (length + 14)
      } else {
        const rx = clear * 1.06 + 14
        const ry = clear * 0.8 + 14
        let theta = Math.atan2(dy, dx)
        if (radial.group) {
          radial.group.rx = rx
          radial.group.ry = ry
          radial.group.want.set(key, theta)
          theta = radial.group.got.get(key) ?? theta
        }
        // label point on the ellipse, relative to this anchor
        lx = Math.cos(theta) * rx - (a.x - c.x) * size.width * 0.5
        ly = Math.sin(theta) * ry + (a.y - c.y) * size.height * 0.5
      }
      const len = Math.hypot(lx, ly) || 1
      const ux = lx / len
      const uy = ly / len
      line.current.style.width = `${len}px`
      line.current.style.transform = `rotate(${Math.atan2(ly, lx)}rad)`
      pill.current.style.left = `${lx}px`
      pill.current.style.top = `${ly}px`
      pill.current.style.transform = `translate(${ux < -0.3 ? '-100%' : ux > 0.3 ? '0' : '-50%'}, ${uy < -0.75 ? '-100%' : uy > 0.75 ? '0' : '-50%'})`
    }
  })

  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad) * length
  const dy = Math.sin(rad) * length
  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setSelection(active ? null : { kind, id })
  }
  const labelled = !dotOnly || active
  return (
    <group ref={anchor} position={position}>
      {!silent && showLabels && (
        <Html zIndexRange={active ? [32, 31] : [30, 10]} style={{ pointerEvents: 'none' }}>
          <div ref={el} className="hs" data-active={active} style={{ ['--hs-c' as string]: color, opacity: gated ? 0 : 1 }}>
            {dotOnly ? (
              <button type="button" className="hs-dot hs-tap" aria-label={label} onClick={toggle} />
            ) : (
              <span className="hs-dot" />
            )}
            {labelled && (
              <>
                <span ref={line} className="hs-line" style={{ width: length, transform: `rotate(${angle}deg)` }} />
                <button
                  ref={pill}
                  type="button"
                  className="hs-pill"
                  style={{ left: dx, top: dy, transform: `translate(${dx < 0 ? '-100%' : '0'}, -50%)` }}
                  onClick={toggle}
                >
                  <i aria-hidden />
                  {label}
                </button>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
