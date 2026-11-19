import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SECTORS, SECTOR_BY_ID } from '../../data/sectors'
import { getSectorSeats } from '../../data/seats'
import { useStadiumStore } from '../../store/useStadiumStore'
import { hashString, mulberry32 } from '../../lib/random'
import { createSeatGeometry } from './seatGeometry'

const COL_CRIMSON = new THREE.Color('#c9253c')
const COL_VIP = new THREE.Color('#162a5c')
const COL_VIP_TRIM = new THREE.Color('#dbe4f2')
const COL_NAVY_BAND = new THREE.Color('#173170')
const COL_MOSAIC_WHITE = new THREE.Color('#f4f6fa')
const COL_LIME = new THREE.Color('#d9ff3f')

const BITMAP_FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

const MOSAIC_TEXT = 'ARENA TECH'
const MOSAIC_COLS = MOSAIC_TEXT.length * 6 - 1

function isMosaicLit(row: number, u: number): boolean {
  if (row < 5 || row > 18 || u < 0 || u >= 1) return false
  const br = 6 - Math.floor((row - 5) / 2)
  const col = Math.floor(u * MOSAIC_COLS)
  const charIdx = Math.floor(col / 6)
  const localCol = col % 6
  if (localCol === 5) return false
  const ch = MOSAIC_TEXT[charIdx]
  const glyph = BITMAP_FONT[ch]
  return glyph ? glyph[br]?.[localCol] === '1' : false
}

const SectorSeatMesh = memo(function SectorSeatMesh({
  sectorId,
  geometry,
  material,
}: {
  sectorId: string
  geometry: THREE.BufferGeometry
  material: THREE.Material
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const sector = SECTOR_BY_ID[sectorId]
  const seats = useMemo(() => getSectorSeats(sectorId), [sectorId])
  const hidden = useStadiumStore((s) => s.stage === 'sector' && s.selectedSectorId === sectorId)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const s = new THREE.Vector3(1, 1, 1)
    const c = new THREE.Color()
    const rand = mulberry32(hashString(sectorId) ^ 0x9e37)

    const isVip = sector.tierId === 'lower' && sector.side === 'side'
    const isMiddleSide = sector.tierId === 'middle' && sector.side === 'side'
    const isUpperSide = sector.tierId === 'upper' && sector.side === 'side'
    const isUpperGoal = sector.tierId === 'upper' && sector.side === 'goal'
    const isEast = sector.zone === 'E'

    seats.forEach((seat, i) => {
      q.setFromAxisAngle(up, seat.rotY)
      p.set(seat.x, seat.y, seat.z)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)

      const v = 0.88 + rand() * 0.2
      if (isVip) {
        c.copy(seat.row === 1 || seat.row === 16 ? COL_VIP_TRIM : COL_VIP).multiplyScalar(v)
      } else if (isUpperSide) {
        const u = isEast ? (seat.z + 34) / 68 : (34 - seat.z) / 68
        if (seat.row === 3 && Math.abs(seat.z) <= 34) {
          c.copy(COL_LIME).multiplyScalar(0.95)
        } else if (isMosaicLit(seat.row, u)) {
          c.copy(COL_MOSAIC_WHITE).multiplyScalar(0.94 + rand() * 0.08)
        } else {
          c.copy(COL_CRIMSON).multiplyScalar(v)
        }
      } else if (isMiddleSide) {
        if (seat.row === 9) c.copy(COL_MOSAIC_WHITE).multiplyScalar(v)
        else if (seat.row === 10) c.copy(COL_LIME).multiplyScalar(0.92)
        else c.copy(COL_CRIMSON).multiplyScalar(v)
      } else if (isUpperGoal) {
        if (seat.row === 10) c.copy(COL_MOSAIC_WHITE).multiplyScalar(0.95)
        else if (seat.row >= 8 && seat.row <= 12) c.copy(COL_NAVY_BAND).multiplyScalar(v)
        else c.copy(COL_CRIMSON).multiplyScalar(v)
      } else {
        c.copy(COL_CRIMSON).multiplyScalar(v)
      }
      mesh.setColorAt(i, c)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }, [seats, sectorId, sector])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, seats.length]}
      visible={!hidden}
      receiveShadow
      raycast={() => null}
    />
  )
})

/** Every seat of the stadium across all 3 tiers, rendered with one InstancedMesh per sector. */
export function StadiumSeats() {
  const geometry = useMemo(createSeatGeometry, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.05 }),
    [],
  )
  return (
    <group>
      {SECTORS.map((s) => (
        <SectorSeatMesh key={s.id} sectorId={s.id} geometry={geometry} material={material} />
      ))}
    </group>
  )
}
