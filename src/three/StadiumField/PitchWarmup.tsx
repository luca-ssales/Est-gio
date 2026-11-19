import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStadiumStore } from '../../store/useStadiumStore'

export interface WarmupPlayerPose {
  x: number
  z: number
  rotY: number
  stride: number
  bob: number
  torsoColor: THREE.Color
  shortsColor: THREE.Color
  headColor: THREE.Color
}

export interface WarmupBallPose {
  x: number
  y: number
  z: number
  rotX: number
  rotZ: number
}

const AURORA_JERSEY = new THREE.Color('#d62839')
const AURORA_SHORTS = new THREE.Color('#f4f6fa')
const AURORA_GK = new THREE.Color('#c8f526')

const NORTE_JERSEY = new THREE.Color('#f1f5f9')
const NORTE_SHORTS = new THREE.Color('#1d3c85')
const NORTE_GK = new THREE.Color('#38bdf8')

const SUB_BIB = new THREE.Color('#ff8c1a')
const SUB_SHORTS = new THREE.Color('#1a1f29')

const SKIN_TONES = [
  new THREE.Color('#efc5a2'),
  new THREE.Color('#d29a70'),
  new THREE.Color('#a66e46'),
  new THREE.Color('#70442a'),
]

const PASS_PERIOD = 1.65

function evalRondoRing(
  centerX: number,
  centerZ: number,
  radius: number,
  t: number,
  phaseShift: number,
  jersey: THREE.Color,
  shorts: THREE.Color,
  headOffset: number,
  players: WarmupPlayerPose[],
): WarmupBallPose {
  const count = 5
  const ringPts: { x: number; z: number }[] = []

  for (let i = 0; i < count; i++) {
    const baseAng = (i / count) * Math.PI * 2 + phaseShift
    const sway = Math.sin(t * 1.4 + i * 1.3) * 0.25
    const r = radius + Math.sin(t * 1.1 + i * 2.1) * 0.65
    ringPts.push({
      x: centerX + Math.cos(baseAng + sway * 0.14) * r,
      z: centerZ + Math.sin(baseAng + sway * 0.14) * r,
    })
  }

  // Ball hops cleanly between ring players in a 5-step star pattern (step = +2 mod 5)
  const totalStep = t / PASS_PERIOD
  const stepIdx = Math.floor(totalStep)
  const u = totalStep - stepIdx
  const fromIdx = (stepIdx * 2) % count
  const toIdx = ((stepIdx + 1) * 2) % count
  const p0 = ringPts[fromIdx]
  const p1 = ringPts[toIdx]

  // Brief foot-trap pause at start/end of pass
  const travel = THREE.MathUtils.clamp((u - 0.08) / 0.84, 0, 1)
  const bx = THREE.MathUtils.lerp(p0.x, p1.x, travel)
  const bz = THREE.MathUtils.lerp(p0.z, p1.z, travel)
  const arcH = 0.42
  const by = 0.11 + 4 * arcH * travel * (1 - travel)

  for (let i = 0; i < count; i++) {
    const pt = ringPts[i]
    const rotY = Math.atan2(bx - pt.x, bz - pt.z)
    const kickBoost = i === fromIdx && u < 0.25 ? Math.sin((u / 0.25) * Math.PI) * 0.42 : 0
    const stride = Math.sin(t * 6.5 + i * 1.9) * 0.22 + kickBoost
    const bob = Math.abs(Math.sin(t * 6.5 + i * 1.9)) * 0.045
    players.push({
      x: pt.x,
      z: pt.z,
      rotY,
      stride,
      bob,
      torsoColor: jersey,
      shortsColor: shorts,
      headColor: SKIN_TONES[(headOffset + i) % SKIN_TONES.length],
    })
  }

  return { x: bx, y: by, z: bz, rotX: travel * Math.PI * 5, rotZ: stepIdx * 0.9 }
}

/** Pure deterministic evaluation of all 16 warm-up players + 2 match footballs at elapsed time `t`. */
export function evaluateWarmupFrame(t: number): { players: WarmupPlayerPose[]; balls: WarmupBallPose[] } {
  const players: WarmupPlayerPose[] = []
  const balls: WarmupBallPose[] = []

  // --- North half: Aurora FC ---
  const northBall = evalRondoRing(0, -24, 7.2, t, 0.2, AURORA_JERSEY, AURORA_SHORTS, 0, players)
  balls.push(northBall)

  // North shuttle midfielder
  const nShuttle = 0.5 - 0.5 * Math.cos(t * 0.72)
  const nDir = Math.sin(t * 0.72) >= 0 ? 1 : -1
  const nx0 = -15
  const nz0 = -16
  const nx1 = -24
  const nz1 = -34
  players.push({
    x: THREE.MathUtils.lerp(nx0, nx1, nShuttle),
    z: THREE.MathUtils.lerp(nz0, nz1, nShuttle),
    rotY: Math.atan2(nDir * (nx1 - nx0), nDir * (nz1 - nz0)),
    stride: Math.sin(t * 8.4) * 0.42,
    bob: Math.abs(Math.sin(t * 8.4)) * 0.08,
    torsoColor: AURORA_JERSEY,
    shortsColor: AURORA_SHORTS,
    headColor: SKIN_TONES[2],
  })

  // North goalkeeper patrolling the 6-yard line
  const ngkX = Math.sin(t * 1.3) * 4.2
  players.push({
    x: ngkX,
    z: -48.5,
    rotY: Math.atan2(northBall.x - ngkX, northBall.z - -48.5),
    stride: Math.sin(t * 7.2) * 0.24,
    bob: Math.abs(Math.sin(t * 7.2)) * 0.04,
    torsoColor: AURORA_GK,
    shortsColor: SUB_SHORTS,
    headColor: SKIN_TONES[1],
  })

  // --- South half: Atlético Norte ---
  const southBall = evalRondoRing(0, 24, 7.2, t + 0.85, 0.9, NORTE_JERSEY, NORTE_SHORTS, 1, players)
  balls.push(southBall)

  // South shuttle midfielder
  const sShuttle = 0.5 - 0.5 * Math.cos(t * 0.75 + 1.1)
  const sDir = Math.sin(t * 0.75 + 1.1) >= 0 ? 1 : -1
  const sx0 = 15
  const sz0 = 16
  const sx1 = 24
  const sz1 = 34
  players.push({
    x: THREE.MathUtils.lerp(sx0, sx1, sShuttle),
    z: THREE.MathUtils.lerp(sz0, sz1, sShuttle),
    rotY: Math.atan2(sDir * (sx1 - sx0), sDir * (sz1 - sz0)),
    stride: Math.sin(t * 8.2 + 1.0) * 0.42,
    bob: Math.abs(Math.sin(t * 8.2 + 1.0)) * 0.08,
    torsoColor: NORTE_JERSEY,
    shortsColor: NORTE_SHORTS,
    headColor: SKIN_TONES[3],
  })

  // South goalkeeper patrolling the 6-yard line
  const sgkX = Math.sin(t * 1.25 + 1.4) * 4.2
  players.push({
    x: sgkX,
    z: 48.5,
    rotY: Math.atan2(southBall.x - sgkX, southBall.z - 48.5),
    stride: Math.sin(t * 7.0 + 1.0) * 0.24,
    bob: Math.abs(Math.sin(t * 7.0 + 1.0)) * 0.04,
    torsoColor: NORTE_GK,
    shortsColor: NORTE_SHORTS,
    headColor: SKIN_TONES[0],
  })

  // --- East touchline: 2 warm-up substitutes jogging ---
  for (let s = 0; s < 2; s++) {
    const phase = t * 0.52 + s * 0.9
    const zPos = Math.sin(phase) * 16.5
    const zVel = Math.cos(phase)
    players.push({
      x: 35.4 + s * 0.9,
      z: zPos,
      rotY: zVel >= 0 ? 0 : Math.PI,
      stride: Math.sin(t * 7.8 + s * 1.4) * 0.36,
      bob: Math.abs(Math.sin(t * 7.8 + s * 1.4)) * 0.065,
      torsoColor: SUB_BIB,
      shortsColor: SUB_SHORTS,
      headColor: SKIN_TONES[(s + 2) % SKIN_TONES.length],
    })
  }

  return { players, balls }
}

export function createWarmupData() {
  return evaluateWarmupFrame(0)
}

/** 16 animated warm-up players + 2 live passing balls on the pitch. */
export function PitchWarmup() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const invalidate = useThree((s) => s.invalidate)

  const torsoRef = useRef<THREE.InstancedMesh>(null)
  const legLRef = useRef<THREE.InstancedMesh>(null)
  const legRRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const ballRef = useRef<THREE.InstancedMesh>(null)

  const initial = useMemo(createWarmupData, [])
  const legGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.18, 0.72, 0.2)
    g.translate(0, -0.36, 0) // hip pivot at y=0.72
    return g
  }, [])

  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      qLeg: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      p: new THREE.Vector3(),
      right: new THREE.Vector3(),
      sc: new THREE.Vector3(1, 1, 1),
    }),
    [],
  )

  const writePose = (timeSec: number) => {
    const torso = torsoRef.current
    const legL = legLRef.current
    const legR = legRRef.current
    const head = headRef.current
    const ball = ballRef.current
    if (!torso || !legL || !legR || !head || !ball) return

    const { players, balls } = evaluateWarmupFrame(timeSec)
    const { m, q, qLeg, euler, p, right, sc } = scratch

    for (let i = 0; i < players.length; i++) {
      const pl = players[i]
      euler.set(0, pl.rotY, 0, 'YXZ')
      q.setFromEuler(euler)
      right.set(1, 0, 0).applyQuaternion(q)

      p.set(pl.x, 1.08 + pl.bob, pl.z)
      m.compose(p, q, sc)
      torso.setMatrixAt(i, m)

      p.set(pl.x, 1.62 + pl.bob, pl.z)
      m.compose(p, q, sc)
      head.setMatrixAt(i, m)

      // Left leg
      euler.set(pl.stride, pl.rotY, 0, 'YXZ')
      qLeg.setFromEuler(euler)
      p.set(pl.x - right.x * 0.13, 0.72 + pl.bob * 0.5, pl.z - right.z * 0.13)
      m.compose(p, qLeg, sc)
      legL.setMatrixAt(i, m)

      // Right leg
      euler.set(-pl.stride, pl.rotY, 0, 'YXZ')
      qLeg.setFromEuler(euler)
      p.set(pl.x + right.x * 0.13, 0.72 + pl.bob * 0.5, pl.z + right.z * 0.13)
      m.compose(p, qLeg, sc)
      legR.setMatrixAt(i, m)
    }

    for (let b = 0; b < balls.length; b++) {
      const bl = balls[b]
      euler.set(bl.rotX, 0, bl.rotZ, 'YXZ')
      q.setFromEuler(euler)
      p.set(bl.x, bl.y, bl.z)
      m.compose(p, q, sc)
      ball.setMatrixAt(b, m)
    }

    torso.instanceMatrix.needsUpdate = true
    legL.instanceMatrix.needsUpdate = true
    legR.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    ball.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const torso = torsoRef.current
    const legL = legLRef.current
    const legR = legRRef.current
    const head = headRef.current
    if (torso && legL && legR && head) {
      for (let i = 0; i < initial.players.length; i++) {
        const pl = initial.players[i]
        torso.setColorAt(i, pl.torsoColor)
        legL.setColorAt(i, pl.shortsColor)
        legR.setColorAt(i, pl.shortsColor)
        head.setColorAt(i, pl.headColor)
      }
      if (torso.instanceColor) torso.instanceColor.needsUpdate = true
      if (legL.instanceColor) legL.instanceColor.needsUpdate = true
      if (legR.instanceColor) legR.instanceColor.needsUpdate = true
      if (head.instanceColor) head.instanceColor.needsUpdate = true
    }
    writePose(0)
  }, [initial])

  useEffect(() => {
    return () => {
      legGeo.dispose()
    }
  }, [legGeo])

  useEffect(() => {
    if (stage === 'view' || droneTour) invalidate()
  }, [stage, droneTour, invalidate])

  useFrame(({ clock }) => {
    const st = useStadiumStore.getState()
    const active = st.stage === 'view' || st.droneTour || st.stage === 'map'
    if (!active) return
    writePose(clock.elapsedTime)
    if (st.stage === 'view' || st.droneTour) invalidate()
  })

  return (
    <group>
      <instancedMesh
        ref={torsoRef}
        args={[undefined, undefined, initial.players.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.48, 0.72, 0.28]} />
        <meshStandardMaterial color="#ffffff" roughness={0.68} />
      </instancedMesh>
      <instancedMesh
        ref={legLRef}
        args={[legGeo, undefined, initial.players.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={legRRef}
        args={[legGeo, undefined, initial.players.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, initial.players.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={ballRef}
        args={[undefined, undefined, initial.balls.length]}
        castShadow
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.38} />
      </instancedMesh>
    </group>
  )
}
