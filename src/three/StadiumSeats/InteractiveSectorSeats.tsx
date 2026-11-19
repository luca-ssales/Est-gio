import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CONCOURSE1_H, CONCOURSE2_H, PIECES, TIER_BY_ID, piecePoint } from '../../data/stadium'
import { SECTOR_BY_ID, sectorCategory } from '../../data/sectors'
import { getSectorSeats } from '../../data/seats'
import { getLabelTexture } from '../../lib/textures'
import { useStadiumStore } from '../../store/useStadiumStore'
import { createSeatGeometry } from './seatGeometry'
import { sectorAnchor, sectorOutline } from '../utils/sectorGeometry'

const COL_SELECTED = new THREE.Color('#d9ff3f')
const COL_HOVERED = new THREE.Color('#ff7a48')
const COL_AVAILABLE = new THREE.Color('#dc2f46')
const COL_TAKEN = new THREE.Color('#1e232c')

function SelectedHalo({ x, y, z }: { x: number; y: number; z: number }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)

  useFrame(({ clock }) => {
    const mesh = ringRef.current
    const mat = matRef.current
    if (!mesh || !mat) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.2) * 0.1
    mesh.scale.set(pulse, pulse, 1)
    mat.opacity = 0.78 + Math.sin(clock.elapsedTime * 4.2) * 0.2
    invalidate()
  })

  return (
    <mesh ref={ringRef} position={[x, y + 0.5, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[0.31, 0.45, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color="#d9ff3f"
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function SectorGuides({ sectorId }: { sectorId: string }) {
  const sector = SECTOR_BY_ID[sectorId]
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const anchor = useMemo(() => sectorAnchor(sector), [sector])
  const camYaw = Math.atan2(-anchor.normal.x, -anchor.normal.z)
  const outlinePts = useMemo(() => sectorOutline(sector, 1.1, 0.5), [sector])

  const rowMarkers = useMemo(() => {
    const indices: number[] = []
    for (let r = 0; r < tier.rows; r++) {
      if (r === 0 || (r + 1) % 2 === 0 || r === tier.rows - 1) indices.push(r)
    }
    const items: { key: string; pos: [number, number, number]; tex: THREE.CanvasTexture }[] = []
    for (const r of indices) {
      const d = tier.d0 + r * tier.rowDepth + tier.rowDepth * 0.55
      const y = tier.h0 + r * tier.rise + 0.14
      const tex = getLabelTexture(String(r + 1), 700, 74)
      const pL = piecePoint(piece, sector.f0, d)
      const pR = piecePoint(piece, sector.f1, d)
      items.push(
        { key: `l-${r}`, pos: [pL.x, y, pL.z], tex },
        { key: `r-${r}`, pos: [pR.x, y, pR.z], tex },
      )
    }
    return items
  }, [piece, sector.f0, sector.f1, tier])

  const pitchCue = useMemo(() => {
    const d = sector.tierId === 'lower' ? -1.6 : tier.d0 - 0.55
    const y =
      sector.tierId === 'lower'
        ? 0.35
        : sector.tierId === 'middle'
          ? CONCOURSE1_H + 0.15
          : CONCOURSE2_H + 0.15
    const p = piecePoint(piece, (sector.f0 + sector.f1) / 2, d)
    return {
      pos: [p.x, y, p.z] as [number, number, number],
      tex: getLabelTexture('▼ CAMPO', 700, 56),
    }
  }, [piece, sector.f0, sector.f1, sector.tierId, tier.d0])

  return (
    <group>
      <Line points={outlinePts} color="#d9ff3f" lineWidth={1.8} transparent opacity={0.85} />
      {rowMarkers.map((m) => (
        <group key={m.key} position={m.pos} rotation={[0, camYaw, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
            <planeGeometry args={[1.25, 0.65]} />
            <meshBasicMaterial map={m.tex} color="#a3acb9" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group position={pitchCue.pos} rotation={[0, camYaw, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
          <planeGeometry args={[4.4, 2.2]} />
          <meshBasicMaterial map={pitchCue.tex} color="#a3acb9" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Individual interactive 3D seats for the selected sector during Stage 2 ('sector'). */
export function InteractiveSectorSeats() {
  const stage = useStadiumStore((s) => s.stage)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const hoveredSeatId = useStadiumStore((s) => s.hoveredSeatId)
  const selectSeat = useStadiumStore((s) => s.selectSeat)
  const enterView = useStadiumStore((s) => s.enterView)
  const setHoveredSeat = useStadiumStore((s) => s.setHoveredSeat)
  const setTooltip = useStadiumStore((s) => s.setTooltip)

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const hitMeshRef = useRef<THREE.InstancedMesh>(null)
  const downPos = useRef<{ x: number; y: number } | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const geometry = useMemo(createSeatGeometry, [])
  const hitGeometry = useMemo(() => {
    const g = new THREE.BoxGeometry(0.51, 0.85, 0.78)
    g.translate(0, 0.44, 0)
    g.computeBoundingSphere()
    return g
  }, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0.06 }),
    [],
  )
  const hitMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  )

  const active = stage === 'sector' && Boolean(selectedSectorId)
  const sector = selectedSectorId ? SECTOR_BY_ID[selectedSectorId] : null
  const seats = useMemo(
    () => (active && selectedSectorId ? getSectorSeats(selectedSectorId) : []),
    [active, selectedSectorId],
  )

  useEffect(() => {
    if (!active) {
      document.body.style.cursor = 'auto'
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
    return () => {
      document.body.style.cursor = 'auto'
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [active])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const hitMesh = hitMeshRef.current
    if (!mesh || !seats.length) return
    const m = new THREE.Matrix4()
    const hitM = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const unitScale = new THREE.Vector3(1, 1, 1)

    seats.forEach((seat, i) => {
      const isSelected = seat.id === selectedSeatId
      const isHovered = seat.id === hoveredSeatId && seat.available
      const sc = isSelected ? 1.22 : isHovered ? 1.15 : 1.0
      q.setFromAxisAngle(up, seat.rotY)
      p.set(seat.x, seat.y, seat.z)
      scale.set(sc, sc, sc)
      m.compose(p, q, scale)
      mesh.setMatrixAt(i, m)

      if (hitMesh) {
        hitM.compose(p, q, unitScale)
        hitMesh.setMatrixAt(i, hitM)
      }

      if (isSelected) mesh.setColorAt(i, COL_SELECTED)
      else if (isHovered) mesh.setColorAt(i, COL_HOVERED)
      else if (seat.available) mesh.setColorAt(i, COL_AVAILABLE)
      else mesh.setColorAt(i, COL_TAKEN)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()

    if (hitMesh) {
      hitMesh.instanceMatrix.needsUpdate = true
      hitMesh.computeBoundingSphere()
      hitMesh.computeBoundingBox()
    }
  }, [seats, selectedSeatId, hoveredSeatId])

  if (!active || !sector) return null

  const category = sectorCategory(sector)
  const selectedSeat = selectedSeatId ? seats.find((s) => s.id === selectedSeatId) : undefined

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    downPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.pointerType === 'touch') return
    if (e.instanceId === undefined) return
    const seat = seats[e.instanceId]
    if (!seat) return
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setHoveredSeat(seat.id)
    document.body.style.cursor = seat.available ? 'pointer' : 'not-allowed'
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      title: `Fileira ${seat.row} · Assento ${seat.number}`,
      subtitle: seat.available
        ? `Disponível · ${category.label}`
        : 'Ocupado',
      tone: seat.available ? 'default' : 'muted',
    })
  }

  const handleOut = () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setHoveredSeat(null)
    setTooltip(null)
    document.body.style.cursor = 'auto'
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (downPos.current) {
      const moved = Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
      if (moved > 6) return
    }
    if (e.instanceId === undefined) return
    const seat = seats[e.instanceId]
    if (!seat) return
    if (seat.available) {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
      selectSeat(seat.id)
      enterView()
      return
    }
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      title: `Fileira ${seat.row} · Assento ${seat.number}`,
      subtitle: 'Assento ocupado',
      tone: 'muted',
    })
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setTooltip(null)
      toastTimerRef.current = null
    }, 1800)
  }

  return (
    <group>
      <instancedMesh
        key={sector.id}
        ref={meshRef}
        args={[geometry, material, seats.length]}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      <instancedMesh
        key={`${sector.id}-hit`}
        ref={hitMeshRef}
        args={[hitGeometry, hitMaterial, seats.length]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
      />
      <SectorGuides sectorId={sector.id} />
      {selectedSeat && <SelectedHalo x={selectedSeat.x} y={selectedSeat.y} z={selectedSeat.z} />}
    </group>
  )
}
