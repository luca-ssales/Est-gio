import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStadiumStore } from '../../store/useStadiumStore'
import { getSeat } from '../../data/seats'
import type { MapView, Stage } from '../../types'
import { publishCameraTelemetry } from './cameraTelemetry'
import { publishDroneTelemetry } from './droneTelemetry'
import { DRONE_DURATION, sampleDroneTour } from './droneTour'
import {
  MAP_AZ,
  MAP_EL,
  MAP_TOP_AZ,
  MAP_TOP_EL,
  PITCH_MAX,
  PITCH_MIN,
  SECTOR_EL,
  YAW_RANGE,
  desiredPose,
  lookQuat,
  seatViewBase,
  viewDefaultFov,
  type Offsets,
  type Pose,
} from './poses'

interface Anim {
  fromPos: THREE.Vector3
  fromQuat: THREE.Quaternion
  fromFov: number
  t: number
  dur: number
  curve: 'line' | 'descend' | 'ascend'
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
const clamp = THREE.MathUtils.clamp
const fwd = new THREE.Vector3()
const dronePos = new THREE.Vector3()
const droneLook = new THREE.Vector3()
const droneTgtQuat = new THREE.Quaternion()
const rollQuat = new THREE.Quaternion()
const LOCAL_Z = new THREE.Vector3(0, 0, -1)
const endOverviewPose: Pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 30 }

function defaults(stage: Stage, mapView: MapView, aspect: number): Offsets {
  return {
    az: stage === 'map' ? (mapView === 'top' ? MAP_TOP_AZ : MAP_AZ) : 0,
    el: stage === 'map' ? (mapView === 'top' ? MAP_TOP_EL : MAP_EL) : SECTOR_EL,
    zoom: 1,
    yaw: 0,
    pitch: 0,
    fov: viewDefaultFov(aspect),
  }
}

/**
 * Single camera controller for the whole experience.
 * Every stage has a "desired pose"; when the stage/selection changes the camera
 * flies from wherever it is to the new pose (position lerp/bezier + quaternion slerp + fov).
 * User input only edits damped offsets (orbit for map/sector, yaw/pitch/fov for the seat view).
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  const r = useRef({
    key: '',
    stage: 'map' as Stage,
    anim: null as Anim | null,
    cur: defaults('map', 'overview', 1.6),
    tgt: defaults('map', 'overview', 1.6),
    resetToken: 0,
    keys: new Set<string>(),
    lastActivity: -Infinity,
    idleWeight: 1,
    pointerCount: 0,
    pose: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 30 } as Pose,
    drone: {
      active: false,
      elapsed: 0,
      startPos: new THREE.Vector3(),
      startQuat: new THREE.Quaternion(),
      startFov: 30,
    },
  })

  // re-render whenever the store changes (frameloop = "demand") and trigger initial render
  useEffect(() => {
    invalidate()
    return useStadiumStore.subscribe(() => invalidate())
  }, [invalidate])

  // ---------- input ----------
  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number; downX: number; downY: number }>()
    let pinch = 0
    let idleTimer: number | null = null

    const markActivity = () => {
      const s = r.current
      s.lastActivity = performance.now()
      s.idleWeight = 0
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        const st = useStadiumStore.getState()
        if (st.stage === 'map' && st.mapView === 'overview' && !st.droneTour) invalidate()
      }, 1850)
    }

    const applyZoom = (factor: number) => {
      markActivity()
      const st = useStadiumStore.getState()
      if (st.droneTour) st.stopDroneTour()
      const s = r.current
      if (s.anim) return
      if (s.stage === 'view') s.tgt.fov = clamp(s.tgt.fov * factor, 16, 78)
      else s.tgt.zoom = clamp(s.tgt.zoom * factor, s.stage === 'map' ? 0.35 : 0.4, s.stage === 'map' ? 1.55 : 1.7)
      invalidate()
    }

    const onDown = (e: PointerEvent) => {
      markActivity()
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, downX: e.clientX, downY: e.clientY })
      r.current.pointerCount = pointers.size
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onMove = (e: PointerEvent) => {
      markActivity()
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      const st = useStadiumStore.getState()
      if (st.droneTour) {
        if (Math.hypot(e.clientX - p.downX, e.clientY - p.downY) > 8) {
          st.stopDroneTour()
        }
        return
      }
      const s = r.current
      if (s.anim) return
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && dist > 0) applyZoom(pinch / dist)
        pinch = dist
        return
      }
      if (pointers.size !== 1) return
      const t = s.tgt
      if (s.stage === 'view') {
        const k = THREE.MathUtils.degToRad(camera.fov) / el.clientHeight
        t.yaw = clamp(t.yaw + dx * k, -YAW_RANGE, YAW_RANGE)
        t.pitch = t.pitch + dy * k
        const seatId = useStadiumStore.getState().selectedSeatId
        const seat = seatId ? getSeat(seatId) : null
        if (seat) {
          const base = seatViewBase(seat)
          t.pitch = clamp(t.pitch, PITCH_MIN - base.pitch, PITCH_MAX - base.pitch)
        }
        if (Math.abs(dx) + Math.abs(dy) > 2) useStadiumStore.getState().markLookedAround()
      } else if (s.stage === 'map') {
        t.az -= dx * 0.005
        t.el = clamp(t.el + dy * 0.004, 0.48, 1.52)
      } else {
        t.az = clamp(t.az - dx * 0.004, -0.7, 0.7)
        t.el = clamp(t.el + dy * 0.004, 0.55, 1.45)
      }
      invalidate()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      r.current.pointerCount = pointers.size
      pinch = 0
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      applyZoom(Math.exp(e.deltaY * 0.0012))
    }
    const MOVE_KEYS = new Set([
      'w',
      'a',
      's',
      'd',
      'q',
      'e',
      '+',
      '-',
      '=',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ])
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      const s = r.current
      if (k === 'r' && s.stage === 'view' && !s.anim) {
        useStadiumStore.getState().resetView()
        invalidate()
        return
      }
      if (!MOVE_KEYS.has(k)) return
      markActivity()
      const st = useStadiumStore.getState()
      if (st.droneTour) st.stopDroneTour()
      if (!s.keys.has(k)) {
        s.keys.add(k)
        invalidate()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      r.current.keys.delete(e.key.toLowerCase())
    }
    const onBlur = () => {
      r.current.keys.clear()
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [gl, camera, invalidate])

  // ---------- per frame ----------
  useFrame((_, delta) => {
    const s = r.current
    const st = useStadiumStore.getState()
    const aspect = size.width / Math.max(1, size.height)
    const dt = Math.min(delta, 0.05)

    if (st.droneTour) {
      if (!s.drone.active) {
        s.drone.active = true
        s.drone.elapsed = 0
        s.drone.startPos.copy(camera.position)
        s.drone.startQuat.copy(camera.quaternion)
        s.drone.startFov = camera.fov
        s.anim = null
        s.stage = 'map'
        s.key = 'map|overview||'
      }

      s.drone.elapsed += dt
      const u = Math.min(1, s.drone.elapsed / DRONE_DURATION)
      const sample = sampleDroneTour(u, dronePos, droneLook)
      lookQuat(dronePos, droneLook, droneTgtQuat)
      rollQuat.setFromAxisAngle(LOCAL_Z, sample.bankRad)
      droneTgtQuat.multiply(rollQuat)

      // Smoothly converge final 14% onto exact aspect-fitted overview pose
      const ovDefaults = defaults('map', 'overview', aspect)
      desiredPose(
        { stage: 'map', mapView: 'overview', sectorId: null, seatId: null, aspect, off: ovDefaults },
        endOverviewPose,
      )
      const endBlend = smoothstep(0.86, 1.0, u)
      if (endBlend > 0) {
        dronePos.lerp(endOverviewPose.pos, endBlend)
        droneTgtQuat.slerp(endOverviewPose.quat, endBlend)
      }
      const targetFov = THREE.MathUtils.lerp(sample.fov, endOverviewPose.fov, endBlend)

      const inBlend = smoothstep(0, 1.5, s.drone.elapsed)
      camera.position.lerpVectors(s.drone.startPos, dronePos, inBlend)
      camera.quaternion.slerpQuaternions(s.drone.startQuat, droneTgtQuat, inBlend)
      camera.fov = THREE.MathUtils.lerp(s.drone.startFov, targetFov, inBlend)
      const targetNear = camera.position.y < 52 ? 0.35 : 2.0
      if (camera.near !== targetNear) camera.near = targetNear
      camera.updateProjectionMatrix()

      publishDroneTelemetry(u, sample.actIndex)
      invalidate()

      if (u >= 1) {
        s.drone.active = false
        s.cur = { ...ovDefaults }
        s.tgt = { ...ovDefaults }
        s.lastActivity = performance.now()
        s.idleWeight = 0
        st.stopDroneTour()
      }
      return
    }

    const seatKey = st.stage === 'sector' || st.stage === 'view' ? st.selectedSeatId ?? '' : ''
    const mapSub = st.stage === 'map' ? st.mapView : ''
    const key = `${st.stage}|${mapSub}|${st.stage === 'map' ? '' : st.selectedSectorId}|${seatKey}`

    if (s.drone.active && !st.droneTour) {
      s.drone.active = false
      const d = defaults(st.stage, st.mapView, aspect)
      s.cur = { ...d }
      s.tgt = { ...d }
      s.stage = st.stage
      s.key = key
      s.lastActivity = performance.now()
      s.idleWeight = 0
      s.anim = {
        fromPos: camera.position.clone(),
        fromQuat: camera.quaternion.clone(),
        fromFov: camera.fov,
        t: 0,
        dur: 1.35,
        curve: 'line',
      }
      st.setTransitioning(true)
    }

    if (key !== s.key) {
      const first = s.key === ''
      const prevStage = s.stage
      const prevSector = s.key.split('|')[2]
      const sameSector = prevSector === st.selectedSectorId
      // reset offsets for the new stage (keep orbit when only the seat changed inside a sector; preserve fov when hopping seats in view)
      const sameView = prevStage === 'view' && st.stage === 'view'
      if (!(prevStage === 'sector' && st.stage === 'sector' && sameSector)) {
        const prevFov = s.tgt.fov
        const d = defaults(st.stage, st.mapView, aspect)
        s.tgt = { ...d, fov: sameView ? prevFov : d.fov }
        s.cur = { ...d, fov: sameView ? s.cur.fov : d.fov }
      }
      let dur = 1.7
      let curve: Anim['curve'] = 'line'
      if (prevStage === 'map' && st.stage === 'map') {
        dur = 1.35
      } else if (prevStage === 'sector' && st.stage === 'view') {
        dur = 2.8
        curve = 'descend'
      } else if (prevStage === 'view' && st.stage === 'sector') {
        dur = 2.2
        curve = 'ascend'
      } else if (sameView) {
        dur = 0.85
      } else if (prevStage === 'sector' && st.stage === 'sector') {
        dur = sameSector ? 0.9 : 1.4
      }
      s.stage = st.stage
      s.key = key
      if (!first) {
        s.anim = {
          fromPos: camera.position.clone(),
          fromQuat: camera.quaternion.clone(),
          fromFov: camera.fov,
          t: 0,
          dur,
          curve,
        }
        st.setTransitioning(true)
      }
    }

    if (st.resetToken !== s.resetToken) {
      s.resetToken = st.resetToken
      if (s.stage === 'view') {
        const d = defaults('view', st.mapView, aspect)
        s.tgt.yaw = 0
        s.tgt.pitch = 0
        s.tgt.fov = d.fov
      }
    }

    // apply held WASD / Arrow keys and damp offsets
    let moving = false
    if (!s.anim && s.keys.size > 0) {
      const left = s.keys.has('a') || s.keys.has('arrowleft') ? 1 : 0
      const right = s.keys.has('d') || s.keys.has('arrowright') ? 1 : 0
      const up = s.keys.has('w') || s.keys.has('arrowup') ? 1 : 0
      const down = s.keys.has('s') || s.keys.has('arrowdown') ? 1 : 0
      const zoomIn = s.keys.has('e') || s.keys.has('+') || s.keys.has('=') ? 1 : 0
      const zoomOut = s.keys.has('q') || s.keys.has('-') ? 1 : 0
      const h = left - right
      const v = up - down
      const zDir = zoomIn - zoomOut
      if (h !== 0 || v !== 0) {
        if (s.stage === 'view') {
          const speed = 1.15 * dt
          s.tgt.yaw = clamp(s.tgt.yaw + h * speed, -YAW_RANGE, YAW_RANGE)
          let nextPitch = s.tgt.pitch + v * speed
          const seat = st.selectedSeatId ? getSeat(st.selectedSeatId) : null
          if (seat) {
            const base = seatViewBase(seat)
            nextPitch = clamp(nextPitch, PITCH_MIN - base.pitch, PITCH_MAX - base.pitch)
          }
          s.tgt.pitch = nextPitch
          st.markLookedAround()
        } else if (s.stage === 'map') {
          s.tgt.az -= h * 1.1 * dt
          s.tgt.el = clamp(s.tgt.el + v * 0.85 * dt, 0.48, 1.52)
        } else {
          s.tgt.az = clamp(s.tgt.az - h * 0.9 * dt, -0.7, 0.7)
          s.tgt.el = clamp(s.tgt.el + v * 0.8 * dt, 0.55, 1.45)
        }
        moving = true
      }
      if (zDir !== 0) {
        const factor = Math.exp(-zDir * 0.9 * dt)
        if (s.stage === 'view') {
          s.tgt.fov = clamp(s.tgt.fov * factor, 16, 78)
        } else {
          s.tgt.zoom = clamp(
            s.tgt.zoom * factor,
            s.stage === 'map' ? 0.35 : 0.4,
            s.stage === 'map' ? 1.55 : 1.7,
          )
        }
        moving = true
      }
    }

    // Ultra-slow cinematic idle auto-orbit in overview map view when cursor is still
    if (st.stage === 'map' && st.mapView === 'overview' && !s.anim && s.pointerCount === 0 && s.keys.size === 0 && !st.hoveredSectorId) {
      if (performance.now() - s.lastActivity >= 1800) {
        s.idleWeight = Math.min(1, s.idleWeight + dt / 1.5)
        s.tgt.az += 0.075 * s.idleWeight * dt
        moving = true
      }
    }

    const k = 1 - Math.exp(-dt * 9)
    const c = s.cur
    const t = s.tgt
    for (const f of ['az', 'el', 'zoom', 'yaw', 'pitch', 'fov'] as const) {
      const diff = t[f] - c[f]
      if (Math.abs(diff) > 1e-4) {
        c[f] += diff * k
        moving = true
      } else c[f] = t[f]
    }

    const pose = desiredPose(
      { stage: st.stage, mapView: st.mapView, sectorId: st.selectedSectorId, seatId: st.selectedSeatId, aspect, off: c },
      s.pose,
    )

    if (s.anim) {
      const a = s.anim
      a.t = Math.min(1, a.t + dt / a.dur)
      const e = ease(a.t)
      if (a.curve === 'line') {
        camera.position.lerpVectors(a.fromPos, pose.pos, e)
      } else {
        // quadratic bezier: drop into the seat from above / rise out of it
        const A = a.fromPos
        const B = pose.pos
        const C =
          a.curve === 'descend'
            ? new THREE.Vector3(B.x, A.y + (B.y - A.y) * 0.3, B.z)
            : new THREE.Vector3(A.x, A.y + (B.y - A.y) * 0.7, A.z)
        const u = 1 - e
        camera.position.set(
          u * u * A.x + 2 * u * e * C.x + e * e * B.x,
          u * u * A.y + 2 * u * e * C.y + e * e * B.y,
          u * u * A.z + 2 * u * e * C.z + e * e * B.z,
        )
      }
      const er = ease(Math.min(1, a.t * 1.12))
      camera.quaternion.slerpQuaternions(a.fromQuat, pose.quat, er)
      camera.fov = THREE.MathUtils.lerp(a.fromFov, pose.fov, e)
      if (a.t >= 1) {
        s.anim = null
        st.setTransitioning(false)
        if (st.stage === 'view') st.setViewPanelReady(true)
      }
      moving = true
    } else {
      camera.position.copy(pose.pos)
      camera.quaternion.copy(pose.quat)
      camera.fov = pose.fov
    }
    const targetNear =
      st.stage === 'view' || s.anim?.curve === 'descend' || s.anim?.curve === 'ascend'
        ? 0.35
        : st.stage === 'sector'
          ? 1.0
          : 4.0
    if (camera.near !== targetNear) camera.near = targetNear
    camera.updateProjectionMatrix()
    if (st.stage === 'view') {
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
      const len = Math.hypot(fwd.x, fwd.z) || 1
      const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect)
      publishCameraTelemetry(fwd.x / len, fwd.z / len, hFov)
    }
    if (moving) invalidate()
  })

  return null
}
