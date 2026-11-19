import { useEffect, useId, useMemo, useRef } from 'react'
import type { Seat } from '../../types'
import { PIECES, PITCH, TIER_BY_ID, piecePoint, tierBackD } from '../../data/stadium'
import { SECTORS } from '../../data/sectors'
import { subscribeCameraTelemetry } from '../../three/StadiumCamera/cameraTelemetry'

function buildSectorPath(sectorId: string) {
  const sector = SECTORS.find((s) => s.id === sectorId)!
  const tier = TIER_BY_ID[sector.tierId]
  const piece = PIECES[sector.pieceIndex]
  const d0 = tier.d0 + 0.5
  const d1 = tierBackD(tier) - 0.5
  const steps = piece.kind === 'arc' ? 6 : 1
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const f = sector.f0 + ((sector.f1 - sector.f0) * i) / steps
    const p = piecePoint(piece, f, d0)
    pts.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`)
  }
  for (let i = steps; i >= 0; i--) {
    const f = sector.f0 + ((sector.f1 - sector.f0) * i) / steps
    const p = piecePoint(piece, f, d1)
    pts.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

const CONE_RADIUS = 92

export function buildConePath(sx: number, sz: number, dirX: number, dirZ: number, hFov: number) {
  const ang = Math.atan2(dirZ, dirX)
  const half = Math.min(1.05, Math.max(0.16, hFov / 2))
  const a1 = ang - half
  const a2 = ang + half
  const x1 = sx + Math.cos(a1) * CONE_RADIUS
  const y1 = sz + Math.sin(a1) * CONE_RADIUS
  const x2 = sx + Math.cos(a2) * CONE_RADIUS
  const y2 = sz + Math.sin(a2) * CONE_RADIUS
  return `M ${sx.toFixed(1)} ${sz.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${CONE_RADIUS} ${CONE_RADIUS} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

export function MiniStadiumMap({ sectorId, seat }: { sectorId: string; seat: Seat }) {
  const uid = useId().replace(/:/g, '')
  const clipId = `bowl-clip-${uid}`
  const gradId = `cone-grad-${uid}`
  const coneRef = useRef<SVGPathElement>(null)

  const paths = useMemo(
    () =>
      SECTORS.map((s) => ({
        id: s.id,
        available: s.available,
        d: buildSectorPath(s.id),
      })),
    [],
  )

  const initialCone = useMemo(() => {
    const len = Math.hypot(-seat.x, -seat.z) || 1
    return buildConePath(seat.x, seat.z, -seat.x / len, -seat.z / len, 1.0)
  }, [seat.x, seat.z])

  useEffect(() => {
    return subscribeCameraTelemetry((t) => {
      coneRef.current?.setAttribute('d', buildConePath(seat.x, seat.z, t.dirX, t.dirZ, t.hFov))
    })
  }, [seat.x, seat.z])

  return (
    <svg
      viewBox="-100 -118 200 236"
      className="h-[88px] w-[74px] shrink-0"
      aria-label={`Posição no estádio: Setor ${sectorId}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="-96" y="-114" width="192" height="228" rx="54" />
        </clipPath>
        <radialGradient
          id={gradId}
          cx={seat.x}
          cy={seat.z}
          r={CONE_RADIUS}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#d9ff3f" stopOpacity="0.46" />
          <stop offset="100%" stopColor="#d9ff3f" stopOpacity="0.02" />
        </radialGradient>
      </defs>

      <rect x="-96" y="-114" width="192" height="228" rx="54" fill="#0c0e13" stroke="#242933" strokeWidth="1.5" />
      <rect
        x={-PITCH.width / 2}
        y={-PITCH.length / 2}
        width={PITCH.width}
        height={PITCH.length}
        fill="#133d1b"
        stroke="#5fa86b"
        strokeWidth="1.1"
      />
      <line x1={-PITCH.width / 2} y1={0} x2={PITCH.width / 2} y2={0} stroke="#5fa86b" strokeWidth="1" />
      <circle cx={0} cy={0} r={9.15} fill="none" stroke="#5fa86b" strokeWidth="1" />
      <rect x={-20.16} y={-PITCH.length / 2} width={40.32} height={16.5} fill="none" stroke="#5fa86b" strokeWidth="0.9" />
      <rect x={-20.16} y={PITCH.length / 2 - 16.5} width={40.32} height={16.5} fill="none" stroke="#5fa86b" strokeWidth="0.9" />

      {paths.map((p) => {
        const active = p.id === sectorId
        return (
          <path
            key={p.id}
            d={p.d}
            fill={active ? '#d9ff3f' : p.available ? '#303642' : '#14171d'}
            stroke="#090a0d"
            strokeWidth="0.8"
          />
        )
      })}

      <path
        ref={coneRef}
        d={initialCone}
        clipPath={`url(#${clipId})`}
        fill={`url(#${gradId})`}
        stroke="rgba(217, 255, 63, 0.55)"
        strokeWidth="0.9"
      />

      <circle cx={seat.x} cy={seat.z} r="4.4" fill="#090a0d" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
  )
}
