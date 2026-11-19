import type { Seat, SeatMetrics, Sector } from '../types'
import { AISLE, EYE_HEIGHT, PIECES, PITCH, SEAT_WIDTH, TIER_BY_ID, pieceLength, piecePoint } from './stadium'
import { SECTORS, SECTOR_BY_ID } from './sectors'
import { hashString, mulberry32 } from '../lib/random'

const cache = new Map<string, Seat[]>()

/** Generates (and memoises) every seat of a sector with its real 3D coordinates. */
export function getSectorSeats(sectorId: string): Seat[] {
  const cached = cache.get(sectorId)
  if (cached) return cached
  const sector = SECTOR_BY_ID[sectorId]
  const seats = buildSeats(sector)
  cache.set(sectorId, seats)
  return seats
}

function buildSeats(sector: Sector): Seat[] {
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const rand = mulberry32(hashString(sector.id))
  const phaseA = rand() * 10
  const phaseB = rand() * 10
  // demand depends on category: cheaper seats sell faster
  const demand = sector.categoryId === 'cat1' ? 0.42 : sector.categoryId === 'cat2' ? 0.36 : 0.48
  const seats: Seat[] = []
  for (let r = 0; r < tier.rows; r++) {
    const d = tier.d0 + r * tier.rowDepth + tier.rowDepth * 0.58
    const y = tier.h0 + r * tier.rise
    const L = pieceLength(piece, d)
    const span = L * (sector.f1 - sector.f0)
    const usable = span - AISLE
    const n = Math.max(0, Math.floor(usable / SEAT_WIDTH))
    const offset = AISLE / 2 + (usable - n * SEAT_WIDTH) / 2
    for (let i = 0; i < n; i++) {
      const s = offset + (i + 0.5) * SEAT_WIDTH
      const f = sector.f0 + s / L
      const p = piecePoint(piece, f, d)
      // clustered availability: smooth "groups" plus noise
      const cluster = Math.sin(r * 0.55 + phaseA) * Math.cos(i * 0.32 + phaseB)
      const taken = cluster * 0.35 + rand() * 0.9 < demand
      seats.push({
        id: `${sector.id}-${r + 1}-${i + 1}`,
        sectorId: sector.id,
        row: r + 1,
        number: i + 1,
        x: p.x,
        y,
        z: p.z,
        rotY: Math.atan2(-p.nx, -p.nz),
        available: sector.available && !taken,
      })
    }
  }
  return seats
}

export function getSeat(seatId: string): Seat | undefined {
  const sectorId = seatId.split('-')[0]
  return getSectorSeats(sectorId).find((s) => s.id === seatId)
}

export function sectorStats(sectorId: string) {
  const seats = getSectorSeats(sectorId)
  const free = seats.reduce((acc, s) => acc + (s.available ? 1 : 0), 0)
  return { total: seats.length, free }
}

export function totalSeatCount() {
  return SECTORS.reduce((acc, s) => acc + getSectorSeats(s.id).length, 0)
}

/** Approximate distances (m) from the seated eye position. */
export function seatMetrics(seat: Seat): SeatMetrics {
  const eyeY = seat.y + EYE_HEIGHT
  const goalZ = Math.sign(seat.z || 1) * (PITCH.length / 2)
  return {
    toCenter: Math.hypot(seat.x, eyeY, seat.z),
    toGoal: Math.hypot(seat.x, eyeY, seat.z - goalZ),
    height: eyeY,
  }
}
