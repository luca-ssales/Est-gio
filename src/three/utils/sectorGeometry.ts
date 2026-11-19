import * as THREE from 'three'
import type { Sector } from '../../types'
import { PIECES, TIER_BY_ID, pieceLength, piecePoint, pieceSamples, tierBackD, tierSurfaceHeight, tierTopH } from '../../data/stadium'
import { bowlOutline } from './geometry'

export interface SectorAnchor {
  center: THREE.Vector3
  /** horizontal outward normal at the sector centre */
  normal: THREE.Vector3
  width: number
  depth: number
}

const anchorCache = new Map<string, SectorAnchor>()

export function sectorAnchor(sector: Sector): SectorAnchor {
  const hit = anchorCache.get(sector.id)
  if (hit) return hit
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const dFront = tier.d0
  const dBack = tierBackD(tier)
  const dMid = (dFront + dBack) / 2
  const p = piecePoint(piece, (sector.f0 + sector.f1) / 2, dMid)
  const anchor: SectorAnchor = {
    center: new THREE.Vector3(p.x, tierSurfaceHeight(tier, dMid) + 0.5, p.z),
    normal: new THREE.Vector3(p.nx, 0, p.nz),
    width: pieceLength(piece, dBack) * (sector.f1 - sector.f0),
    depth: dBack - dFront,
  }
  anchorCache.set(sector.id, anchor)
  return anchor
}

function fRange(sector: Sector, d: number, gap: number) {
  const piece = PIECES[sector.pieceIndex]
  const m = gap / 2 / pieceLength(piece, d)
  return [sector.f0 + m, sector.f1 - m] as const
}

/** Sloped surface covering a sector – used as the interactive tile in the map. */
export function sectorTileGeometry(sector: Sector, gap = 1.8, lift = 1.05): THREE.BufferGeometry {
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const ds = [tier.d0 + 0.1, tierBackD(tier) - 0.1]
  const cols = piece.kind === 'arc' ? 10 : 1
  const pos: number[] = []
  const idx: number[] = []
  ds.forEach((d) => {
    const [a, b] = fRange(sector, d, gap)
    const y = tierSurfaceHeight(tier, d) + lift
    for (let i = 0; i <= cols; i++) {
      const p = piecePoint(piece, a + ((b - a) * i) / cols, d)
      pos.push(p.x, y, p.z)
    }
  })
  const row = cols + 1
  for (let i = 0; i < cols; i++) idx.push(i, i + 1, i + row, i + 1, i + 1 + row, i + row)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Closed outline (front edge, side, back edge, side) of a sector. */
export function sectorOutline(sector: Sector, lift = 1.2, gap = 0.6): THREE.Vector3[] {
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const dF = tier.d0 - 0.05
  const dB = tierBackD(tier) + 0.05
  const edge = (d: number, reverse: boolean) => {
    const [a, b] = fRange(sector, d, gap)
    const fs = pieceSamples(piece, 16).map((t) => a + (b - a) * t)
    if (reverse) fs.reverse()
    const y = tierSurfaceHeight(tier, d) + lift
    return fs.map((f) => {
      const p = piecePoint(piece, f, d)
      return new THREE.Vector3(p.x, y, p.z)
    })
  }
  const front = edge(dF, false)
  const back = edge(dB, true)
  return [...front, ...back, front[0].clone()]
}

/** Invisible extruded stadium hull used in 'overview' map mode so clicking anywhere on the arena enters overhead sector view. */
export function createOverviewHitGeometry(): THREE.BufferGeometry {
  const shapePts = bowlOutline(tierBackD(TIER_BY_ID.upper) + 9.2, 24).map(
    ([x, z]) => new THREE.Vector2(x, -z),
  )
  const shape = new THREE.Shape(shapePts)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: tierTopH(TIER_BY_ID.upper) + 5.2,
    bevelEnabled: false,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -0.2, 0)
  g.computeBoundingSphere()
  return g
}
