import * as THREE from 'three'
import { getSeat } from '../../data/seats'
import { seatViewBase } from './poses'

export const TOUR_SEAT_ID = '306-20-33'
export const DRONE_DURATION = 26

export const DRONE_ACTS = [
  'Parque & Acessos · Arena Tech',
  'Mergulho na Arena',
  'Gramado & Aquecimento',
  'Setor 306 · Fileira 20 · Assento 33',
  'Panorâmica · 3 Anéis',
  'Visão Geral · Arena Tech',
] as const

const FALLBACK_SEAT_EYE = new THREE.Vector3(70.35, 35.42, -86.14)

let cachedSeatEye: THREE.Vector3 | null = null
function getTourSeatEye(): THREE.Vector3 {
  if (cachedSeatEye) return cachedSeatEye
  const seat = getSeat(TOUR_SEAT_ID)
  cachedSeatEye = seat ? seatViewBase(seat).eye.clone() : FALLBACK_SEAT_EYE.clone()
  return cachedSeatEye
}

let cachedApproachPos: THREE.CatmullRomCurve3 | null = null
let cachedApproachLook: THREE.CatmullRomCurve3 | null = null
let cachedDepartPos: THREE.CatmullRomCurve3 | null = null
let cachedDepartLook: THREE.CatmullRomCurve3 | null = null

function getCurves() {
  if (!cachedApproachPos) {
    const seatEye = getTourSeatEye()
    cachedApproachPos = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-235, 195, 290),
        new THREE.Vector3(-135, 96, 172),
        new THREE.Vector3(-42, 62, 72),
        new THREE.Vector3(-20, 24, 46),
        new THREE.Vector3(-6, 6.2, 22),
        new THREE.Vector3(18, 6.0, -16),
        new THREE.Vector3(38, 16, -48),
        new THREE.Vector3(56, 29.5, -70),
        seatEye.clone(),
      ],
      false,
      'centripetal',
    )

    cachedApproachLook = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 16, 0),
        new THREE.Vector3(0, 18, 0),
        new THREE.Vector3(0, 8, -10),
        new THREE.Vector3(4, 3, -12),
        new THREE.Vector3(8, 2.5, -24),
        new THREE.Vector3(0, 12, -55),
        new THREE.Vector3(-14, 14, -6),
        new THREE.Vector3(-6, 6, 0),
        new THREE.Vector3(0, 0, 0),
      ],
      false,
      'centripetal',
    )

    cachedDepartPos = new THREE.CatmullRomCurve3(
      [
        seatEye.clone(),
        new THREE.Vector3(56, 36.2, -62),
        new THREE.Vector3(46, 32.5, -12),
        new THREE.Vector3(34, 34, 38),
        new THREE.Vector3(10, 68, 64),
        new THREE.Vector3(-96, 190, 215),
        new THREE.Vector3(-248, 438, 437),
      ],
      false,
      'centripetal',
    )

    cachedDepartLook = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-18, 12, 6),
        new THREE.Vector3(-28, 16, 10),
        new THREE.Vector3(0, 6, -4),
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, 6, 2),
        new THREE.Vector3(0, 0, 4),
      ],
      false,
      'centripetal',
    )
  }

  return {
    approachPos: cachedApproachPos!,
    approachLook: cachedApproachLook!,
    departPos: cachedDepartPos!,
    departLook: cachedDepartLook!,
  }
}

const tanPrev = new THREE.Vector3()
const tanNext = new THREE.Vector3()
const fwdVec = new THREE.Vector3()
const rightVec = new THREE.Vector3()
const turnVec = new THREE.Vector3()
const worldUp = new THREE.Vector3(0, 1, 0)

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function quintic(x: number): number {
  return x * x * x * (10 + x * (-15 + 6 * x))
}

function computeBank(curve: THREE.CatmullRomCurve3, s: number, pos: THREE.Vector3, look: THREE.Vector3): number {
  const ds = 0.015
  curve.getTangent(Math.max(0, s - ds), tanPrev)
  curve.getTangent(Math.min(1, s + ds), tanNext)
  turnVec.subVectors(tanNext, tanPrev)
  fwdVec.subVectors(look, pos).normalize()
  rightVec.crossVectors(fwdVec, worldUp).normalize()
  const latTurn = turnVec.dot(rightVec)
  return THREE.MathUtils.clamp(-latTurn * 0.22, -0.055, 0.055)
}

export interface DroneSample {
  fov: number
  bankRad: number
  actIndex: number
}

const U_SIT_START = 0.48
const U_SIT_END = 0.62

/**
 * Sample the 4-act cinematic drone trajectory + Seat 306-20-33 sit-in at normalized time u ∈ [0, 1].
 * Writes camera position into `outPos` and look-at point into `outLook`.
 */
export function sampleDroneTour(uInput: number, outPos: THREE.Vector3, outLook: THREE.Vector3): DroneSample {
  const u = Math.max(0, Math.min(1, uInput))
  const { approachPos, approachLook, departPos, departLook } = getCurves()

  if (u <= U_SIT_START) {
    const sA = u / U_SIT_START
    // Ease out to zero velocity right as we sit in Setor 306
    const inv = 1 - sA
    const sCurved = 0.4 * (1 - inv * inv) + 0.6 * quintic(sA)

    approachPos.getPoint(sCurved, outPos)
    approachLook.getPoint(sCurved, outLook)

    const fov = sCurved < 0.45 ? THREE.MathUtils.lerp(30, 54, smoothstep(0.18, 0.45, sCurved)) : THREE.MathUtils.lerp(54, 58, smoothstep(0.6, 1.0, sCurved))
    const rawBank = computeBank(approachPos, sCurved, outPos, outLook)
    const bankRad = rawBank * (1 - smoothstep(0.82, 1.0, sA))

    let actIndex = 0
    if (sA >= 0.72) actIndex = 2
    else if (sA >= 0.34) actIndex = 1
    return { fov, bankRad, actIndex }
  }

  if (u <= U_SIT_END) {
    const p = (u - U_SIT_START) / (U_SIT_END - U_SIT_START)
    outPos.copy(getTourSeatEye())
    // Calm panning glance from Setor 306 framing ARENA TECH & the match pitch
    const glance = Math.sin(p * Math.PI)
    outLook.set(-12 * glance, 3.5 * glance, 14 * glance)
    return { fov: 58, bankRad: 0, actIndex: 3 }
  }

  const sB = (u - U_SIT_END) / (1 - U_SIT_END)
  // Zero initial velocity for smooth lift-off directly from the seat
  const sCurved = 0.35 * sB * sB + 0.65 * quintic(sB)

  departPos.getPoint(sCurved, outPos)
  departLook.getPoint(sCurved, outLook)

  const fov = sCurved < 0.35 ? THREE.MathUtils.lerp(58, 52, smoothstep(0.0, 0.35, sCurved)) : THREE.MathUtils.lerp(52, 30, smoothstep(0.35, 0.9, sCurved))
  const rawBank = computeBank(departPos, sCurved, outPos, outLook)
  const bankRad = rawBank * smoothstep(0.05, 0.25, sB) * (1 - smoothstep(0.75, 1.0, sB))

  const actIndex = sB < 0.52 ? 4 : 5
  return { fov, bankRad, actIndex }
}
