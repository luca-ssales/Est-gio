export type Stage = 'map' | 'sector' | 'view'

export type MapView = 'overview' | 'top'

export type LightingMode = 'day' | 'dusk' | 'night'

export type TierId = 'lower' | 'middle' | 'upper'

export type Zone = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

/** Position of a piece of the bowl relative to the pitch. */
export type SideKind = 'goal' | 'side' | 'corner'

export type CategoryId = 'cat1' | 'cat2' | 'cat3'

export interface Category {
  id: CategoryId
  label: string
  color: string
}

export interface TierConfig {
  id: TierId
  name: string
  short: string
  /** Horizontal offset (m) of the first riser from the bowl's inner boundary. */
  d0: number
  rows: number
  rowDepth: number
  rise: number
  /** Height (m) of the first tread above the pitch. */
  h0: number
  numberBase: number
  sectorsPer: { goal: number; side: number; corner: number }
}

/** A piece of the rounded-rectangle bowl path (straight or quarter arc). */
export interface Piece {
  index: number
  kind: 'straight' | 'arc'
  zone: Zone
  side: SideKind
  // straight
  sx: number
  sz: number
  ex: number
  ez: number
  nx: number
  nz: number
  // arc
  cx: number
  cz: number
  a0: number
  a1: number
}

export interface Sector {
  id: string
  number: number
  tierId: TierId
  pieceIndex: number
  f0: number
  f1: number
  zone: Zone
  side: SideKind
  categoryId: CategoryId
  available: boolean
}

export interface Seat {
  id: string
  sectorId: string
  row: number
  number: number
  x: number
  y: number
  z: number
  /** Y rotation so the seat faces the pitch. */
  rotY: number
  available: boolean
}

export interface SeatMetrics {
  toCenter: number
  toGoal: number
  height: number
}
