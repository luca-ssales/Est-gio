import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getSeat, getSectorSeats } from '../../data/seats'
import { SECTORS } from '../../data/sectors'
import { mulberry32 } from '../../lib/random'
import { useStadiumStore } from '../../store/useStadiumStore'
import { TOUR_SEAT_ID } from '../StadiumCamera/droneTour'

export interface CrowdSpec {
  x: number
  y: number
  z: number
  rotY: number
  scale: number
  colorIdx: number
  headIdx: number
  phase: number
  freq: number
  armRate: number
  flagColorIdx: number
}

export interface StadiumCrowdBuild {
  seated: CrowdSpec[]
  ultras: CrowdSpec[]
  flags: CrowdSpec[]
}

const JERSEY_COLORS = [
  new THREE.Color('#d62839'), // 0 Aurora crimson
  new THREE.Color('#b01c2d'), // 1 Deep crimson
  new THREE.Color('#f4f6fa'), // 2 Crisp white
  new THREE.Color('#1d469e'), // 3 Atlético royal blue
  new THREE.Color('#132d66'), // 4 Atlético navy
  new THREE.Color('#2a3140'), // 5 Slate dark
  new THREE.Color('#d9ff3f'), // 6 Electric lime accent
]

const HEAD_COLORS = [
  new THREE.Color('#f0c8a8'),
  new THREE.Color('#d8a078'),
  new THREE.Color('#b07850'),
  new THREE.Color('#784c30'),
  new THREE.Color('#e6bd9d'),
]

function pickZoneJersey(zone: string, rand: () => number): number {
  const r = rand()
  if (zone === 'N' || zone === 'NW' || zone === 'NE') {
    if (r < 0.56) return 0
    if (r < 0.72) return 1
    if (r < 0.9) return 2
    if (r < 0.96) return 5
    return 6
  }
  if (zone === 'S' || zone === 'SW' || zone === 'SE') {
    if (r < 0.55) return 3
    if (r < 0.75) return 4
    if (r < 0.92) return 2
    return 5
  }
  if (r < 0.36) return 0
  if (r < 0.56) return 2
  if (r < 0.78) return 3
  return 5
}

/** Deterministic 3-tier crowd & standing ultras generator with strict selected-seat sightline protection. */
export function buildCrowdInstances(selectedSeatId: string | null): StadiumCrowdBuild {
  const rand = mulberry32(7777)
  const selectedSeat = selectedSeatId ? getSeat(selectedSeatId) : null

  const seated: CrowdSpec[] = []
  const ultras: CrowdSpec[] = []
  const flags: CrowdSpec[] = []

  const isNearSelected = (x: number, y: number, z: number, sectorId: string, row: number, num: number) => {
    if (!selectedSeat) return false
    const dx = x - selectedSeat.x
    const dy = y - selectedSeat.y
    const dz = z - selectedSeat.z
    if (dx * dx + dy * dy + dz * dz < 3.6 * 3.6) return true
    if (
      sectorId === selectedSeat.sectorId &&
      row < selectedSeat.row &&
      selectedSeat.row - row <= 2 &&
      Math.abs(num - selectedSeat.number) <= 3
    ) {
      return true
    }
    return false
  }

  for (const sector of SECTORS) {
    const seats = getSectorSeats(sector.id)
    const isGoal = sector.side === 'goal'
    const isNorthSouth = sector.zone === 'N' || sector.zone === 'S'
    const seatedProb = isGoal ? 0.14 : sector.side === 'corner' ? 0.08 : 0.055

    for (let i = 0; i < seats.length; i++) {
      const s = seats[i]
      if (isNearSelected(s.x, s.y, s.z, s.sectorId, s.row, s.number)) {
        // Consume consistent PRNG steps for stability
        rand()
        rand()
        continue
      }

      // Reserve standing cheering ultras in goal-end lower/middle rows
      if (
        isNorthSouth &&
        sector.tierId !== 'upper' &&
        s.row >= 4 &&
        s.row <= 15 &&
        ultras.length < 260 &&
        rand() < 0.055
      ) {
        const isNorth = sector.zone === 'N'
        const flagChance = s.row >= 9 && s.row <= 14 && flags.length < 28 && rand() < 0.11
        const colorIdx = pickZoneJersey(sector.zone, rand)
        const headIdx = Math.floor(rand() * HEAD_COLORS.length)
        const spec: CrowdSpec = {
          x: s.x,
          y: s.y,
          z: s.z,
          rotY: s.rotY,
          scale: 0.94 + rand() * 0.12,
          colorIdx,
          headIdx,
          phase: rand() * Math.PI * 2,
          freq: 4.5 + rand() * 2.2,
          armRate: 0.9 + rand() * 0.9,
          flagColorIdx: isNorth ? (rand() < 0.72 ? 0 : rand() < 0.85 ? 2 : 6) : rand() < 0.75 ? 3 : 2,
        }
        ultras.push(spec)
        if (flagChance) flags.push(spec)
        continue
      }

      if (rand() < seatedProb && seated.length < 4100) {
        seated.push({
          x: s.x,
          y: s.y,
          z: s.z,
          rotY: s.rotY,
          scale: 0.92 + rand() * 0.14,
          colorIdx: pickZoneJersey(sector.zone, rand),
          headIdx: Math.floor(rand() * HEAD_COLORS.length),
          phase: 0,
          freq: 0,
          armRate: 0,
          flagColorIdx: 0,
        })
      }
    }
  }

  return { seated, ultras, flags }
}

/** Packed 3-tier matchday crowd + cheering goal-end ultras + waving flags (visible in View 3D & Drone Tour). */
export function StadiumCrowd() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const invalidate = useThree((s) => s.invalidate)

  const visible = stage === 'view' || droneTour
  const crowd = useMemo(
    () => buildCrowdInstances(stage === 'view' ? selectedSeatId : droneTour ? TOUR_SEAT_ID : null),
    [stage, droneTour, selectedSeatId],
  )

  const seatedTorsoRef = useRef<THREE.InstancedMesh>(null)
  const seatedHeadRef = useRef<THREE.InstancedMesh>(null)
  const ultraTorsoRef = useRef<THREE.InstancedMesh>(null)
  const ultraHeadRef = useRef<THREE.InstancedMesh>(null)
  const ultraArmsRef = useRef<THREE.InstancedMesh>(null)
  const flagPoleRef = useRef<THREE.InstancedMesh>(null)
  const flagClothRef = useRef<THREE.InstancedMesh>(null)

  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      p: new THREE.Vector3(),
      sc: new THREE.Vector3(),
    }),
    [],
  )

  const writeDynamic = (t: number) => {
    const { m, q, euler, p, sc } = scratch

    const uTorso = ultraTorsoRef.current
    const uHead = ultraHeadRef.current
    const uArms = ultraArmsRef.current
    if (uTorso && uHead && uArms) {
      for (let i = 0; i < crowd.ultras.length; i++) {
        const sp = crowd.ultras[i]
        const hop = Math.abs(Math.sin(t * sp.freq + sp.phase)) * 0.24
        const raise = Math.max(0, Math.sin(t * sp.armRate + sp.phase)) * 0.36
        euler.set(0, sp.rotY, 0, 'YXZ')
        q.setFromEuler(euler)
        sc.set(sp.scale, sp.scale, sp.scale)

        p.set(sp.x, sp.y + (0.62 + hop) * sp.scale, sp.z)
        m.compose(p, q, sc)
        uTorso.setMatrixAt(i, m)

        p.set(sp.x, sp.y + (1.14 + hop) * sp.scale, sp.z)
        m.compose(p, q, sc)
        uHead.setMatrixAt(i, m)

        p.set(sp.x, sp.y + (0.86 + hop + raise) * sp.scale, sp.z)
        m.compose(p, q, sc)
        uArms.setMatrixAt(i, m)
      }
      uTorso.instanceMatrix.needsUpdate = true
      uHead.instanceMatrix.needsUpdate = true
      uArms.instanceMatrix.needsUpdate = true
    }

    const fPole = flagPoleRef.current
    const fCloth = flagClothRef.current
    if (fPole && fCloth) {
      for (let i = 0; i < crowd.flags.length; i++) {
        const sp = crowd.flags[i]
        const swayZ = Math.sin(t * 2.2 + sp.phase) * 0.16
        const swayX = Math.cos(t * 1.7 + sp.phase) * 0.1
        euler.set(swayX, sp.rotY, swayZ, 'YXZ')
        q.setFromEuler(euler)
        sc.set(1, 1, 1)

        p.set(sp.x, sp.y + 1.55, sp.z)
        m.compose(p, q, sc)
        fPole.setMatrixAt(i, m)

        euler.set(swayX, sp.rotY + Math.sin(t * 4.8 + sp.phase) * 0.35, swayZ, 'YXZ')
        q.setFromEuler(euler)
        p.set(sp.x + swayZ * 0.85, sp.y + 2.35, sp.z)
        m.compose(p, q, sc)
        fCloth.setMatrixAt(i, m)
      }
      fPole.instanceMatrix.needsUpdate = true
      fCloth.instanceMatrix.needsUpdate = true
    }
  }

  useLayoutEffect(() => {
    if (!visible) return
    const { m, q, euler, p, sc } = scratch
    const sTorso = seatedTorsoRef.current
    const sHead = seatedHeadRef.current
    if (sTorso && sHead) {
      crowd.seated.forEach((sp, i) => {
        euler.set(0, sp.rotY, 0, 'YXZ')
        q.setFromEuler(euler)
        sc.set(sp.scale, sp.scale, sp.scale)
        p.set(sp.x, sp.y + 0.48 * sp.scale, sp.z)
        m.compose(p, q, sc)
        sTorso.setMatrixAt(i, m)
        sTorso.setColorAt(i, JERSEY_COLORS[sp.colorIdx])

        p.set(sp.x, sp.y + 0.9 * sp.scale, sp.z)
        m.compose(p, q, sc)
        sHead.setMatrixAt(i, m)
        sHead.setColorAt(i, HEAD_COLORS[sp.headIdx])
      })
      sTorso.count = crowd.seated.length
      sHead.count = crowd.seated.length
      sTorso.instanceMatrix.needsUpdate = true
      sHead.instanceMatrix.needsUpdate = true
      if (sTorso.instanceColor) sTorso.instanceColor.needsUpdate = true
      if (sHead.instanceColor) sHead.instanceColor.needsUpdate = true
    }

    const uTorso = ultraTorsoRef.current
    const uHead = ultraHeadRef.current
    const uArms = ultraArmsRef.current
    if (uTorso && uHead && uArms) {
      crowd.ultras.forEach((sp, i) => {
        uTorso.setColorAt(i, JERSEY_COLORS[sp.colorIdx])
        uHead.setColorAt(i, HEAD_COLORS[sp.headIdx])
        uArms.setColorAt(i, JERSEY_COLORS[sp.colorIdx])
      })
      uTorso.count = crowd.ultras.length
      uHead.count = crowd.ultras.length
      uArms.count = crowd.ultras.length
      if (uTorso.instanceColor) uTorso.instanceColor.needsUpdate = true
      if (uHead.instanceColor) uHead.instanceColor.needsUpdate = true
      if (uArms.instanceColor) uArms.instanceColor.needsUpdate = true
    }

    const fPole = flagPoleRef.current
    const fCloth = flagClothRef.current
    if (fPole && fCloth) {
      crowd.flags.forEach((sp, i) => {
        fCloth.setColorAt(i, JERSEY_COLORS[sp.flagColorIdx])
      })
      fPole.count = crowd.flags.length
      fCloth.count = crowd.flags.length
      if (fCloth.instanceColor) fCloth.instanceColor.needsUpdate = true
    }

    writeDynamic(0)
  }, [crowd, visible, scratch])

  useFrame(({ clock }) => {
    if (!visible) return
    writeDynamic(clock.elapsedTime)
    invalidate()
  })

  if (!visible) return null

  return (
    <group>
      {/* Layer 1: Static seated crowd across all 3 tiers */}
      <instancedMesh
        ref={seatedTorsoRef}
        args={[undefined, undefined, Math.max(1, crowd.seated.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.38, 0.44, 0.24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.82} />
      </instancedMesh>
      <instancedMesh
        ref={seatedHeadRef}
        args={[undefined, undefined, Math.max(1, crowd.seated.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.13, 6, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.78} />
      </instancedMesh>

      {/* Layer 2: Standing cheering goal-end ultras */}
      <instancedMesh
        ref={ultraTorsoRef}
        args={[undefined, undefined, Math.max(1, crowd.ultras.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.4, 0.62, 0.24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={ultraHeadRef}
        args={[undefined, undefined, Math.max(1, crowd.ultras.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.76} />
      </instancedMesh>
      <instancedMesh
        ref={ultraArmsRef}
        args={[undefined, undefined, Math.max(1, crowd.ultras.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.64, 0.14, 0.14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>

      {/* Layer 3: Waving supporter flags */}
      <instancedMesh
        ref={flagPoleRef}
        args={[undefined, undefined, Math.max(1, crowd.flags.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.025, 0.03, 2.4, 5]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
      </instancedMesh>
      <instancedMesh
        ref={flagClothRef}
        args={[undefined, undefined, Math.max(1, crowd.flags.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.95, 0.65, 0.04]} />
        <meshStandardMaterial color="#ffffff" roughness={0.75} />
      </instancedMesh>
    </group>
  )
}
