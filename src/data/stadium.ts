import type { Piece, TierConfig, Zone, SideKind, Category, CategoryId } from '../types'

/** Official pitch (FIFA recommended) in metres. Length runs along Z (north = -Z). */
export const PITCH = { length: 105, width: 68 }

/** Inner boundary of the bowl: rounded rectangle around the pitch. */
export const BOWL = { halfX: 42, halfZ: 60, radius: 16 }

export const SEAT_WIDTH = 0.52
export const AISLE = 1.3
/** Eye height of a seated spectator above the tread. */
export const EYE_HEIGHT = 1.18

export const CONCOURSE1_H = 9.2
export const CONCOURSE2_H = 21.6

export const TIERS: TierConfig[] = [
  {
    id: 'lower',
    name: '1º Anel · Inferior',
    short: '1º Anel',
    d0: 0,
    rows: 16,
    rowDepth: 0.78,
    rise: 0.38,
    h0: 1.3,
    numberBase: 100,
    sectorsPer: { goal: 4, side: 6, corner: 2 },
  },
  {
    id: 'middle',
    name: '2º Anel · Intermediário',
    short: '2º Anel',
    d0: 13.6,
    rows: 18,
    rowDepth: 0.8,
    rise: 0.48,
    h0: 11.2,
    numberBase: 200,
    sectorsPer: { goal: 4, side: 6, corner: 3 },
  },
  {
    id: 'upper',
    name: '3º Anel · Superior',
    short: '3º Anel',
    d0: 29.2,
    rows: 20,
    rowDepth: 0.82,
    rise: 0.56,
    h0: 23.6,
    numberBase: 300,
    sectorsPer: { goal: 4, side: 6, corner: 3 },
  },
]

export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<
  TierConfig['id'],
  TierConfig
>

export const tierBackD = (t: TierConfig) => t.d0 + t.rows * t.rowDepth
export const tierTopH = (t: TierConfig) => t.h0 + t.rows * t.rise

export const ROOF = {
  dInner: 34,
  dOuter: 54,
  yInnerBottom: 42.5,
  yInnerTop: 43.8,
  yOuterBottom: 44.6,
  yOuterTop: 46.0,
}

export const CATEGORIES: Record<CategoryId, Category> = {
  cat1: { id: 'cat1', label: 'Categoria 1', color: '#d9ff3f' },
  cat2: { id: 'cat2', label: 'Categoria 2', color: '#9fb4ff' },
  cat3: { id: 'cat3', label: 'Categoria 3', color: '#ffb36b' },
}

export const MATCH = {
  home: 'Aurora FC',
  away: 'Atlético Norte',
  homeShort: 'AUR',
  awayShort: 'ATN',
  stage: 'Final',
  date: 'Sáb 23 Mai',
  time: '20:45',
  venue: 'Arena Tech',
}

export const ZONE_NAMES: Record<Zone, string> = {
  N: 'Atrás do gol norte',
  NE: 'Canto nordeste',
  E: 'Lateral leste',
  SE: 'Canto sudeste',
  S: 'Atrás do gol sul',
  SW: 'Canto sudoeste',
  W: 'Lateral oeste',
  NW: 'Canto noroeste',
}

export const SIDE_NAMES: Record<SideKind, string> = {
  goal: 'Atrás do gol',
  side: 'Lateral',
  corner: 'Canto',
}

/** Builds the 8 pieces of the bowl path, clockwise seen from above, starting at the north side. */
function buildPieces(): Piece[] {
  const { halfX: HX, halfZ: HZ, radius: R } = BOWL
  const base = { sx: 0, sz: 0, ex: 0, ez: 0, nx: 0, nz: 0, cx: 0, cz: 0, a0: 0, a1: 0 }
  const s = (zone: Zone, side: SideKind, sx: number, sz: number, ex: number, ez: number, nx: number, nz: number) => ({
    ...base,
    kind: 'straight' as const,
    zone,
    side,
    sx,
    sz,
    ex,
    ez,
    nx,
    nz,
  })
  const a = (zone: Zone, cx: number, cz: number, a0: number, a1: number) => ({
    ...base,
    kind: 'arc' as const,
    zone,
    side: 'corner' as const,
    cx,
    cz,
    a0,
    a1,
  })
  const P = Math.PI
  const list = [
    s('N', 'goal', -(HX - R), -HZ, HX - R, -HZ, 0, -1),
    a('NE', HX - R, -(HZ - R), -P / 2, 0),
    s('E', 'side', HX, -(HZ - R), HX, HZ - R, 1, 0),
    a('SE', HX - R, HZ - R, 0, P / 2),
    s('S', 'goal', HX - R, HZ, -(HX - R), HZ, 0, 1),
    a('SW', -(HX - R), HZ - R, P / 2, P),
    s('W', 'side', -HX, HZ - R, -HX, -(HZ - R), -1, 0),
    a('NW', -(HX - R), -(HZ - R), P, (3 * P) / 2),
  ]
  return list.map((p, index) => ({ ...p, index }))
}

export const PIECES: Piece[] = buildPieces()

export interface PathPoint {
  x: number
  z: number
  nx: number
  nz: number
}

/** Point on the bowl path at fraction f of the piece, offset outwards by d metres. */
export function piecePoint(p: Piece, f: number, d: number): PathPoint {
  if (p.kind === 'straight') {
    return {
      x: p.sx + (p.ex - p.sx) * f + p.nx * d,
      z: p.sz + (p.ez - p.sz) * f + p.nz * d,
      nx: p.nx,
      nz: p.nz,
    }
  }
  const a = p.a0 + (p.a1 - p.a0) * f
  const r = BOWL.radius + d
  const nx = Math.cos(a)
  const nz = Math.sin(a)
  return { x: p.cx + nx * r, z: p.cz + nz * r, nx, nz }
}

export function pieceLength(p: Piece, d: number): number {
  if (p.kind === 'straight') return Math.hypot(p.ex - p.sx, p.ez - p.sz)
  return Math.abs(p.a1 - p.a0) * (BOWL.radius + d)
}

/** Samples of f used to sweep geometry along a piece. */
export function pieceSamples(p: Piece, arcSegments = 28): number[] {
  const n = p.kind === 'straight' ? 1 : arcSegments
  return Array.from({ length: n + 1 }, (_, i) => i / n)
}

/** Height of the tread at a given horizontal offset inside a tier (continuous approximation). */
export function tierSurfaceHeight(t: TierConfig, d: number) {
  return t.h0 + ((d - t.d0) / t.rowDepth) * t.rise
}
