import { useState } from 'react'
import { ArrowLeftRight, ChevronDown, ChevronUp, Move, RotateCcw } from 'lucide-react'
import { TIER_BY_ID } from '../../data/stadium'
import { SECTOR_BY_ID, sectorCategory, sectorPositionLabel } from '../../data/sectors'
import { getSeat, seatMetrics } from '../../data/seats'
import { useStadiumStore } from '../../store/useStadiumStore'
import { MiniStadiumMap } from './MiniStadiumMap'

export function SeatInfoPanel() {
  const stage = useStadiumStore((s) => s.stage)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const hasLookedAround = useStadiumStore((s) => s.hasLookedAround)
  const transitioning = useStadiumStore((s) => s.transitioning)
  const cleanMode = useStadiumStore((s) => s.cleanMode)
  const viewPanelReady = useStadiumStore((s) => s.viewPanelReady)
  const backToSector = useStadiumStore((s) => s.backToSector)
  const resetView = useStadiumStore((s) => s.resetView)
  const [collapsed, setCollapsed] = useState(false)

  if (stage !== 'view' || !selectedSectorId || !selectedSeatId || cleanMode || !viewPanelReady) return null
  const sector = SECTOR_BY_ID[selectedSectorId]
  const seat = getSeat(selectedSeatId)
  if (!sector || !seat) return null

  const tier = TIER_BY_ID[sector.tierId]
  const category = sectorCategory(sector)
  const metrics = seatMetrics(seat)

  return (
    <>
      {!hasLookedAround && !transitioning && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[245px] z-10 flex justify-center px-4 sm:bottom-6 sm:left-[408px] sm:right-5 sm:justify-end">
          <div className="glass animate-panel-in flex items-center gap-2 rounded-full px-4 py-2 text-xs text-zinc-200">
            <Move className="h-3.5 w-3.5 text-[#d9ff3f]" />
            <span>Arraste ou WASD · Q/E zoom · H tela limpa</span>
          </div>
        </div>
      )}

      <aside className="glass-strong animate-panel-in fixed inset-x-3 bottom-3 z-20 rounded-2xl p-4 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[376px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#d9ff3f]">
              {sectorPositionLabel(sector)}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white">
              Setor {sector.number}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-300">
              Fileira {seat.row} · Assento {seat.number} · {tier.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.label}
            </p>
          </div>

          <div className="flex items-start gap-2">
            <MiniStadiumMap sectorId={sector.id} seat={seat} />
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expandir informações' : 'Recolher informações'}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/8 text-zinc-300 sm:hidden"
            >
              {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className={collapsed ? 'hidden sm:block' : 'block'}>
          <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-white/10 pt-3.5">
            <div>
              <p className="text-base font-semibold text-white">{Math.round(metrics.toCenter)} m</p>
              <p className="text-[11px] leading-tight text-zinc-400">até o centro do campo</p>
            </div>
            <div>
              <p className="text-base font-semibold text-white">{Math.round(metrics.toGoal)} m</p>
              <p className="text-[11px] leading-tight text-zinc-400">até o gol mais próximo</p>
            </div>
            <div>
              <p className="text-base font-semibold text-white">{Math.round(metrics.height)} m</p>
              <p className="text-[11px] leading-tight text-zinc-400">acima do gramado</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={backToSector}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-[#090a0d] transition hover:bg-zinc-200"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Trocar assento</span>
            </button>
            <button
              type="button"
              onClick={resetView}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/12 px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Resetar câmera</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
