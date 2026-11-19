import type { CategoryId, Sector, TierId } from '../types'
import { CATEGORIES, PIECES, SIDE_NAMES, TIERS, TIER_BY_ID, ZONE_NAMES } from './stadium'

/** Sectors that are sold out in this simulated event. */
const SOLD_OUT = new Set(['109', '110', '125', '211', '228', '304', '319'])

function categoryFor(tier: TierId): CategoryId {
  if (tier === 'lower') return 'cat1'
  if (tier === 'middle') return 'cat2'
  return 'cat3'
}

function buildSectors(): Sector[] {
  const list: Sector[] = []
  for (const tier of TIERS) {
    let n = tier.numberBase + 1
    for (const piece of PIECES) {
      const count = tier.sectorsPer[piece.side]
      for (let k = 0; k < count; k++) {
        const id = String(n)
        list.push({
          id,
          number: n,
          tierId: tier.id,
          pieceIndex: piece.index,
          f0: k / count,
          f1: (k + 1) / count,
          zone: piece.zone,
          side: piece.side,
          categoryId: categoryFor(tier.id),
          available: !SOLD_OUT.has(id),
        })
        n++
      }
    }
  }
  return list
}

export const SECTORS: Sector[] = buildSectors()
export const SECTOR_BY_ID: Record<string, Sector> = Object.fromEntries(SECTORS.map((s) => [s.id, s]))

export function sectorLabel(s: Sector) {
  return `${TIER_BY_ID[s.tierId].short} · ${ZONE_NAMES[s.zone]}`
}

/** e.g. "CANTO 3º ANEL" – short positional label used as an eyebrow. */
export function sectorPositionLabel(s: Sector) {
  return `${SIDE_NAMES[s.side]} · ${TIER_BY_ID[s.tierId].short.toLowerCase()}`
}

export function sectorCategory(s: Sector) {
  return CATEGORIES[s.categoryId]
}
