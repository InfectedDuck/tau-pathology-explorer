import * as THREE from 'three'

export interface NeuriteUniforms {
  /** um of branch removed from every tip (dendritic retraction / dying-back) */
  uRetract: { value: number }
  uRetractSoft: { value: number }
  /** axons die back more slowly than dendrites retract */
  uAxonRetract: { value: number }
  /** thinnest a branch may appear on screen, in CSS pixels */
  uMinPx: { value: number }
  /** world units covered by one pixel at view depth 1 */
  uPixelWorld: { value: number }
  /** world units per object unit (um) */
  uObjScale: { value: number }
  /** process thickening (reactive astrocytes) */
  uSwell: { value: number }
  /** how far the tau-burden front has travelled from the soma, 0..~1.2 */
  uTauFront: { value: number }
  uTauColor: { value: THREE.Color }
  uTauGlow: { value: number }
  uRimColor: { value: THREE.Color }
  uRimStrength: { value: number }
  uRimPower: { value: number }
  /** SWC types to spotlight (-1 = none); everything else dims */
  uFocusA: { value: number }
  uFocusB: { value: number }
  uFocusAmt: { value: number }
}

export interface NeuriteMaterial {
  material: THREE.MeshStandardMaterial
  uniforms: NeuriteUniforms
}

/**
 * Standard PBR material extended for branch trees built by lib/cellTree:
 * tip retraction, a minimum on-screen thickness, a tau front spreading from
 * the soma, compartment spotlighting and a fresnel rim.
 *
 * `instanced` reads retraction and tau front per instance (attributes
 * `aInstRetract`, `aInstTau`) instead of from uniforms.
 */
export function createNeuriteMaterial(opts: {
  instanced?: boolean
  params?: THREE.MeshStandardMaterialParameters
  rim?: THREE.ColorRepresentation
  tau?: THREE.ColorRepresentation
}): NeuriteMaterial {
  const uniforms: NeuriteUniforms = {
    uRetract: { value: 0 },
    uRetractSoft: { value: 14 },
    uAxonRetract: { value: 0.42 },
    uMinPx: { value: 1.05 },
    uPixelWorld: { value: 0.001 },
    uObjScale: { value: 0.01 },
    uSwell: { value: 1 },
    uTauFront: { value: 0 },
    uTauColor: { value: new THREE.Color(opts.tau ?? '#f97316') },
    uTauGlow: { value: 0.55 },
    uRimColor: { value: new THREE.Color(opts.rim ?? '#7dd3fc') },
    uRimStrength: { value: 0.5 },
    uRimPower: { value: 2.4 },
    uFocusA: { value: -1 },
    uFocusB: { value: -1 },
    uFocusAmt: { value: 0 },
  }
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.05,
    ...opts.params,
  })
  const instanced = !!opts.instanced
  material.defines = { ...(material.defines ?? {}), ...(instanced ? { INSTANCED_STATE: '' } : {}) }
  material.customProgramCacheKey = () => `neurite-${instanced ? 'inst' : 'single'}`
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute float aRadius;
attribute float aHeight;
attribute float aDist;
attribute float aPart;
uniform float uRetract;
uniform float uRetractSoft;
uniform float uAxonRetract;
uniform float uMinPx;
uniform float uPixelWorld;
uniform float uObjScale;
uniform float uSwell;
varying float vDist;
varying float vPart;
#ifdef INSTANCED_STATE
attribute float aInstRetract;
attribute float aInstTau;
varying float vInstTau;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `vec3 transformed = vec3( position );
#ifdef INSTANCED_STATE
float nRetract = aInstRetract;
vInstTau = aInstTau;
#else
float nRetract = uRetract;
#endif
vDist = aDist;
vPart = aPart;
if ( abs( aPart - 2.0 ) < 0.5 ) nRetract *= uAxonRetract;
float nKeep = nRetract <= 0.0 ? 1.0 : smoothstep( nRetract, nRetract + uRetractSoft, aHeight );
bool nTube = aRadius < 1.0e5;
float nR = nTube ? aRadius : 0.0;
// collapse retracted branch onto its centreline, thicken reactive processes
transformed -= objectNormal * nR * ( 1.0 - nKeep );
transformed += objectNormal * nR * ( uSwell - 1.0 ) * nKeep;
// never thinner than uMinPx pixels on screen
vec4 nMv = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
nMv = instanceMatrix * nMv;
#endif
nMv = modelViewMatrix * nMv;
float nPix = max( 0.0, -nMv.z ) * uPixelWorld * uMinPx / uObjScale;
if ( nTube ) transformed += objectNormal * max( 0.0, nPix - nR * uSwell ) * nKeep;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform vec3 uTauColor;
uniform float uTauFront;
uniform float uTauGlow;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;
uniform float uFocusA;
uniform float uFocusB;
uniform float uFocusAmt;
varying float vDist;
varying float vPart;
#ifdef INSTANCED_STATE
varying float vInstTau;
#endif`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
#ifdef INSTANCED_STATE
float nFront = vInstTau;
#else
float nFront = uTauFront;
#endif
float nTau = nFront <= 0.0 ? 0.0 : 1.0 - smoothstep( nFront - 0.24, nFront, vDist );
diffuseColor.rgb = mix( diffuseColor.rgb, uTauColor, nTau * 0.82 );
float nLit = 1.0;
if ( uFocusA >= 0.0 ) {
  float nMatch = max( 1.0 - step( 0.5, abs( vPart - uFocusA ) ), 1.0 - step( 0.5, abs( vPart - uFocusB ) ) );
  nLit = mix( 1.0, mix( 0.3, 1.0, nMatch ), uFocusAmt );
  diffuseColor.rgb *= nLit;
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
float nFres = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), uRimPower );
totalEmissiveRadiance += ( uRimColor * nFres * uRimStrength + uTauColor * nTau * uTauGlow ) * nLit;
if ( uFocusA >= 0.0 && nLit > 0.99 ) totalEmissiveRadiance += diffuseColor.rgb * 0.22 * uFocusAmt;`,
      )
  }
  return { material, uniforms }
}

/**
 * Adds a fresnel rim glow to any standard/physical material — the soft edge
 * light that makes organic forms read against a dark field.
 */
export function withRim<T extends THREE.MeshStandardMaterial>(material: T, color: THREE.ColorRepresentation, strength = 0.5, power = 2.5): T {
  const uniforms = {
    uRimColor: { value: new THREE.Color(color) },
    uRimStrength: { value: strength },
    uRimPower: { value: power },
  }
  material.userData.rim = uniforms
  material.customProgramCacheKey = () => 'rim'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
float rimF = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), uRimPower );
totalEmissiveRadiance += uRimColor * rimF * uRimStrength;`,
      )
  }
  return material
}

/** World units covered by one CSS pixel at view depth 1 for a perspective camera. */
export function pixelWorld(camera: THREE.Camera, viewportHeight: number): number {
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 40
  return (2 * Math.tan((fov * Math.PI) / 360)) / Math.max(1, viewportHeight)
}
