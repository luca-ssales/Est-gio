import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOWL, PITCH } from '../../data/stadium'
import { createAdTexture, createBallTexture, createGrassTexture, createNetTexture, createNoiseTexture } from '../../lib/textures'
import { useStadiumStore } from '../../store/useStadiumStore'
import { RibbonBuilder, bowlOutline, sweepProfile } from '../utils/geometry'
import { PitchWarmup } from './PitchWarmup'

const HW = PITCH.width / 2
const HL = PITCH.length / 2
const LINE = 0.16

function buildLines() {
  const b = new RibbonBuilder()
  b.line([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]], LINE, true)
  b.line([[-HW, 0], [HW, 0]], LINE)
  b.arc(0, 0, 9.15, 0, Math.PI * 2, LINE, 96)
  b.disc(0, 0, 0.16)
  const alpha = Math.acos(5.5 / 9.15)
  for (const s of [-1, 1]) {
    const gl = s * HL
    b.line([[-20.16, gl], [-20.16, s * (HL - 16.5)], [20.16, s * (HL - 16.5)], [20.16, gl]], LINE)
    b.line([[-9.16, gl], [-9.16, s * (HL - 5.5)], [9.16, s * (HL - 5.5)], [9.16, gl]], LINE)
    const spot = s * (HL - 11)
    b.disc(0, spot, 0.13)
    // penalty arc: points toward the centre (direction -s on Z)
    const dir = s > 0 ? -Math.PI / 2 : Math.PI / 2
    b.arc(0, spot, 9.15, dir - alpha, dir + alpha, LINE, 40)
    // corner arcs
    for (const x of [-1, 1]) {
      const a0 = Math.atan2(-s, -x)
      b.arc(x * HW, gl, 1, a0 - Math.PI / 4, a0 + Math.PI / 4, LINE, 12)
    }
    // technical area dashed boxes in front of the West dugouts
    const tx0 = -38.4
    const tx1 = -35.0
    const tz0 = s * 9 - 4.6
    const tz1 = s * 9 + 4.6
    const dashEdge = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const step = 0.9
      const dash = 0.5
      for (let d = 0; d < len; d += step) {
        const t0 = d / len
        const t1 = Math.min(1, (d + dash) / len)
        b.line(
          [
            [x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0],
            [x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1],
          ],
          0.1,
        )
      }
    }
    dashEdge(tx0, tz0, tx1, tz0)
    dashEdge(tx1, tz0, tx1, tz1)
    dashEdge(tx1, tz1, tx0, tz1)
  }
  return b.build(0.025)
}

function buildGrassGeometry() {
  const outline = bowlOutline(0, 32)
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ShapeGeometry(shape, 8)
  // shape is in XY with y = -z; rotate so it lies on XZ facing up
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  const normal = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + BOWL.halfX) / (BOWL.halfX * 2)
    uv[i * 2 + 1] = (pos.getZ(i) + BOWL.halfZ) / (BOWL.halfZ * 2)
    normal[i * 3 + 1] = 1
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  return g
}

function buildNetGeometry(cell = 0.12) {
  // local frame: goal line at z=0, net extends to +z. x across the goal.
  const W = 3.72
  const H = 2.44
  const quads: [number, number, number][][] = [
    // top
    [[-W, H, 0], [W, H, 0], [W, H, 1], [-W, H, 1]],
    // back slope
    [[-W, H, 1], [W, H, 1], [W, 0, 2], [-W, 0, 2]],
  ]
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const pushQuad = (q: [number, number, number][]) => {
    const s = pos.length / 3
    const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2])
    const h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2])
    q.forEach((p) => pos.push(...p))
    uv.push(0, 0, w / cell, 0, w / cell, h / cell, 0, h / cell)
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3)
  }
  quads.forEach(pushQuad)
  // sides (trapezoids as quads, uv from local z/y)
  for (const x of [-W, W]) {
    const s = pos.length / 3
    const pts: [number, number, number][] = [[x, 0, 0], [x, H, 0], [x, H, 1], [x, 0, 2]]
    pts.forEach((p) => {
      pos.push(...p)
      uv.push(p[2] / cell, p[1] / cell)
    })
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function Goal({ side }: { side: 1 | -1 }) {
  const net = useMemo(() => buildNetGeometry(), [])
  const netTex = useMemo(() => createNetTexture(), [])
  const R = 0.06
  return (
    <group position={[0, 0, side * HL]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
      <mesh position={[-3.72, 1.22 + R / 2, 0]} castShadow>
        <cylinderGeometry args={[R, R, 2.44 + R, 16]} />
        <meshStandardMaterial color="#f7f7f5" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[3.72, 1.22 + R / 2, 0]} castShadow>
        <cylinderGeometry args={[R, R, 2.44 + R, 16]} />
        <meshStandardMaterial color="#f7f7f5" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 2.44 + R / 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[R, R, 7.44 + R * 2, 16]} />
        <meshStandardMaterial color="#f7f7f5" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* rear supports */}
      {[-3.72, 3.72].map((x) => (
        <mesh key={x} position={[x, 1.22, 1]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 2.44, 8]} />
          <meshStandardMaterial color="#9aa0a6" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <mesh geometry={net} castShadow>
        <meshStandardMaterial
          map={netTex}
          color="#ffffff"
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          roughness={0.8}
          alphaTest={0.02}
        />
      </mesh>
    </group>
  )
}

function CornerFlags() {
  const corners: [number, number][] = [
    [-HW, -HL],
    [HW, -HL],
    [HW, HL],
    [-HW, HL],
  ]
  const { flagGeo, baseX } = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.42, 0.28, 8, 2)
    g.translate(0.21, 0, 0)
    const pos = g.attributes.position as THREE.BufferAttribute
    const bx = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) bx[i] = pos.getX(i)
    return { flagGeo: g, baseX: bx }
  }, [])

  useFrame(({ clock }) => {
    const st = useStadiumStore.getState()
    if (st.stage !== 'view' && !st.droneTour) return
    const t = clock.elapsedTime
    const pos = flagGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const u = baseX[i] / 0.42
      pos.setZ(i, Math.sin(u * 6.5 - t * 6.2) * 0.055 * u)
    }
    pos.needsUpdate = true
    flagGeo.computeVertexNormals()
  })

  return (
    <>
      {corners.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 1.5, 6]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.36, 0]} geometry={flagGeo}>
            <meshStandardMaterial color="#e8ff3a" side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function AdBoards() {
  const tex = useMemo(() => createAdTexture(), [])
  const geo = useMemo(
    () =>
      sweepProfile(
        [
          [-3.0, 0],
          [-2.85, 0.92],
        ],
        { uD: -3.0, uScale: 22, arcSegments: 24 },
      ),
    [],
  )

  useFrame(({ invalidate }, delta) => {
    const st = useStadiumStore.getState()
    if (st.stage !== 'view' && !st.droneTour) return
    tex.offset.x = (tex.offset.x + Math.min(delta, 0.05) * 0.075) % 1
    invalidate()
  })

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.85}
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function Dugouts() {
  const seatOffsets = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[-40.4, 0, s * 9]}>
          {/* back & floor housing */}
          <mesh position={[-0.25, 1.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 2.0, 9]} />
            <meshStandardMaterial color="#121418" roughness={0.65} />
          </mesh>
          {/* sleek tinted roof canopy overhang */}
          <mesh position={[0.18, 2.04, 0]} castShadow>
            <boxGeometry args={[2.0, 0.08, 9.2]} />
            <meshStandardMaterial color="#1c2028" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* interior warm LED strip */}
          <mesh position={[-0.68, 1.88, 0]}>
            <boxGeometry args={[0.06, 0.05, 8.4]} />
            <meshStandardMaterial color="#ffe0a8" emissive="#ffd18a" emissiveIntensity={1.6} />
          </mesh>
          {/* 8 sport bucket seats */}
          {seatOffsets.map((z) => (
            <group key={z} position={[0.52, 0, z]}>
              <mesh position={[0, 0.42, 0]} castShadow>
                <boxGeometry args={[0.42, 0.48, 0.46]} />
                <meshStandardMaterial color="#171b22" roughness={0.5} />
              </mesh>
              <mesh position={[-0.16, 0.72, 0]} castShadow>
                <boxGeometry args={[0.12, 0.52, 0.44]} />
                <meshStandardMaterial color="#171b22" roughness={0.5} />
              </mesh>
              <mesh position={[-0.12, 0.94, 0]}>
                <boxGeometry args={[0.08, 0.12, 0.32]} />
                <meshStandardMaterial color="#d9ff3f" roughness={0.45} />
              </mesh>
            </group>
          ))}
          {/* side glass shields */}
          <mesh position={[0.85, 1.1, 0]}>
            <boxGeometry args={[0.05, 1.5, 8.8]} />
            <meshPhysicalMaterial color="#9fb8d0" transparent opacity={0.2} roughness={0.08} metalness={0} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function BroadcastCameras() {
  const rigs: [number, number][] = [
    [-14, -55.6],
    [14, -55.6],
    [-14, 55.6],
    [14, 55.6],
  ]
  return (
    <>
      {rigs.map(([x, z]) => {
        const yaw = Math.atan2(-x, -z)
        return (
          <group key={`${x}${z}`} position={[x, 0, z]} rotation={[0, yaw, 0]}>
            {/* tripod legs */}
            {[
              [-0.24, -0.18, 0.25, -0.2],
              [0.24, -0.18, -0.25, -0.2],
              [0, 0.26, 0, 0.25],
            ].map(([lx, lz, rz, rx], i) => (
              <mesh key={i} position={[lx * 0.5, 0.55, lz * 0.5]} rotation={[rx, 0, rz]} castShadow>
                <cylinderGeometry args={[0.02, 0.025, 1.18, 6]} />
                <meshStandardMaterial color="#1e222a" metalness={0.7} roughness={0.4} />
              </mesh>
            ))}
            {/* camera body + lens hood */}
            <mesh position={[0, 1.18, 0]} castShadow>
              <boxGeometry args={[0.26, 0.24, 0.42]} />
              <meshStandardMaterial color="#14171d" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.18, 0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.07, 0.22, 12]} />
              <meshStandardMaterial color="#0b0d11" roughness={0.35} metalness={0.6} />
            </mesh>
            {/* live red tally LED */}
            <mesh position={[0, 1.32, 0.14]}>
              <boxGeometry args={[0.05, 0.035, 0.04]} />
              <meshStandardMaterial color="#ff2e3b" emissive="#ff2e3b" emissiveIntensity={2.4} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

function MatchBall() {
  const tex = useMemo(() => createBallTexture(), [])
  return (
    <mesh position={[0, 0.11, 0]} castShadow>
      <sphereGeometry args={[0.11, 20, 20]} />
      <meshStandardMaterial map={tex} roughness={0.45} metalness={0.05} />
    </mesh>
  )
}

export function StadiumField({ quality = 'high' }: { quality?: 'high' | 'low' }) {
  const grassTex = useMemo(() => createGrassTexture(quality === 'high' ? 2048 : 1024), [quality])
  const bump = useMemo(() => {
    const t = createNoiseTexture(256, 11, 1)
    t.repeat.set(70, 100)
    return t
  }, [])
  const grassGeo = useMemo(buildGrassGeometry, [])
  const lines = useMemo(buildLines, [])

  return (
    <group>
      <mesh geometry={grassGeo} receiveShadow>
        <meshStandardMaterial map={grassTex} bumpMap={bump} bumpScale={0.08} roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={lines} receiveShadow>
        <meshStandardMaterial
          color="#f7f7f2"
          roughness={0.75}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <Goal side={1} />
      <Goal side={-1} />
      <MatchBall />
      <PitchWarmup />
      <CornerFlags />
      <AdBoards />
      <Dugouts />
      <BroadcastCameras />
    </group>
  )
}
