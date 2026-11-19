import * as THREE from 'three'
import type { MapView, Seat, Stage } from '../../types'
import { EYE_HEIGHT } from '../../data/stadium'
import { SECTOR_BY_ID } from '../../data/sectors'
import { getSeat } from '../../data/seats'
import { sectorAnchor } from '../utils/sectorGeometry'

export const MAP_FOV = 30
export const SECTOR_FOV = 40
export const MAP_AZ = -0.52
export const MAP_EL = 0.72
export const MAP_TOP_AZ = 0
export const MAP_TOP_EL = 1.5
export const SECTOR_EL = 0.98

export const viewDefaultFov = (aspect: number) => (aspect < 0.8 ? 70 : 58)

export interface Pose {
  pos: THREE.Vector3
  quat: THREE.Quaternion
  fov: number
}

export interface Offsets {
  az: number
  el: number
  zoom: number
  yaw: number
  pitch: number
  fov: number
}

const UP = new THREE.Vector3(0, 1, 0)
const M = new THREE.Matrix4()
const E = new THREE.Euler(0, 0, 0, 'YXZ')
const tmp = new THREE.Vector3()

export function lookQuat(pos: THREE.Vector3, target: THREE.Vector3, out: THREE.Quaternion) {
  M.lookAt(pos, target, UP)
  return out.setFromRotationMatrix(M)
}

function orbit(target: THREE.Vector3, az: number, el: number, dist: number, out: THREE.Vector3) {
  return out.set(
    target.x + dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.cos(az),
  )
}

function mapDistance(aspect: number) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2))
  const halfZ = 148
  const halfX = 128
  const dz = ((halfZ * Math.sin(MAP_EL) + 46) * 1.24) / tanV
  const dx = (halfX * 1.12) / (tanV * aspect)
  return Math.max(dz, dx)
}

function topMapDistance(aspect: number) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2))
  const dz = (132 * 1.13) / tanV + 24
  const dx = (118 * 1.15) / (tanV * aspect) + 24
  return Math.max(dz, dx)
}

function sectorDistance(width: number, depth: number, aspect: number) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(SECTOR_FOV / 2))
  const dw = (width * 0.72) / (tanV * aspect)
  const dd = (depth * 1.0) / tanV
  return Math.max(dw, dd, 22)
}

export interface ViewBase {
  eye: THREE.Vector3
  yaw: number
  pitch: number
}

/** Natural seated pose: eye above the tread, looking at the centre spot. */
export function seatViewBase(seat: Seat): ViewBase {
  const eye = new THREE.Vector3(seat.x, seat.y + EYE_HEIGHT, seat.z)
  // nudge slightly forward (seat pan, not seat back)
  eye.x += Math.sin(seat.rotY) * 0.08
  eye.z += Math.cos(seat.rotY) * 0.08
  const target = new THREE.Vector3(0, 0, 0)
  const dir = tmp.subVectors(target, eye).normalize()
  return { eye, yaw: Math.atan2(-dir.x, -dir.z), pitch: Math.asin(dir.y) }
}

export const PITCH_MIN = -1.1
export const PITCH_MAX = 0.6
export const YAW_RANGE = 1.75

export interface DesiredInput {
  stage: Stage
  mapView?: MapView
  sectorId: string | null
  seatId: string | null
  aspect: number
  off: Offsets
}

/** Computes where the camera should be for the current stage + user offsets. */
export function desiredPose(input: DesiredInput, out: Pose) {
  const { stage, mapView = 'overview', sectorId, seatId, aspect, off } = input
  const sector = sectorId ? SECTOR_BY_ID[sectorId] : null
  if (stage === 'view' && seatId) {
    const seat = getSeat(seatId)
    if (seat) {
      const base = seatViewBase(seat)
      const pitch = THREE.MathUtils.clamp(base.pitch + off.pitch, PITCH_MIN, PITCH_MAX)
      E.set(pitch, base.yaw + off.yaw, 0, 'YXZ')
      out.pos.copy(base.eye)
      out.quat.setFromEuler(E)
      out.fov = off.fov
      return out
    }
  }
  if ((stage === 'sector' || stage === 'view') && sector) {
    const a = sectorAnchor(sector)
    const target = a.center.clone()
    if (seatId && seatId.startsWith(sector.id + '-')) {
      const seat = getSeat(seatId)
      if (seat) target.lerp(new THREE.Vector3(seat.x, seat.y + 0.6, seat.z), 0.3)
    }
    const baseAz = Math.atan2(-a.normal.x, -a.normal.z)
    const dist = sectorDistance(a.width, a.depth, aspect) * off.zoom
    orbit(target, baseAz + off.az, off.el, dist, out.pos)
    lookQuat(out.pos, target, out.quat)
    out.fov = SECTOR_FOV
    return out
  }
  const isTop = stage === 'map' && mapView === 'top'
  const target = new THREE.Vector3(0, 0, isTop ? 0 : 4)
  const dist = (isTop ? topMapDistance(aspect) : mapDistance(aspect)) * off.zoom
  orbit(target, off.az, off.el, dist, out.pos)
  lookQuat(out.pos, target, out.quat)
  out.fov = MAP_FOV
  return out
}
