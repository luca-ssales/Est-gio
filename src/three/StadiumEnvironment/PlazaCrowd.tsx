import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PARK_AVENUE_ANGLES } from '../../lib/textures'
import { mulberry32 } from '../../lib/random'
import { useStadiumStore } from '../../store/useStadiumStore'

export interface PlazaWalker {
  kind: 'ring' | 'avenue'
  // Ring parameters
  rx: number
  rz: number
  t: number
  dir: 1 | -1
  // Avenue parameters
  a0: number
  r: number
  rMin: number
  rMax: number
  lat: number
  // Shared
  speed: number
  scale: number
  stride: number
  phase: number
  bodyColorIdx: number
  headColorIdx: number
}

const SUPPORTER_PALETTE = [
  new THREE.Color('#d62839'), // Aurora FC crimson
  new THREE.Color('#b81d2e'),
  new THREE.Color('#d62839'),
  new THREE.Color('#21499a'), // Atlético Norte navy
  new THREE.Color('#1a356e'),
  new THREE.Color('#eef2f6'), // Crisp white
  new THREE.Color('#cfd6df'),
  new THREE.Color('#323946'), // Dark casual
  new THREE.Color('#e2d6c4'),
]

const HEAD_TONES = [
  new THREE.Color('#f0c8a8'),
  new THREE.Color('#d9a47c'),
  new THREE.Color('#b57c52'),
  new THREE.Color('#7a4e32'),
  new THREE.Color('#e8bfa0'),
]

function avenueEndRadiusPlaza(ang: number): number {
  return 1 / Math.hypot(Math.cos(ang) / 114, Math.sin(ang) / 132)
}

function avenueEndRadiusRing(ang: number): number {
  return 1 / Math.hypot(Math.cos(ang) / 205, Math.sin(ang) / 225)
}

/** Generate 260 architectural-maquette matchday pedestrians on the plaza and 6 inner approaches. */
export function createPlazaWalkers(): PlazaWalker[] {
  const rand = mulberry32(4242)
  const list: PlazaWalker[] = []

  // 170 esplanade strollers walking along elliptical paths on the white stone plaza
  for (let i = 0; i < 170; i++) {
    const u = rand()
    const rx = 100.5 + u * 11.0
    const rz = 118.5 + u * 11.0
    // Slight organic clustering every 3-4 walkers
    const clusterPhase = i % 3 === 0 ? rand() * Math.PI * 2 : (list[i - 1]?.t ?? 0) + (rand() - 0.5) * 0.04
    const dir: 1 | -1 = i % 3 === 0 ? (rand() > 0.5 ? 1 : -1) : list[i - 1].dir
    list.push({
      kind: 'ring',
      rx,
      rz,
      t: ((clusterPhase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      dir,
      a0: 0,
      r: 0,
      rMin: 0,
      rMax: 0,
      lat: 0,
      speed: 2.2 + rand() * 1.6,
      scale: 0.9 + rand() * 0.22,
      stride: 5.2 + rand() * 1.6,
      phase: rand() * Math.PI * 2,
      bodyColorIdx: Math.floor(rand() * SUPPORTER_PALETTE.length),
      headColorIdx: Math.floor(rand() * HEAD_TONES.length),
    })
  }

  // 90 fans walking along the 6 car-free inner approaches between the ring road and stone plaza
  for (let i = 0; i < 90; i++) {
    const a0 = PARK_AVENUE_ANGLES[i % PARK_AVENUE_ANGLES.length]
    const midR = 160
    const midAng = a0 + 0.14 * Math.sin(midR / 120)
    const rMin = avenueEndRadiusPlaza(midAng) + 3
    const rMax = avenueEndRadiusRing(midAng) - 14
    const r = rMin + rand() * Math.max(10, rMax - rMin)
    const dir: 1 | -1 = rand() > 0.3 ? -1 : 1 // more arriving toward stadium
    const lat = (dir === -1 ? -1 : 1) * (2.2 + rand() * 2.6)
    list.push({
      kind: 'avenue',
      rx: 0,
      rz: 0,
      t: 0,
      dir,
      a0,
      r,
      rMin,
      rMax,
      lat,
      speed: 2.4 + rand() * 1.5,
      scale: 0.9 + rand() * 0.22,
      stride: 5.4 + rand() * 1.6,
      phase: rand() * Math.PI * 2,
      bodyColorIdx: Math.floor(rand() * SUPPORTER_PALETTE.length),
      headColorIdx: Math.floor(rand() * HEAD_TONES.length),
    })
  }

  return list
}

export function evaluateWalkerPose(w: PlazaWalker, timeSec: number) {
  let x = 0
  let z = 0
  let rotY = 0
  let fade = 1

  if (w.kind === 'ring') {
    x = w.rx * Math.cos(w.t)
    z = w.rz * Math.sin(w.t)
    const fx = w.dir * -w.rx * Math.sin(w.t)
    const fz = w.dir * w.rz * Math.cos(w.t)
    rotY = Math.atan2(fx, fz)
  } else {
    const ang = w.a0 + 0.14 * Math.sin(w.r / 120)
    const dAng = (0.14 / 120) * Math.cos(w.r / 120)
    const cosA = Math.cos(ang)
    const sinA = Math.sin(ang)
    const dx = cosA - w.r * sinA * dAng
    const dz = sinA + w.r * cosA * dAng
    const len = Math.hypot(dx, dz) || 1
    const fx = (w.dir * dx) / len
    const fz = (w.dir * dz) / len
    const rx = -fz
    const rz = fx
    x = cosA * w.r + rx * w.lat
    z = sinA * w.r + rz * w.lat
    rotY = Math.atan2(fx, fz)

    const edge = Math.min(w.r - w.rMin, w.rMax - w.r)
    if (edge < 8) fade = Math.max(0, edge / 8)
  }

  const bob = Math.abs(Math.sin(timeSec * w.stride + w.phase)) * 0.22
  return { x, z, rotY, fade, bob }
}

/** Animated architectural-maquette matchday crowd strolling the white plaza and inner avenues. */
export function PlazaCrowd() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const invalidate = useThree((s) => s.invalidate)

  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const walkers = useMemo(createPlazaWalkers, [])

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

  const writeInstances = (timeSec: number) => {
    const body = bodyRef.current
    const head = headRef.current
    if (!body || !head) return

    const { m, q, up, p, sc } = scratch
    for (let i = 0; i < walkers.length; i++) {
      const w = walkers[i]
      const { x, z, rotY, fade, bob } = evaluateWalkerPose(w, timeSec)
      const s = w.scale * fade

      q.setFromAxisAngle(up, rotY)
      p.set(x, -0.15 + (0.68 + bob) * s, z)
      sc.set(s, s, s)
      m.compose(p, q, sc)
      body.setMatrixAt(i, m)

      p.set(x, -0.15 + (1.58 + bob) * s, z)
      m.compose(p, q, sc)
      head.setMatrixAt(i, m)
    }

    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const body = bodyRef.current
    const head = headRef.current
    if (body && head) {
      for (let i = 0; i < walkers.length; i++) {
        body.setColorAt(i, SUPPORTER_PALETTE[walkers[i].bodyColorIdx])
        head.setColorAt(i, HEAD_TONES[walkers[i].headColorIdx])
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true
      if (head.instanceColor) head.instanceColor.needsUpdate = true
    }
    writeInstances(0)
  }, [walkers])

  useEffect(() => {
    if (stage === 'map' || droneTour) invalidate()
  }, [stage, droneTour, invalidate])

  useFrame(({ clock }, delta) => {
    const st = useStadiumStore.getState()
    if (st.stage !== 'map' && !st.droneTour) return
    const dt = Math.min(delta, 0.05)

    for (let i = 0; i < walkers.length; i++) {
      const w = walkers[i]
      if (w.kind === 'ring') {
        const approxCirc = Math.PI * (w.rx + w.rz)
        w.t = (w.t + w.dir * ((w.speed * dt * Math.PI * 2) / approxCirc) + Math.PI * 2) % (Math.PI * 2)
      } else {
        w.r += w.dir * w.speed * dt
        if (w.r < w.rMin) w.r = w.rMax
        else if (w.r > w.rMax) w.r = w.rMin
      }
    }

    writeInstances(clock.elapsedTime)
    if (st.droneTour) invalidate()
  })

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, walkers.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.24, 0.34, 1.36, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.78} metalness={0.04} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, walkers.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <icosahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.75} metalness={0.02} />
      </instancedMesh>
    </group>
  )
}
