import * as THREE from 'three'
import type { LightingMode } from '../../types'

export interface LightingSample {
  skyZenith: THREE.Color
  skyMid: THREE.Color
  skyHorizon: THREE.Color
  cloudColor: THREE.Color
  cloudOpacity: number
  sunDir: THREE.Vector3
  duskFactor: number
  bg: THREE.Color
  fogColor: THREE.Color
  fogNear: number
  fogFar: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiInt: number
  sunLightPos: THREE.Vector3
  sunInt: number
  sunColor: THREE.Color
  fill1Pos: THREE.Vector3
  fill1Int: number
  fill1Color: THREE.Color
  fill2Pos: THREE.Vector3
  fill2Int: number
  fill2Color: THREE.Color
  envInt: number
  lampFactor: number
  nightFactor: number
  meadowColor: THREE.Color
}

interface PresetKeyframe {
  skyZenith: THREE.Color
  skyMid: THREE.Color
  skyHorizon: THREE.Color
  cloudColor: THREE.Color
  cloudOpacity: number
  sunDir: THREE.Vector3
  bg: THREE.Color
  fogColor: THREE.Color
  fogNear: number
  fogFar: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiInt: number
  sunLightPos: THREE.Vector3
  sunInt: number
  sunColor: THREE.Color
  fill1Pos: THREE.Vector3
  fill1Int: number
  fill1Color: THREE.Color
  fill2Pos: THREE.Vector3
  fill2Int: number
  fill2Color: THREE.Color
  envInt: number
  meadowColor: THREE.Color
}

const KEYFRAMES: PresetKeyframe[] = [
  // 0: Day
  {
    skyZenith: new THREE.Color('#3e84d6'),
    skyMid: new THREE.Color('#7eb9ec'),
    skyHorizon: new THREE.Color('#d6eaf8'),
    cloudColor: new THREE.Color('#ffffff'),
    cloudOpacity: 0.42,
    sunDir: new THREE.Vector3(0.55, 0.56, -0.62).normalize(),
    bg: new THREE.Color('#8cbce8'),
    fogColor: new THREE.Color('#b9d6ee'),
    fogNear: 520,
    fogFar: 2400,
    hemiSky: new THREE.Color('#dff0ff'),
    hemiGround: new THREE.Color('#3d5e28'),
    hemiInt: 0.95,
    sunLightPos: new THREE.Vector3(150, 210, -160),
    sunInt: 3.3,
    sunColor: new THREE.Color('#fff6e8'),
    fill1Pos: new THREE.Vector3(30, 180, 40),
    fill1Int: 0.55,
    fill1Color: new THREE.Color('#ffffff'),
    fill2Pos: new THREE.Vector3(40, 70, 150),
    fill2Int: 0.35,
    fill2Color: new THREE.Color('#dce8ff'),
    envInt: 0.78,
    meadowColor: new THREE.Color('#4d8c28'),
  },
  // 1: Dusk / Golden hour
  {
    skyZenith: new THREE.Color('#162247'),
    skyMid: new THREE.Color('#6e4568'),
    skyHorizon: new THREE.Color('#f58b4c'),
    cloudColor: new THREE.Color('#ffb98a'),
    cloudOpacity: 0.48,
    sunDir: new THREE.Vector3(-0.88, 0.075, -0.46).normalize(),
    bg: new THREE.Color('#1c2135'),
    fogColor: new THREE.Color('#2a283c'),
    fogNear: 380,
    fogFar: 1750,
    hemiSky: new THREE.Color('#a6b4ff'),
    hemiGround: new THREE.Color('#1e1d24'),
    hemiInt: 0.56,
    sunLightPos: new THREE.Vector3(-155, 95, -75),
    sunInt: 2.65,
    sunColor: new THREE.Color('#ffc48a'),
    fill1Pos: new THREE.Vector3(30, 180, 40),
    fill1Int: 1.25,
    fill1Color: new THREE.Color('#e8f0ff'),
    fill2Pos: new THREE.Vector3(40, 70, 150),
    fill2Int: 0.42,
    fill2Color: new THREE.Color('#b8c8ff'),
    envInt: 0.55,
    meadowColor: new THREE.Color('#243a1a'),
  },
  // 2: Night
  {
    skyZenith: new THREE.Color('#03060f'),
    skyMid: new THREE.Color('#09132b'),
    skyHorizon: new THREE.Color('#121f3a'),
    cloudColor: new THREE.Color('#1d2b48'),
    cloudOpacity: 0.22,
    sunDir: new THREE.Vector3(-0.45, -0.32, -0.83).normalize(),
    bg: new THREE.Color('#05070e'),
    fogColor: new THREE.Color('#0a0e1a'),
    fogNear: 320,
    fogFar: 1500,
    hemiSky: new THREE.Color('#3c5080'),
    hemiGround: new THREE.Color('#0a0c12'),
    hemiInt: 0.38,
    sunLightPos: new THREE.Vector3(-70, 145, -90),
    sunInt: 2.45,
    sunColor: new THREE.Color('#e6f0ff'),
    fill1Pos: new THREE.Vector3(75, 130, 85),
    fill1Int: 1.55,
    fill1Color: new THREE.Color('#e2ecff'),
    fill2Pos: new THREE.Vector3(-60, 120, 80),
    fill2Int: 1.0,
    fill2Color: new THREE.Color('#d6e6ff'),
    envInt: 0.42,
    meadowColor: new THREE.Color('#0a120b'),
  },
]

export function modeToTimeOfDay(mode: LightingMode): number {
  if (mode === 'dusk') return 1
  if (mode === 'night') return 2
  return 0
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Shared mutable lighting progress read inside useFrame across all 3D subsystems (zero React re-renders). */
export const lightingState = {
  timeOfDay: 0,
  targetTimeOfDay: 0,
  lampFactor: 0,
  nightFactor: 0,
  transitioning: false,
}

const defaultOut: LightingSample = {
  skyZenith: new THREE.Color(),
  skyMid: new THREE.Color(),
  skyHorizon: new THREE.Color(),
  cloudColor: new THREE.Color(),
  cloudOpacity: 0.42,
  sunDir: new THREE.Vector3(),
  duskFactor: 0,
  bg: new THREE.Color(),
  fogColor: new THREE.Color(),
  fogNear: 520,
  fogFar: 2400,
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  hemiInt: 0.95,
  sunLightPos: new THREE.Vector3(),
  sunInt: 3.3,
  sunColor: new THREE.Color(),
  fill1Pos: new THREE.Vector3(),
  fill1Int: 0.55,
  fill1Color: new THREE.Color(),
  fill2Pos: new THREE.Vector3(),
  fill2Int: 0.35,
  fill2Color: new THREE.Color(),
  envInt: 0.78,
  lampFactor: 0,
  nightFactor: 0,
  meadowColor: new THREE.Color(),
}

/** Sample continuous lighting state for timeOfDay t ∈ [0 (day), 1 (dusk), 2 (night)] into `out`. */
export function sampleLightingPreset(tInput: number, out: LightingSample = defaultOut): LightingSample {
  const t = Math.max(0, Math.min(2, tInput))
  const idx = t < 1 ? 0 : 1
  const u = t < 1 ? t : t - 1
  const a = KEYFRAMES[idx]
  const b = KEYFRAMES[idx + 1]

  out.skyZenith.lerpColors(a.skyZenith, b.skyZenith, u)
  out.skyMid.lerpColors(a.skyMid, b.skyMid, u)
  out.skyHorizon.lerpColors(a.skyHorizon, b.skyHorizon, u)
  out.cloudColor.lerpColors(a.cloudColor, b.cloudColor, u)
  out.cloudOpacity = THREE.MathUtils.lerp(a.cloudOpacity, b.cloudOpacity, u)

  out.sunDir.lerpVectors(a.sunDir, b.sunDir, u).normalize()
  out.duskFactor = Math.exp(-Math.pow((t - 1.0) / 0.52, 2))

  out.bg.lerpColors(a.bg, b.bg, u)
  out.fogColor.lerpColors(a.fogColor, b.fogColor, u)
  out.fogNear = THREE.MathUtils.lerp(a.fogNear, b.fogNear, u)
  out.fogFar = THREE.MathUtils.lerp(a.fogFar, b.fogFar, u)

  out.hemiSky.lerpColors(a.hemiSky, b.hemiSky, u)
  out.hemiGround.lerpColors(a.hemiGround, b.hemiGround, u)
  out.hemiInt = THREE.MathUtils.lerp(a.hemiInt, b.hemiInt, u)

  out.sunLightPos.lerpVectors(a.sunLightPos, b.sunLightPos, u)
  out.sunInt = THREE.MathUtils.lerp(a.sunInt, b.sunInt, u)
  out.sunColor.lerpColors(a.sunColor, b.sunColor, u)

  out.fill1Pos.lerpVectors(a.fill1Pos, b.fill1Pos, u)
  out.fill1Int = THREE.MathUtils.lerp(a.fill1Int, b.fill1Int, u)
  out.fill1Color.lerpColors(a.fill1Color, b.fill1Color, u)

  out.fill2Pos.lerpVectors(a.fill2Pos, b.fill2Pos, u)
  out.fill2Int = THREE.MathUtils.lerp(a.fill2Int, b.fill2Int, u)
  out.fill2Color.lerpColors(a.fill2Color, b.fill2Color, u)

  out.envInt = THREE.MathUtils.lerp(a.envInt, b.envInt, u)
  out.lampFactor = smoothstep(0.42, 1.35, t)
  out.nightFactor = smoothstep(1.08, 1.95, t)
  out.meadowColor.lerpColors(a.meadowColor, b.meadowColor, u)

  return out
}
