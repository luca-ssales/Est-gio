import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PARK_AVENUE_ANGLES } from '../../lib/textures'
import { mulberry32 } from '../../lib/random'
import { useStadiumStore } from '../../store/useStadiumStore'
import { lightingState } from '../StadiumLighting/lightingState'

export interface RouteSample {
  x: number
  z: number
  fx: number
  fz: number
  s: number
}

export interface TrafficRoute {
  closed: boolean
  points: RouteSample[]
  totalLen: number
}

interface RawPoint {
  x: number
  z: number
  fx: number
  fz: number
}

interface FleetCar {
  routeIdx: number
  s: number
  baseSpeed: number
  curSpeed: number
  scaleX: number
  scaleY: number
  scaleZ: number
  colorIdx: number
  x: number
  z: number
  fx: number
  fz: number
}

const LANE = 3.35
const FADE_EDGE_M = 28

// Neutral architectural palette that lets Arena Tech remain the visual hero
const CAR_PALETTE = [
  new THREE.Color('#eef2f6'),
  new THREE.Color('#cfd6df'),
  new THREE.Color('#9aa4b2'),
  new THREE.Color('#586270'),
  new THREE.Color('#2b313c'),
  new THREE.Color('#304361'),
  new THREE.Color('#dad3c6'),
]

const HEADLIGHT_DAY = new THREE.Color('#e8eef5')
const HEADLIGHT_DUSK = new THREE.Color(2.0, 1.88, 1.55)
const HEADLIGHT_NIGHT = new THREE.Color(2.5, 2.35, 1.95)

const TAILLIGHT_DAY = new THREE.Color('#7d1d27')
const TAILLIGHT_DUSK = new THREE.Color(1.95, 0.25, 0.32)
const TAILLIGHT_NIGHT = new THREE.Color(2.35, 0.28, 0.35)

function normalize2D(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z) || 1
  return [x / len, z / len]
}

/** Sample along inner CW (dir=+1) or outer CCW (dir=-1) ring parkway lane. */
function ringLaneSample(t: number, dir: 1 | -1): RawPoint {
  const cx = 205 * Math.cos(t)
  const cz = 225 * Math.sin(t)
  const [fx, fz] = normalize2D(dir * -205 * Math.sin(t), dir * 225 * Math.cos(t))
  // World right-hand vector (+Y up) for forward (fx, fz) is (-fz, fx)
  const rx = -fz
  const rz = fx
  return { x: cx + rx * LANE, z: cz + rz * LANE, fx, fz }
}

/** Sample along curved radial boulevard (dir=-1 inbound, dir=+1 outbound). */
function avenueLaneSample(a0: number, r: number, dir: 1 | -1): RawPoint {
  const ang = a0 + 0.14 * Math.sin(r / 120)
  const dAng = (0.14 / 120) * Math.cos(r / 120)
  const cosA = Math.cos(ang)
  const sinA = Math.sin(ang)
  const dx = cosA - r * sinA * dAng
  const dz = sinA + r * cosA * dAng
  const [fx, fz] = normalize2D(dir * dx, dir * dz)
  const rx = -fz
  const rz = fx
  return { x: cosA * r + rx * LANE, z: sinA * r + rz * LANE, fx, fz }
}

/** Bisect exact intersection between radial boulevard and the ring parkway centerline. */
function avenueRingIntersection(a0: number): { rInt: number; tInt: number } {
  let lo = 185
  let hi = 245
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) * 0.5
    const ang = a0 + 0.14 * Math.sin(mid / 120)
    const oval = Math.hypot((mid * Math.cos(ang)) / 205, (mid * Math.sin(ang)) / 225)
    if (oval < 1) lo = mid
    else hi = mid
  }
  const rInt = (lo + hi) * 0.5
  const ang = a0 + 0.14 * Math.sin(rInt / 120)
  const tInt = Math.atan2((rInt * Math.sin(ang)) / 225, (rInt * Math.cos(ang)) / 205)
  return { rInt, tInt }
}

/** Smooth quadratic Bezier corner fillet joining p0 and p2 along their tangents. */
function quadFillet(p0: RawPoint, p2: RawPoint, steps = 10): RawPoint[] {
  const dx = p2.x - p0.x
  const dz = p2.z - p0.z
  const det = p0.fx * p2.fz - p0.fz * p2.fx
  const alpha = Math.abs(det) > 1e-4 ? (dx * p2.fz - dz * p2.fx) / det : -1

  let cx: number
  let cz: number
  if (Math.abs(det) < 0.15 || alpha < 1 || alpha > 24) {
    cx = (p0.x + p2.x) * 0.5
    cz = (p0.z + p2.z) * 0.5
  } else {
    cx = p0.x + p0.fx * alpha
    cz = p0.z + p0.fz * alpha
  }

  const out: RawPoint[] = []
  for (let k = 1; k < steps; k++) {
    const u = k / steps
    const inv = 1 - u
    const x = inv * inv * p0.x + 2 * inv * u * cx + u * u * p2.x
    const z = inv * inv * p0.z + 2 * inv * u * cz + u * u * p2.z
    const tx = 2 * inv * (cx - p0.x) + 2 * u * (p2.x - cx)
    const tz = 2 * inv * (cz - p0.z) + 2 * u * (p2.z - cz)
    const [fx, fz] = normalize2D(tx, tz)
    out.push({ x, z, fx, fz })
  }
  return out
}

function finalizeRoute(raw: RawPoint[], closed: boolean): TrafficRoute {
  const points: RouteSample[] = []
  let s = 0
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i]
    if (i > 0) {
      const prev = raw[i - 1]
      s += Math.hypot(p.x - prev.x, p.z - prev.z)
    }
    points.push({ x: p.x, z: p.z, fx: p.fx, fz: p.fz, s })
  }
  let totalLen = s
  if (closed && raw.length > 1) {
    const first = raw[0]
    const last = raw[raw.length - 1]
    totalLen += Math.hypot(first.x - last.x, first.z - last.z)
  }
  return { closed, points, totalLen }
}

/** Build all 8 traffic routes: 2 continuous ring lanes + 6 boulevard-to-ring-to-boulevard routes. */
export function buildTrafficRoutes(): TrafficRoute[] {
  const routes: TrafficRoute[] = []

  // Route 0: Inner ring clockwise loop (dir = +1)
  const ringCW: RawPoint[] = []
  for (let i = 0; i < 180; i++) {
    ringCW.push(ringLaneSample((i / 180) * Math.PI * 2, 1))
  }
  routes.push(finalizeRoute(ringCW, true))

  // Route 1: Outer ring counter-clockwise loop (dir = -1)
  const ringCCW: RawPoint[] = []
  for (let i = 0; i < 180; i++) {
    ringCCW.push(ringLaneSample(Math.PI * 2 - (i / 180) * Math.PI * 2, -1))
  }
  routes.push(finalizeRoute(ringCCW, true))

  // Routes 2..7: 6 curved radial boulevards merging right onto outer ring CCW and exiting right
  const intersections = PARK_AVENUE_ANGLES.map((a0) => avenueRingIntersection(a0))

  for (let i = 0; i < PARK_AVENUE_ANGLES.length; i++) {
    const outIdx = (i - (i % 2 === 0 ? 1 : 2) + 6) % 6
    const aIn = PARK_AVENUE_ANGLES[i]
    const aOut = PARK_AVENUE_ANGLES[outIdx]
    const { rInt: rIn, tInt: tIn } = intersections[i]
    const { rInt: rOut, tInt: tOut } = intersections[outIdx]

    const pts: RawPoint[] = []

    // Inbound leg from outer boundary down to ring corner
    const rInEnd = rIn + 12.5
    const inSteps = Math.max(8, Math.round((492 - rInEnd) / 6))
    for (let k = 0; k <= inSteps; k++) {
      const r = 492 + ((rInEnd - 492) * k) / inSteps
      pts.push(avenueLaneSample(aIn, r, -1))
    }

    // Entry right-turn fillet onto outer CCW ring
    const tStart = tIn - 12.5 / rIn
    const entryStart = pts[pts.length - 1]
    const entryEnd = ringLaneSample(tStart, -1)
    pts.push(...quadFillet(entryStart, entryEnd, 10))
    pts.push(entryEnd)

    // Outer ring CCW arc (decreasing t from tStart to tEnd)
    const tEnd = tOut + 12.5 / rOut
    let dT = tStart - tEnd
    while (dT <= 0) dT += Math.PI * 2
    const arcLen = dT * 218
    const arcSteps = Math.max(6, Math.round(arcLen / 6))
    for (let k = 1; k <= arcSteps; k++) {
      const t = tStart - (dT * k) / arcSteps
      pts.push(ringLaneSample(t, -1))
    }

    // Exit right-turn fillet onto outbound boulevard
    const rOutStart = rOut + 12.5
    const exitStart = pts[pts.length - 1]
    const exitEnd = avenueLaneSample(aOut, rOutStart, 1)
    pts.push(...quadFillet(exitStart, exitEnd, 10))
    pts.push(exitEnd)

    // Outbound leg from ring corner back out to boundary
    const outSteps = Math.max(8, Math.round((492 - rOutStart) / 6))
    for (let k = 1; k <= outSteps; k++) {
      const r = rOutStart + ((492 - rOutStart) * k) / outSteps
      pts.push(avenueLaneSample(aOut, r, 1))
    }

    routes.push(finalizeRoute(pts, false))
  }

  return routes
}

function sampleRoute(route: TrafficRoute, sInput: number): RawPoint {
  const { closed, points, totalLen } = route
  const n = points.length
  if (n === 0) return { x: 0, z: 0, fx: 0, fz: 1 }
  if (n === 1 || totalLen <= 0) {
    const p = points[0]
    return { x: p.x, z: p.z, fx: p.fx, fz: p.fz }
  }

  let s = sInput
  if (closed) {
    s = ((s % totalLen) + totalLen) % totalLen
  } else {
    s = Math.max(0, Math.min(totalLen, s))
  }

  // Binary search for largest index lo with points[lo].s <= s
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid].s <= s) lo = mid
    else hi = mid - 1
  }

  const a = points[lo]
  const nextIdx = lo + 1 < n ? lo + 1 : closed ? 0 : lo
  const b = points[nextIdx]
  if (nextIdx === lo) {
    return { x: a.x, z: a.z, fx: a.fx, fz: a.fz }
  }

  const segEndS = nextIdx === 0 ? totalLen : b.s
  const span = Math.max(1e-5, segEndS - a.s)
  const u = Math.max(0, Math.min(1, (s - a.s) / span))
  const [fx, fz] = normalize2D(a.fx + (b.fx - a.fx) * u, a.fz + (b.fz - a.fz) * u)
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    fx,
    fz,
  }
}

/** Clean low-poly car geometries (+Z = forward, y = 0 rests on road). */
export function createCarGeometries() {
  const lower = new THREE.BoxGeometry(2.32, 0.68, 5.25)
  lower.translate(0, 0.60, 0)
  const roof = new THREE.BoxGeometry(1.82, 0.14, 2.15)
  roof.translate(0, 1.54, -0.22)
  const bodyGeo = mergeGeometries([lower, roof])!
  lower.dispose()
  roof.dispose()
  bodyGeo.computeBoundingSphere()

  const cabin = new THREE.BoxGeometry(1.94, 0.58, 2.85)
  cabin.translate(0, 1.22, -0.22)
  const wheelCoords: [number, number][] = [
    [-1.06, 1.52],
    [1.06, 1.52],
    [-1.06, -1.52],
    [1.06, -1.52],
  ]
  const trimParts: THREE.BufferGeometry[] = [cabin]
  for (const [wx, wz] of wheelCoords) {
    const w = new THREE.BoxGeometry(0.32, 0.56, 0.88)
    w.translate(wx, 0.28, wz)
    trimParts.push(w)
  }
  const trimGeo = mergeGeometries(trimParts)!
  for (const g of trimParts) g.dispose()
  trimGeo.computeBoundingSphere()

  const hlLeft = new THREE.BoxGeometry(0.42, 0.19, 0.08)
  hlLeft.translate(-0.76, 0.64, 2.64)
  const hlRight = new THREE.BoxGeometry(0.42, 0.19, 0.08)
  hlRight.translate(0.76, 0.64, 2.64)
  const headlightGeo = mergeGeometries([hlLeft, hlRight])!
  hlLeft.dispose()
  hlRight.dispose()
  headlightGeo.computeBoundingSphere()

  const tlLeft = new THREE.BoxGeometry(0.46, 0.17, 0.08)
  tlLeft.translate(-0.76, 0.66, -2.64)
  const tlRight = new THREE.BoxGeometry(0.46, 0.17, 0.08)
  tlRight.translate(0.76, 0.66, -2.64)
  const taillightGeo = mergeGeometries([tlLeft, tlRight])!
  tlLeft.dispose()
  tlRight.dispose()
  taillightGeo.computeBoundingSphere()

  // Plane lies flat with top UV edge at bumper (+2.45) and fading forward to (+11.95)
  const beamGeo = new THREE.PlaneGeometry(4.4, 9.5)
  beamGeo.rotateX(-Math.PI / 2)
  beamGeo.translate(0, 0.09, 7.2)
  beamGeo.computeBoundingSphere()

  return { bodyGeo, trimGeo, headlightGeo, taillightGeo, beamGeo }
}

function createHeadlightGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!

  // Two soft forward-fading warm-white cones originating near top (y=0 -> bumper)
  for (const cx of [41, 87]) {
    const g = ctx.createRadialGradient(cx, 6, 1, cx, 58, 72)
    g.addColorStop(0, 'rgba(255, 245, 214, 0.92)')
    g.addColorStop(0.28, 'rgba(255, 242, 206, 0.45)')
    g.addColorStop(0.7, 'rgba(255, 238, 196, 0.12)')
    g.addColorStop(1, 'rgba(255, 238, 196, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(cx - 8, 0)
    ctx.lineTo(cx + 8, 0)
    ctx.lineTo(cx + 34, 128)
    ctx.lineTo(cx - 34, 128)
    ctx.closePath()
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function createFleet(routes: TrafficRoute[]): FleetCar[] {
  const rand = mulberry32(2026)
  const cars: FleetCar[] = []

  const addCar = (routeIdx: number, phase: number, speedMin: number, speedMax: number) => {
    const route = routes[routeIdx]
    const s = ((phase % 1) + 1) % 1 * route.totalLen
    const pos = sampleRoute(route, s)
    const baseSpeed = speedMin + rand() * (speedMax - speedMin)
    cars.push({
      routeIdx,
      s,
      baseSpeed,
      curSpeed: baseSpeed,
      scaleX: 0.94 + rand() * 0.11,
      scaleY: 0.92 + rand() * 0.22,
      scaleZ: 0.92 + rand() * 0.14,
      colorIdx: Math.floor(rand() * CAR_PALETTE.length),
      x: pos.x,
      z: pos.z,
      fx: pos.fx,
      fz: pos.fz,
    })
  }

  // 8 cars on inner CW ring
  for (let i = 0; i < 8; i++) {
    addCar(0, (i + (rand() - 0.5) * 0.35) / 8, 17.5, 20.0)
  }

  // 6 cars on outer CCW ring
  for (let i = 0; i < 6; i++) {
    addCar(1, (i + (rand() - 0.5) * 0.35) / 6, 18.0, 20.5)
  }

  // 12 cars distributed across the 6 radial boulevards (2 per route)
  for (let rIdx = 2; rIdx < routes.length; rIdx++) {
    const p0 = 0.14 + rand() * 0.22
    addCar(rIdx, p0, 19.0, 22.0)
    addCar(rIdx, p0 + 0.48 + (rand() - 0.5) * 0.08, 19.0, 22.0)
  }

  return cars
}

function edgeFadeFactor(route: TrafficRoute, s: number): number {
  if (route.closed) return 1
  const distEdge = Math.min(s, route.totalLen - s)
  if (distEdge >= FADE_EDGE_M) return 1
  if (distEdge <= 0) return 0
  return distEdge / FADE_EDGE_M
}

/** Calm, minimalist traffic flowing along the ring parkway and 6 curved boulevards. */
export function ParkTraffic() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const invalidate = useThree((s) => s.invalidate)

  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const trimRef = useRef<THREE.InstancedMesh>(null)
  const headlightRef = useRef<THREE.InstancedMesh>(null)
  const taillightRef = useRef<THREE.InstancedMesh>(null)
  const beamRef = useRef<THREE.InstancedMesh>(null)
  const hlMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const tlMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const routes = useMemo(buildTrafficRoutes, [])
  const fleet = useMemo(() => createFleet(routes), [routes])
  const geos = useMemo(createCarGeometries, [])
  const beamTex = useMemo(createHeadlightGlowTexture, [])

  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
      p: new THREE.Vector3(),
      sc: new THREE.Vector3(),
    }),
    [],
  )

  const writeInstances = () => {
    const body = bodyRef.current
    const trim = trimRef.current
    const hl = headlightRef.current
    const tl = taillightRef.current
    const beam = beamRef.current
    if (!body || !trim || !hl || !tl || !beam) return

    const { m, q, up, p, sc } = scratch
    for (let i = 0; i < fleet.length; i++) {
      const car = fleet[i]
      const route = routes[car.routeIdx]
      const fade = edgeFadeFactor(route, car.s)
      const rotY = Math.atan2(car.fx, car.fz)

      q.setFromAxisAngle(up, rotY)
      p.set(car.x, -0.15, car.z)
      sc.set(car.scaleX * fade, car.scaleY * fade, car.scaleZ * fade)
      m.compose(p, q, sc)

      body.setMatrixAt(i, m)
      trim.setMatrixAt(i, m)
      hl.setMatrixAt(i, m)
      tl.setMatrixAt(i, m)
      beam.setMatrixAt(i, m)
    }

    body.instanceMatrix.needsUpdate = true
    trim.instanceMatrix.needsUpdate = true
    hl.instanceMatrix.needsUpdate = true
    tl.instanceMatrix.needsUpdate = true
    beam.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (body) {
      for (let i = 0; i < fleet.length; i++) {
        body.setColorAt(i, CAR_PALETTE[fleet[i].colorIdx])
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true
    }
    writeInstances()
  }, [fleet, routes])

  useEffect(() => {
    if (stage === 'map' || droneTour) invalidate()
  }, [stage, droneTour, invalidate])

  useEffect(() => {
    return () => {
      geos.bodyGeo.dispose()
      geos.trimGeo.dispose()
      geos.headlightGeo.dispose()
      geos.taillightGeo.dispose()
      geos.beamGeo.dispose()
      beamTex.dispose()
    }
  }, [geos, beamTex])

  useFrame((_, delta) => {
    const tLight = Math.max(0, Math.min(2, lightingState.timeOfDay))
    if (hlMatRef.current) {
      if (tLight <= 1) hlMatRef.current.color.lerpColors(HEADLIGHT_DAY, HEADLIGHT_DUSK, tLight)
      else hlMatRef.current.color.lerpColors(HEADLIGHT_DUSK, HEADLIGHT_NIGHT, tLight - 1)
    }
    if (tlMatRef.current) {
      if (tLight <= 1) tlMatRef.current.color.lerpColors(TAILLIGHT_DAY, TAILLIGHT_DUSK, tLight)
      else tlMatRef.current.color.lerpColors(TAILLIGHT_DUSK, TAILLIGHT_NIGHT, tLight - 1)
    }
    if (beamRef.current && beamMatRef.current) {
      const beamOp = 0.14 * lightingState.lampFactor + 0.16 * lightingState.nightFactor
      beamRef.current.visible = beamOp > 0.01
      beamMatRef.current.opacity = beamOp
    }

    const st = useStadiumStore.getState()
    if (st.stage !== 'map' && !st.droneTour) return
    const dt = Math.min(delta, 0.05)

    // Smooth forward-cone spacing / yielding using previous-frame positions
    const n = fleet.length
    for (let i = 0; i < n; i++) {
      const ci = fleet[i]
      const rx = -ci.fz
      const rz = ci.fx
      let targetSpeed = ci.baseSpeed

      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const cj = fleet[j]
        const dx = cj.x - ci.x
        const dz = cj.z - ci.z
        const distSq = dx * dx + dz * dz
        if (distSq >= 256) continue // >= 16m

        const fwdDot = dx * ci.fx + dz * ci.fz
        if (fwdDot <= 2.0) continue

        const lat = Math.abs(dx * rx + dz * rz)
        if (lat >= 3.4) continue

        const headingAlign = ci.fx * cj.fx + ci.fz * cj.fz
        if (headingAlign <= 0.35) continue

        const dist = Math.sqrt(distSq)
        let allowed: number
        if (dist < 7.5) {
          allowed = 0
        } else {
          const factor = (dist - 7.5) / (16 - 7.5)
          allowed = 3.5 + (ci.baseSpeed - 3.5) * factor
        }
        if (allowed < targetSpeed) targetSpeed = allowed
      }

      const blend = 1 - Math.exp(-5 * dt)
      ci.curSpeed += (targetSpeed - ci.curSpeed) * blend
    }

    // Advance each car along its route
    for (let i = 0; i < n; i++) {
      const car = fleet[i]
      const route = routes[car.routeIdx]
      car.s += car.curSpeed * dt
      if (car.s >= route.totalLen) {
        car.s -= route.totalLen
        if (!route.closed) car.curSpeed = car.baseSpeed
      }
      const pos = sampleRoute(route, car.s)
      car.x = pos.x
      car.z = pos.z
      car.fx = pos.fx
      car.fz = pos.fz
    }

    writeInstances()
    invalidate()
  })

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[geos.bodyGeo, undefined, fleet.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.42} metalness={0.28} />
      </instancedMesh>

      <instancedMesh
        ref={trimRef}
        args={[geos.trimGeo, undefined, fleet.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial color="#181c24" roughness={0.28} metalness={0.18} />
      </instancedMesh>

      <instancedMesh
        ref={headlightRef}
        args={[geos.headlightGeo, undefined, fleet.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshBasicMaterial ref={hlMatRef} color={HEADLIGHT_DAY} toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={taillightRef}
        args={[geos.taillightGeo, undefined, fleet.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshBasicMaterial ref={tlMatRef} color={TAILLIGHT_DAY} toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={beamRef}
        args={[geos.beamGeo, undefined, fleet.length]}
        visible={false}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshBasicMaterial
          ref={beamMatRef}
          map={beamTex}
          color="#fff4d6"
          transparent
          opacity={0}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </instancedMesh>
    </group>
  )
}
