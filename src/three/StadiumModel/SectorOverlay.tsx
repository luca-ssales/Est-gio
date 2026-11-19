import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sector } from '../../types'
import { TIER_BY_ID, tierBackD, tierSurfaceHeight } from '../../data/stadium'
import { SECTORS, sectorCategory, sectorLabel } from '../../data/sectors'
import { sectorStats } from '../../data/seats'
import { getLabelTexture } from '../../lib/textures'
import { useStadiumStore } from '../../store/useStadiumStore'
import { createOverviewHitGeometry, sectorAnchor, sectorOutline, sectorTileGeometry } from '../utils/sectorGeometry'

const COMPASS: { text: string; pos: [number, number, number]; rotZ?: number }[] = [
  { text: 'NORTE', pos: [0, 1.5, -124], rotZ: 0 },
  { text: 'SUL', pos: [0, 1.5, 124], rotZ: 0 },
  { text: 'LESTE', pos: [106, 1.5, 0], rotZ: -Math.PI / 2 },
  { text: 'OESTE', pos: [-106, 1.5, 0], rotZ: Math.PI / 2 },
]

const SectorTile = memo(function SectorTile({
  sector,
  interactive,
  isHovered,
  isSelected,
  isDimmed,
  onDown,
  onHover,
  onOut,
  onPick,
}: {
  sector: Sector
  interactive: boolean
  isHovered: boolean
  isSelected: boolean
  isDimmed: boolean
  onDown: (e: ThreeEvent<PointerEvent>) => void
  onHover: (sector: Sector, e: ThreeEvent<PointerEvent>) => void
  onOut: (sector: Sector) => void
  onPick: (sector: Sector, e: ThreeEvent<MouseEvent>) => void
}) {
  const tileGeo = useMemo(() => sectorTileGeometry(sector, 1.5, 1.05), [sector])
  const outlinePts = useMemo(() => sectorOutline(sector, 1.25, 0.5), [sector])
  const labelTex = useMemo(() => getLabelTexture(String(sector.number), 700), [sector.number])
  const anchor = useMemo(() => sectorAnchor(sector), [sector])
  const tier = TIER_BY_ID[sector.tierId]
  const dMid = (tier.d0 + tierBackD(tier)) / 2
  const slope = Math.atan2(tier.rise, tier.rowDepth)
  const yaw = Math.atan2(-anchor.normal.x, -anchor.normal.z)
  const flipSouth = anchor.normal.z > 0.35 ? Math.PI : 0
  const tileY = tierSurfaceHeight(tier, dMid) + 1.05
  const labelSize: [number, number] =
    sector.tierId === 'upper'
      ? [8.8, 4.4]
      : sector.tierId === 'middle'
        ? [7.8, 3.9]
        : [6.8, 3.4]

  let color = '#c9253c'
  let opacity = 0.04
  let emissive = '#000000'
  let emissiveIntensity = 0
  let labelColor = '#f4f6fa'
  let outlineColor = '#d9ff3f'

  if (isHovered) {
    color = '#ff8c1a'
    opacity = 0.72
    emissive = '#ff8c1a'
    emissiveIntensity = 0.35
    labelColor = '#090a0d'
    outlineColor = '#ffd180'
  } else if (isSelected) {
    color = '#d9ff3f'
    opacity = 0.68
    emissive = '#d9ff3f'
    emissiveIntensity = 0.22
    labelColor = '#090a0d'
    outlineColor = '#d9ff3f'
  } else if (!sector.available) {
    color = '#0b0e16'
    opacity = 0.76
    labelColor = '#6b7280'
  } else if (isDimmed) {
    color = '#10141d'
    opacity = 0.68
    labelColor = '#525a69'
  }

  return (
    <group>
      <mesh
        geometry={tileGeo}
        onPointerDown={interactive ? onDown : undefined}
        onPointerMove={interactive ? (e) => onHover(sector, e) : undefined}
        onPointerOut={interactive ? () => onOut(sector) : undefined}
        onClick={interactive ? (e) => onPick(sector, e) : undefined}
      >
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <group
        position={[
          anchor.center.x - anchor.normal.x * 0.16,
          tileY + 0.28,
          anchor.center.z - anchor.normal.z * 0.16,
        ]}
        rotation={[0, yaw, 0]}
      >
        <mesh rotation={[-Math.PI / 2 + slope, 0, flipSouth]} raycast={() => null} renderOrder={3}>
          <planeGeometry args={labelSize} />
          <meshBasicMaterial
            map={labelTex}
            color={labelColor}
            transparent
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {(isHovered || isSelected) && (
        <Line points={outlinePts} color={outlineColor} lineWidth={2.2} transparent opacity={0.95} />
      )}
    </group>
  )
})

/** Interactive 3-tier sector map overlay + compass markers shown during Stage 1 ('map'). */
export function SectorOverlay() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const mapView = useStadiumStore((s) => s.mapView)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const hoveredSectorId = useStadiumStore((s) => s.hoveredSectorId)
  const categoryFilter = useStadiumStore((s) => s.categoryFilter)
  const lightingMode = useStadiumStore((s) => s.lightingMode)
  const enterTopMap = useStadiumStore((s) => s.enterTopMap)
  const selectSector = useStadiumStore((s) => s.selectSector)
  const setHoveredSector = useStadiumStore((s) => s.setHoveredSector)
  const setTooltip = useStadiumStore((s) => s.setTooltip)

  const downPos = useRef<{ x: number; y: number } | null>(null)
  const enteredTopAtRef = useRef(0)
  const overviewHitGeo = useMemo(createOverviewHitGeometry, [])
  const compassTextures = useMemo(
    () => COMPASS.map((c) => ({ ...c, tex: getLabelTexture(c.text, 700, 62) })),
    [],
  )

  useEffect(() => {
    return () => {
      overviewHitGeo.dispose()
    }
  }, [overviewHitGeo])

  useEffect(() => {
    document.body.style.cursor = 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [stage, mapView])

  const handleDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    downPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleOverviewHover = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (e.pointerType === 'touch') return
      if (useStadiumStore.getState().transitioning) return
      document.body.style.cursor = 'pointer'
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        title: 'Arena Tech',
        subtitle: 'Clique para escolher um setor',
      })
    },
    [setTooltip],
  )

  const handleOverviewOut = useCallback(() => {
    setTooltip(null)
    document.body.style.cursor = 'auto'
  }, [setTooltip])

  const handleOverviewClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (downPos.current) {
        const moved = Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
        if (moved > 6) return
      }
      if (useStadiumStore.getState().transitioning) return
      setTooltip(null)
      document.body.style.cursor = 'auto'
      enteredTopAtRef.current = performance.now()
      enterTopMap()
    },
    [enterTopMap, setTooltip],
  )

  const handleHover = useCallback(
    (sector: Sector, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (e.pointerType === 'touch') return
      if (performance.now() - enteredTopAtRef.current < 350) return
      const category = sectorCategory(sector)
      const { free } = sectorStats(sector.id)
      setHoveredSector(sector.id)
      document.body.style.cursor = 'pointer'
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        title: `Setor ${sector.number}`,
        subtitle: sector.available
          ? `${sectorLabel(sector)} · ${category.label} · ${free} livres`
          : `${sectorLabel(sector)} · Esgotado`,
        tone: sector.available ? 'default' : 'muted',
      })
    },
    [setHoveredSector, setTooltip],
  )

  const handleOut = useCallback(
    (sector: Sector) => {
      if (useStadiumStore.getState().hoveredSectorId === sector.id) {
        setHoveredSector(null)
        setTooltip(null)
        document.body.style.cursor = 'auto'
      }
    },
    [setHoveredSector, setTooltip],
  )

  const handlePick = useCallback(
    (sector: Sector, e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (downPos.current) {
        const moved = Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
        if (moved > 6) return
      }
      if (performance.now() - enteredTopAtRef.current < 350) return
      document.body.style.cursor = 'auto'
      selectSector(sector.id)
    },
    [selectSector],
  )

  if (stage !== 'map' || droneTour) return null

  const isTopMap = mapView === 'top'
  const compassColor = lightingMode === 'day' ? '#1e2430' : '#a6b0c0'

  return (
    <group>
      {!isTopMap && (
        <mesh
          geometry={overviewHitGeo}
          onPointerDown={handleDown}
          onPointerMove={handleOverviewHover}
          onPointerOut={handleOverviewOut}
          onClick={handleOverviewClick}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {SECTORS.map((sector) => (
        <SectorTile
          key={sector.id}
          sector={sector}
          interactive={isTopMap}
          isHovered={isTopMap && hoveredSectorId === sector.id}
          isSelected={selectedSectorId === sector.id}
          isDimmed={Boolean(categoryFilter && sector.categoryId !== categoryFilter)}
          onDown={handleDown}
          onHover={handleHover}
          onOut={handleOut}
          onPick={handlePick}
        />
      ))}
      {compassTextures.map((c) => (
        <mesh
          key={c.text}
          position={c.pos}
          rotation={[-Math.PI / 2, 0, c.rotZ ?? 0]}
          raycast={() => null}
        >
          <planeGeometry args={[22, 11]} />
          <meshBasicMaterial map={c.tex} color={compassColor} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
