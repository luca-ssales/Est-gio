import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BOWL,
  CONCOURSE1_H,
  CONCOURSE2_H,
  MATCH,
  PIECES,
  ROOF,
  TIERS,
  TIER_BY_ID,
  pieceLength,
  piecePoint,
  tierBackD,
  tierTopH,
} from '../../data/stadium'
import { SECTORS } from '../../data/sectors'
import { getSectorSeats } from '../../data/seats'
import { mulberry32 } from '../../lib/random'
import {
  createFasciaTexture,
  createLiveScoreboard,
  createNoiseTexture,
  createSkyboxTexture,
  getLabelTexture,
} from '../../lib/textures'
import { useStadiumStore } from '../../store/useStadiumStore'
import { lightingState } from '../StadiumLighting/lightingState'
import { StadiumCrowd } from './StadiumCrowd'
import { sweepProfile, type ProfilePoint } from '../utils/geometry'

const [LOWER, MIDDLE, UPPER] = TIERS
const LOWER_BACK = tierBackD(LOWER)
const MIDDLE_BACK = tierBackD(MIDDLE)
const UPPER_BACK = tierBackD(UPPER)
const UPPER_TOP = tierTopH(UPPER)

const TREAD = new THREE.Color('#b6bcc4')
const RISER = new THREE.Color('#646a74')
const WALL = new THREE.Color('#192136')
const FACADE = new THREE.Color('#cfd6e0')

function stepProfile(t: typeof LOWER): ProfilePoint[] {
  const pts: ProfilePoint[] = []
  for (let r = 0; r < t.rows; r++) {
    const d = t.d0 + r * t.rowDepth
    const h = t.h0 + r * t.rise
    pts.push([d, h], [d + t.rowDepth, h])
  }
  return pts
}

function colorForSegment(_: number, a: ProfilePoint, b: ProfilePoint) {
  const horizontal = Math.abs(a[1] - b[1]) < 1e-3
  return horizontal ? TREAD : RISER
}

function buildLower() {
  const profile: ProfilePoint[] = [
    [0, 0],
    ...stepProfile(LOWER),
    [LOWER_BACK, tierTopH(LOWER)],
    [LOWER_BACK, CONCOURSE1_H],
  ]
  return sweepProfile(profile, {
    segColor: (j, a, b) => (j === 0 ? WALL : j >= profile.length - 2 ? WALL : colorForSegment(j, a, b)),
    uScale: 4,
    vScale: 4,
  })
}

function buildMiddle() {
  const profile: ProfilePoint[] = [
    [LOWER_BACK, CONCOURSE1_H],
    [MIDDLE.d0, CONCOURSE1_H],
    [MIDDLE.d0, MIDDLE.h0],
    ...stepProfile(MIDDLE),
    [MIDDLE_BACK, tierTopH(MIDDLE)],
    [MIDDLE_BACK, CONCOURSE2_H],
  ]
  const n = profile.length
  return sweepProfile(profile, {
    segColor: (j, a, b) => (j <= 1 ? WALL : j >= n - 2 ? WALL : colorForSegment(j, a, b)),
    uScale: 4,
    vScale: 4,
  })
}

function buildUpper() {
  const profile: ProfilePoint[] = [
    [MIDDLE_BACK, CONCOURSE2_H],
    [UPPER.d0, CONCOURSE2_H],
    [UPPER.d0, UPPER.h0],
    ...stepProfile(UPPER),
    [UPPER_BACK, UPPER_TOP],
    [UPPER_BACK, UPPER_TOP + 1.2],
    [UPPER_BACK + 1.4, UPPER_TOP + 1.2],
    [UPPER_BACK + 2.8, -0.2],
  ]
  const n = profile.length
  return sweepProfile(profile, {
    segColor: (j, a, b) => (j <= 1 ? WALL : j >= n - 4 ? FACADE : colorForSegment(j, a, b)),
    uScale: 4,
    vScale: 4,
  })
}

const roofBottomAt = (d: number) =>
  ROOF.yInnerBottom + ((d - ROOF.dInner) / (ROOF.dOuter - ROOF.dInner)) * (ROOF.yOuterBottom - ROOF.yInnerBottom)

/** Samples points along the bowl path at a fixed offset with roughly constant spacing. */
function pathPointsEvery(d: number, spacing: number) {
  const out: { x: number; z: number; nx: number; nz: number }[] = []
  for (const piece of PIECES) {
    const len = pieceLength(piece, d)
    const n = Math.max(1, Math.round(len / spacing))
    for (let i = 0; i < n; i++) out.push(piecePoint(piece, (i + 0.5) / n, d))
  }
  return out
}

function OuterCrown() {
  const ribRef = useRef<THREE.InstancedMesh>(null)
  const collarGeo = useMemo(
    () =>
      sweepProfile(
        [
          [UPPER_BACK - 0.1, UPPER_TOP + 1.2],
          [UPPER_BACK + 1.6, UPPER_TOP + 3.0],
          [UPPER_BACK + 8.4, UPPER_TOP + 4.5],
          [UPPER_BACK + 8.8, UPPER_TOP + 3.1],
          [UPPER_BACK + 3.6, UPPER_TOP - 1.2],
          [UPPER_BACK + 2.8, -0.2],
        ],
        { closed: false, arcSegments: 32, uScale: 4, vScale: 4 },
      ),
    [],
  )
  const pts = useMemo(() => pathPointsEvery(UPPER_BACK + 3.6, 10), [])

  useLayoutEffect(() => {
    const mesh = ribRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3(1, 1, 1)

    pts.forEach((pt, i) => {
      q.setFromAxisAngle(up, Math.atan2(pt.nx, pt.nz))
      p.set(pt.x, (UPPER_TOP + 1.5) / 2, pt.z)
      m.compose(p, q, sc)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [pts])

  return (
    <group>
      <mesh geometry={collarGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#eef1f5" roughness={0.55} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={ribRef} args={[undefined, undefined, pts.length]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[0.45, UPPER_TOP + 1.6, 1.8]} />
        <meshStandardMaterial color="#d2d8e2" roughness={0.6} metalness={0.15} />
      </instancedMesh>
    </group>
  )
}

function Columns() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const d = UPPER_BACK + 2.2
  const pts = useMemo(() => pathPointsEvery(d, 12), [d])
  const y0 = UPPER_TOP + 3.0
  const y1 = roofBottomAt(d)
  const h = y1 - y0
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    pts.forEach((p, i) => {
      mat.makeTranslation(p.x, y0 + h / 2, p.z)
      m.setMatrixAt(i, mat)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [pts, y0, h])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} castShadow>
      <cylinderGeometry args={[0.35, 0.45, h, 10]} />
      <meshStandardMaterial color="#b9bec6" metalness={0.6} roughness={0.35} />
    </instancedMesh>
  )
}

function Scoreboards() {
  const board = useMemo(() => createLiveScoreboard(MATCH.homeShort, MATCH.awayShort), [])
  const elapsedRef = useRef(0)
  const d = ROOF.dInner - 1.2

  useFrame((_, delta) => {
    const st = useStadiumStore.getState()
    if (st.stage !== 'view' && !st.droneTour) return
    elapsedRef.current += Math.min(delta, 0.1)
    board.update(elapsedRef.current)
  })

  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 38.8, s * (BOWL.halfZ + d)]} rotation={[0, s === 1 ? Math.PI : 0, 0]}>
          <mesh>
            <boxGeometry args={[17, 5.9, 0.6]} />
            <meshStandardMaterial color="#0b0d10" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.31]}>
            <planeGeometry args={[16.4, 5.4]} />
            <meshStandardMaterial
              map={board.texture}
              emissiveMap={board.texture}
              emissive="#ffffff"
              emissiveIntensity={1.4}
              toneMapped
            />
          </mesh>
          {[-6, 6].map((x) => (
            <mesh key={x} position={[x, 3.6, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 1.4, 6]} />
              <meshStandardMaterial color="#777" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

function CrowdFlashes() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  const flashes = useMemo(() => {
    const rand = mulberry32(99)
    const list: { x: number; y: number; z: number; period: number; phase: number }[] = []
    const step = Math.floor(SECTORS.length / 28)
    for (let i = 0; i < 28; i++) {
      const sector = SECTORS[(i * step) % SECTORS.length]
      const seats = getSectorSeats(sector.id)
      const seat = seats[Math.floor(rand() * seats.length)]
      if (!seat) continue
      list.push({
        x: seat.x,
        y: seat.y + 1.05,
        z: seat.z,
        period: 3.5 + rand() * 5.5,
        phase: rand() * 9.0,
      })
    }
    return list
  }, [])

  const mat = useMemo(() => new THREE.Matrix4(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    sc.set(0, 0, 0)
    flashes.forEach((f, i) => {
      pos.set(f.x, f.y, f.z)
      mat.compose(pos, quat, sc)
      mesh.setMatrixAt(i, mat)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [flashes, mat, pos, quat, sc])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const st = useStadiumStore.getState()
    const visible = (st.stage === 'view' || st.droneTour) && lightingState.lampFactor > 0.05
    mesh.visible = visible
    if (!visible) return
    if (matRef.current) matRef.current.opacity = 0.95 * lightingState.lampFactor
    const t = clock.elapsedTime
    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i]
      const age = (t + f.phase) % f.period
      const s = age < 0.16 ? Math.sin((age / 0.16) * Math.PI) * 1.15 : 0
      pos.set(f.x, f.y, f.z)
      sc.set(s, s, s)
      mat.compose(pos, quat, sc)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, flashes.length]}
      visible={false}
      frustumCulled={false}
      raycast={() => null}
    >
      <octahedronGeometry args={[0.24, 0]} />
      <meshBasicMaterial
        ref={matRef}
        color="#ffffff"
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

function TensionCables() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const segments = useMemo(() => {
    const out: { start: THREE.Vector3; end: THREE.Vector3 }[] = []
    const dOut = UPPER_BACK + 2.2
    for (const piece of PIECES) {
      const len = pieceLength(piece, dOut)
      const n = Math.max(1, Math.round(len / 12))
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n
        const pOut = piecePoint(piece, f, dOut)
        const pIn = piecePoint(piece, f, ROOF.dInner)
        out.push({
          start: new THREE.Vector3(pOut.x, roofBottomAt(dOut) - 0.1, pOut.z),
          end: new THREE.Vector3(pIn.x, ROOF.yInnerBottom - 0.08, pIn.z),
        })
      }
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const mid = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const sc = new THREE.Vector3()
    const m = new THREE.Matrix4()

    segments.forEach((seg, i) => {
      dir.subVectors(seg.end, seg.start)
      const len = dir.length()
      dir.normalize()
      q.setFromUnitVectors(up, dir)
      mid.addVectors(seg.start, seg.end).multiplyScalar(0.5)
      sc.set(1, len, 1)
      m.compose(mid, q, sc)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [segments])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segments.length]} raycast={() => null}>
      <cylinderGeometry args={[0.045, 0.045, 1, 6]} />
      <meshStandardMaterial color="#a4acb8" metalness={0.8} roughness={0.3} />
    </instancedMesh>
  )
}

function SectorPlaques() {
  const plaques = useMemo(
    () =>
      SECTORS.filter((s) => s.tierId === 'middle' || s.tierId === 'upper').map((s) => {
        const tier = TIER_BY_ID[s.tierId]
        const piece = PIECES[s.pieceIndex]
        const p = piecePoint(piece, (s.f0 + s.f1) / 2, tier.d0 - 0.12)
        return {
          id: s.id,
          pos: [p.x, tier.h0 + 0.25, p.z] as [number, number, number],
          yaw: Math.atan2(-p.nx, -p.nz),
          tex: getLabelTexture(String(s.number), 700, 68),
        }
      }),
    [],
  )

  return (
    <group>
      {plaques.map((pl) => (
        <group key={pl.id} position={pl.pos} rotation={[0, pl.yaw, 0]}>
          <mesh position={[0, 0, -0.01]} raycast={() => null}>
            <planeGeometry args={[1.85, 0.78]} />
            <meshStandardMaterial color="#101a36" roughness={0.55} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.01]} raycast={() => null}>
            <planeGeometry args={[1.7, 0.75]} />
            <meshBasicMaterial map={pl.tex} color="#eef2f8" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Stairways() {
  const railRef = useRef<THREE.InstancedMesh>(null)
  const stepRef = useRef<THREE.InstancedMesh>(null)
  const stepMatRef = useRef<THREE.MeshStandardMaterial>(null)

  const { rails, steps } = useMemo(() => {
    const railList: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = []
    const stepList: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = []
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const mid = new THREE.Vector3()
    const q = new THREE.Quaternion()

    for (const s of SECTORS) {
      const tier = TIER_BY_ID[s.tierId]
      const piece = PIECES[s.pieceIndex]
      const dStart = tier.d0 + 0.3
      const dEnd = tierBackD(tier) - 0.3
      const p0 = piecePoint(piece, s.f0, dStart)
      const p1 = piecePoint(piece, s.f0, dEnd)
      const a = new THREE.Vector3(p0.x, tier.h0 + 0.72, p0.z)
      const b = new THREE.Vector3(p1.x, tierTopH(tier) + 0.72, p1.z)
      dir.subVectors(b, a)
      const len = dir.length()
      dir.normalize()
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
      mid.addVectors(a, b).multiplyScalar(0.5)
      railList.push({ pos: mid.clone(), quat: q.clone(), len })

      for (let r = 0; r < tier.rows; r += 2) {
        const d = tier.d0 + r * tier.rowDepth + 0.06
        const y = tier.h0 + r * tier.rise + 0.03
        const ps = piecePoint(piece, s.f0, d)
        const yaw = Math.atan2(-ps.nx, -ps.nz)
        stepList.push({
          pos: new THREE.Vector3(ps.x, y, ps.z),
          quat: new THREE.Quaternion().setFromAxisAngle(up, yaw),
        })
      }
    }
    return { rails: railList, steps: stepList }
  }, [])

  useLayoutEffect(() => {
    const railMesh = railRef.current
    const stepMesh = stepRef.current
    if (!railMesh || !stepMesh) return
    const m = new THREE.Matrix4()
    const sc = new THREE.Vector3()

    rails.forEach((r, i) => {
      sc.set(0.055, 0.055, r.len)
      m.compose(r.pos, r.quat, sc)
      railMesh.setMatrixAt(i, m)
    })
    rails.length && (railMesh.instanceMatrix.needsUpdate = true)
    railMesh.computeBoundingSphere()

    sc.set(0.76, 0.03, 0.045)
    steps.forEach((st, i) => {
      m.compose(st.pos, st.quat, sc)
      stepMesh.setMatrixAt(i, m)
    })
    steps.length && (stepMesh.instanceMatrix.needsUpdate = true)
    stepMesh.computeBoundingSphere()
  }, [rails, steps])

  useFrame(() => {
    if (stepMatRef.current) {
      stepMatRef.current.emissiveIntensity = 0.12 + 2.08 * lightingState.lampFactor
    }
  })

  return (
    <group>
      <instancedMesh ref={railRef} args={[undefined, undefined, rails.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#cfd5de" metalness={0.55} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={stepRef} args={[undefined, undefined, steps.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={stepMatRef} color="#ffd588" emissive="#ffc466" emissiveIntensity={0.12} />
      </instancedMesh>
    </group>
  )
}

const CITY_DAY = new THREE.Color('#8ea5bf')
const CITY_DUSK = new THREE.Color('#192132')
const CITY_NIGHT = new THREE.Color('#0a0f1c')

function CityHorizon() {
  const groupRef = useRef<THREE.Group>(null)
  const ref = useRef<THREE.InstancedMesh>(null)
  const towerMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const ptsRef = useRef<THREE.Points>(null)
  const windowMatRef = useRef<THREE.PointsMaterial>(null)

  const { towers, windowGeo } = useMemo(() => {
    const rand = mulberry32(2026)
    const list: { x: number; y: number; z: number; w: number; h: number; d: number; rotY: number }[] = []
    const pts: number[] = []
    for (let i = 0; i < 96; i++) {
      const ang = (i / 96) * Math.PI * 2 + (rand() - 0.5) * 0.04
      const r = 490 + rand() * 140
      const w = 16 + rand() * 18
      const d = 16 + rand() * 18
      const h = 22 + rand() * 50
      const x = Math.cos(ang) * r
      const z = Math.sin(ang) * r
      list.push({ x, y: h / 2 - 1, z, w, h, d, rotY: -ang })
      for (let k = 0; k < 5; k++) {
        if (rand() > 0.12) {
          pts.push(x + (rand() - 0.5) * w * 0.7, 6 + rand() * (h - 10), z + (rand() - 0.5) * d * 0.7)
        }
      }
    }
    const wg = new THREE.BufferGeometry()
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return { towers: list, windowGeo: wg }
  }, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    towers.forEach((tw, i) => {
      q.setFromAxisAngle(up, tw.rotY)
      p.set(tw.x, tw.y, tw.z)
      sc.set(tw.w, tw.h, tw.d)
      m.compose(p, q, sc)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [towers])

  useFrame(() => {
    const st = useStadiumStore.getState()
    const visible = st.stage === 'view' || st.droneTour
    if (groupRef.current) groupRef.current.visible = visible
    if (!visible) return

    const tLight = Math.max(0, Math.min(2, lightingState.timeOfDay))
    if (towerMatRef.current) {
      if (tLight <= 1) towerMatRef.current.color.lerpColors(CITY_DAY, CITY_DUSK, tLight)
      else towerMatRef.current.color.lerpColors(CITY_DUSK, CITY_NIGHT, tLight - 1)
    }
    if (ptsRef.current && windowMatRef.current) {
      const f = lightingState.lampFactor
      ptsRef.current.visible = f > 0.03
      windowMatRef.current.opacity = 0.75 * f
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={ref} args={[undefined, undefined, towers.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={towerMatRef} color="#8ea5bf" roughness={0.9} metalness={0.1} />
      </instancedMesh>
      <points ref={ptsRef} geometry={windowGeo} visible={false} raycast={() => null}>
        <pointsMaterial ref={windowMatRef} color="#ffd79a" size={3.2} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>
    </group>
  )
}

/** Roof, floodlight ring, columns, cables, plaques and screens. Shown in seat view and low inside-bowl drone flight. */
function Roof() {
  const group = useRef<THREE.Group>(null)
  const floodMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const beamRefs = useRef<(THREE.Mesh | null)[]>([])
  const beamMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const roofGeo = useMemo(
    () =>
      sweepProfile(
        [
          [ROOF.dInner, ROOF.yInnerBottom],
          [ROOF.dInner, ROOF.yInnerTop],
          [ROOF.dOuter, ROOF.yOuterTop],
          [ROOF.dOuter, ROOF.yOuterBottom],
        ],
        { closed: true, arcSegments: 32, uScale: 3, vScale: 3 },
      ),
    [],
  )
  const ringGeo = useMemo(
    () =>
      sweepProfile(
        [
          [ROOF.dInner - 0.15, ROOF.yInnerBottom - 0.18],
          [ROOF.dInner + 0.15, ROOF.yInnerBottom + 0.12],
        ],
        { arcSegments: 32 },
      ),
    [],
  )
  const ribsGeo = useMemo(() => {
    const pts = pathPointsEvery(ROOF.dInner, 8)
    const geos: THREE.BufferGeometry[] = []
    const len = ROOF.dOuter - ROOF.dInner
    pts.forEach((p) => {
      const g = new THREE.BoxGeometry(0.35, 0.8, len)
      g.translate(0, 0, len / 2)
      const ang = Math.atan2(p.nx, p.nz)
      const tilt = -Math.atan2(ROOF.yOuterBottom - ROOF.yInnerBottom, len)
      const m = new THREE.Matrix4()
        .makeTranslation(p.x, ROOF.yInnerBottom - 0.4, p.z)
        .multiply(new THREE.Matrix4().makeRotationY(ang))
        .multiply(new THREE.Matrix4().makeRotationX(tilt))
      g.applyMatrix4(m)
      geos.push(g)
    })
    return mergeBoxes(geos)
  }, [])
  const lightGeo = useMemo(
    () =>
      sweepProfile(
        [
          [ROOF.dInner + 0.3, ROOF.yInnerBottom - 0.15],
          [ROOF.dInner + 1.6, roofBottomAt(ROOF.dInner + 1.6) - 0.15],
        ],
        { arcSegments: 32 },
      ),
    [],
  )
  const beamGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(20, 50, 24, 1, true)
    g.translate(0, -25, 0)
    return g
  }, [])
  const beamTransforms = useMemo(() => {
    const down = new THREE.Vector3(0, -1, 0)
    const target = new THREE.Vector3(0, 0, 0)
    const corners: [number, number, number][] = [
      [-38, 41.2, -54],
      [38, 41.2, -54],
      [38, 41.2, 54],
      [-38, 41.2, 54],
    ]
    return corners.map((pos) => {
      const origin = new THREE.Vector3(...pos)
      const dir = target.clone().sub(origin).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(down, dir)
      return { pos, quat: [q.x, q.y, q.z, q.w] as [number, number, number, number] }
    })
  }, [])
  const noise = useMemo(() => createNoiseTexture(128, 21, 0.25), [])

  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    const st = useStadiumStore.getState()
    const insideBowl = camera.position.y < ROOF.yInnerBottom - 1.0 && Math.abs(camera.position.x) < 96 && Math.abs(camera.position.z) < 114
    const show = (st.stage === 'view' || st.droneTour) && insideBowl
    g.visible = show
    if (!show) return

    if (floodMatRef.current) {
      floodMatRef.current.emissiveIntensity = 0.7 + 7.8 * lightingState.lampFactor
    }
    const beamOp = 0.045 * lightingState.nightFactor
    const beamShow = lightingState.nightFactor > 0.02
    for (let i = 0; i < beamTransforms.length; i++) {
      const bm = beamRefs.current[i]
      const mat = beamMatRefs.current[i]
      if (bm) bm.visible = beamShow
      if (mat) mat.opacity = beamOp
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh geometry={roofGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#eef1f5" roughnessMap={noise} roughness={0.65} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={ribsGeo} castShadow>
        <meshStandardMaterial color="#8b9099" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh geometry={ringGeo}>
        <meshStandardMaterial color="#2c323d" roughness={0.4} metalness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <TensionCables />
      <SectorPlaques />
      <mesh geometry={lightGeo}>
        <meshStandardMaterial ref={floodMatRef} color="#ffffff" emissive="#fff6e6" emissiveIntensity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {beamTransforms.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => {
            beamRefs.current[i] = el
          }}
          visible={false}
          position={b.pos}
          quaternion={b.quat}
          geometry={beamGeo}
          raycast={() => null}
        >
          <meshBasicMaterial
            ref={(el) => {
              beamMatRefs.current[i] = el
            }}
            color="#dceaff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <Columns />
      <Scoreboards />
    </group>
  )
}

function Vomitories() {
  const frameRef = useRef<THREE.InstancedMesh>(null)
  const voidRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)

  const items = useMemo(() => {
    const list: { x: number; y: number; z: number; yaw: number; w: number; h: number }[] = []
    for (const s of SECTORS) {
      if (Number(s.id) % 2 !== 1) continue
      const piece = PIECES[s.pieceIndex]
      if (s.tierId === 'lower') {
        const p = piecePoint(piece, s.f0, LOWER_BACK - 0.06)
        list.push({ x: p.x, y: 8.3, z: p.z, yaw: Math.atan2(-p.nx, -p.nz), w: 1.38, h: 1.56 })
      } else if (s.tierId === 'middle') {
        const p = piecePoint(piece, s.f0, MIDDLE_BACK - 0.06)
        list.push({ x: p.x, y: 20.72, z: p.z, yaw: Math.atan2(-p.nx, -p.nz), w: 1.42, h: 1.58 })
      } else {
        const p = piecePoint(piece, s.f0, UPPER_BACK - 0.06)
        list.push({ x: p.x, y: UPPER_TOP + 0.35, z: p.z, yaw: Math.atan2(-p.nx, -p.nz), w: 1.45, h: 1.6 })
      }
    }
    return list
  }, [])

  useLayoutEffect(() => {
    const frame = frameRef.current
    const recess = voidRef.current
    const strip = lightRef.current
    if (!frame || !recess || !strip) return

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const localIn = new THREE.Vector3()

    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.yaw)

      localIn.set(0, 0, 0.05).applyQuaternion(q)
      p.set(it.x + localIn.x, it.y, it.z + localIn.z)
      sc.set(it.w + 0.16, it.h + 0.1, 0.22)
      m.compose(p, q, sc)
      frame.setMatrixAt(i, m)

      localIn.set(0, -0.02, 0.09).applyQuaternion(q)
      p.set(it.x + localIn.x, it.y + localIn.y, it.z + localIn.z)
      sc.set(it.w - 0.08, it.h - 0.12, 0.18)
      m.compose(p, q, sc)
      recess.setMatrixAt(i, m)

      localIn.set(0, it.h * 0.41, 0.14).applyQuaternion(q)
      p.set(it.x + localIn.x, it.y + localIn.y, it.z + localIn.z)
      sc.set(it.w - 0.2, 0.05, 0.06)
      m.compose(p, q, sc)
      strip.setMatrixAt(i, m)
    })

    frame.instanceMatrix.needsUpdate = true
    recess.instanceMatrix.needsUpdate = true
    strip.instanceMatrix.needsUpdate = true
    frame.computeBoundingSphere()
    recess.computeBoundingSphere()
    strip.computeBoundingSphere()
  }, [items])

  return (
    <group>
      <instancedMesh ref={frameRef} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#181b22" roughness={0.75} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={voidRef} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#050608" />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffdfa8" emissive="#ffd18a" emissiveIntensity={1.6} />
      </instancedMesh>
    </group>
  )
}

function PlayerTunnel() {
  return (
    <group position={[-41.8, 0, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.2, 1.65]} />
        <meshStandardMaterial color="#151820" roughness={0.65} metalness={0.2} />
      </mesh>
      <mesh position={[0.18, 0.95, 0]}>
        <boxGeometry args={[1.0, 1.85, 1.25]} />
        <meshBasicMaterial color="#050608" />
      </mesh>
      <mesh position={[0.61, 2.08, 0]}>
        <boxGeometry args={[0.06, 0.06, 1.45]} />
        <meshStandardMaterial color="#d9ff3f" emissive="#d9ff3f" emissiveIntensity={1.2} />
      </mesh>
    </group>
  )
}

function mergeBoxes(geos: THREE.BufferGeometry[]) {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let offset = 0
  for (const g of geos) {
    const p = g.attributes.position.array
    const n = g.attributes.normal.array
    for (let i = 0; i < p.length; i++) {
      pos.push(p[i])
      nor.push(n[i])
    }
    const index = g.index!.array
    for (let i = 0; i < index.length; i++) idx.push(index[i] + offset)
    offset += g.attributes.position.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}

export function StadiumStructure() {
  const fasciaMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const skyboxMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const lower = useMemo(buildLower, [])
  const middle = useMemo(buildMiddle, [])
  const upper = useMemo(buildUpper, [])
  const concreteNoise = useMemo(() => createNoiseTexture(128, 5, 0.35), [])
  const fasciaTex = useMemo(() => createFasciaTexture(), [])

  useFrame((_, delta) => {
    const f = lightingState.lampFactor
    for (let i = 0; i < 2; i++) {
      const fm = fasciaMatRefs.current[i]
      if (fm) fm.emissiveIntensity = 0.65 + 0.85 * f
      const sm = skyboxMatRefs.current[i]
      if (sm) sm.emissiveIntensity = 0.25 + 1.5 * f
    }

    const st = useStadiumStore.getState()
    if (st.stage !== 'view' && !st.droneTour) return
    fasciaTex.offset.x = (fasciaTex.offset.x - Math.min(delta, 0.05) * 0.038 + 1) % 1
  })

  const skyboxTex = useMemo(() => createSkyboxTexture(), [])
  const skybox1Geo = useMemo(
    () =>
      sweepProfile(
        [
          [LOWER_BACK - 0.05, 7.42],
          [LOWER_BACK - 0.05, 9.15],
        ],
        { uD: LOWER_BACK, uScale: 18, arcSegments: 32 },
      ),
    [],
  )
  const skybox2Geo = useMemo(
    () =>
      sweepProfile(
        [
          [MIDDLE_BACK - 0.05, 19.88],
          [MIDDLE_BACK - 0.05, 21.55],
        ],
        { uD: MIDDLE_BACK, uScale: 18, arcSegments: 32 },
      ),
    [],
  )

  const fascia1Geo = useMemo(
    () =>
      sweepProfile(
        [
          [MIDDLE.d0 - 0.04, 9.5],
          [MIDDLE.d0 - 0.04, 10.9],
        ],
        { uD: MIDDLE.d0, uScale: 60, arcSegments: 32 },
      ),
    [],
  )
  const fascia2Geo = useMemo(
    () =>
      sweepProfile(
        [
          [UPPER.d0 - 0.04, 21.9],
          [UPPER.d0 - 0.04, 23.3],
        ],
        { uD: UPPER.d0, uScale: 60, arcSegments: 32 },
      ),
    [],
  )

  const blueTrimGeo = useMemo(
    () => [
      sweepProfile(
        [
          [MIDDLE.d0 - 0.07, CONCOURSE1_H],
          [MIDDLE.d0 - 0.07, CONCOURSE1_H + 0.35],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [MIDDLE.d0 - 0.07, MIDDLE.h0 - 0.35],
          [MIDDLE.d0 - 0.07, MIDDLE.h0],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [UPPER.d0 - 0.07, CONCOURSE2_H],
          [UPPER.d0 - 0.07, CONCOURSE2_H + 0.35],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [UPPER.d0 - 0.07, UPPER.h0 - 0.35],
          [UPPER.d0 - 0.07, UPPER.h0],
        ],
        { arcSegments: 32 },
      ),
    ],
    [],
  )

  const railsGeo = useMemo(
    () => [
      sweepProfile(
        [
          [MIDDLE.d0 - 0.05, MIDDLE.h0],
          [MIDDLE.d0 - 0.05, MIDDLE.h0 + 0.62],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [UPPER.d0 - 0.05, UPPER.h0],
          [UPPER.d0 - 0.05, UPPER.h0 + 0.62],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [0.02, 1.3],
          [0.02, 1.85],
        ],
        { arcSegments: 32 },
      ),
    ],
    [],
  )

  const topRailsGeo = useMemo(
    () => [
      sweepProfile(
        [
          [MIDDLE.d0 - 0.08, MIDDLE.h0 + 0.62],
          [MIDDLE.d0 - 0.02, MIDDLE.h0 + 0.68],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [UPPER.d0 - 0.08, UPPER.h0 + 0.62],
          [UPPER.d0 - 0.02, UPPER.h0 + 0.68],
        ],
        { arcSegments: 32 },
      ),
      sweepProfile(
        [
          [0, 1.85],
          [0.06, 1.9],
        ],
        { arcSegments: 32 },
      ),
    ],
    [],
  )

  return (
    <group>
      <mesh geometry={lower} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughnessMap={concreteNoise} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={middle} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughnessMap={concreteNoise} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={upper} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughnessMap={concreteNoise} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <OuterCrown />

      {[fascia1Geo, fascia2Geo].map((geo, i) => (
        <mesh key={`f-${i}`} geometry={geo}>
          <meshStandardMaterial
            ref={(el) => {
              fasciaMatRefs.current[i] = el
            }}
            map={fasciaTex}
            emissiveMap={fasciaTex}
            emissive="#ffffff"
            emissiveIntensity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {blueTrimGeo.map((geo, i) => (
        <mesh key={`bt-${i}`} geometry={geo}>
          <meshStandardMaterial color="#1b3d8f" roughness={0.45} metalness={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[skybox1Geo, skybox2Geo].map((geo, i) => (
        <mesh key={`sb-${i}`} geometry={geo}>
          <meshStandardMaterial
            ref={(el) => {
              skyboxMatRefs.current[i] = el
            }}
            map={skyboxTex}
            emissiveMap={skyboxTex}
            emissive="#ffdfa8"
            emissiveIntensity={0.25}
            roughness={0.18}
            metalness={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      <Vomitories />
      <PlayerTunnel />
      <Stairways />
      <StadiumCrowd />
      <CrowdFlashes />
      <CityHorizon />

      {railsGeo.map((geo, i) => (
        <mesh key={`rg-${i}`} geometry={geo}>
          <meshStandardMaterial color="#0c1018" transparent opacity={0.35} roughness={0.12} metalness={0.2} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {topRailsGeo.map((geo, i) => (
        <mesh key={`tr-${i}`} geometry={geo}>
          <meshStandardMaterial color="#252932" roughness={0.4} metalness={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <Roof />
    </group>
  )
}
