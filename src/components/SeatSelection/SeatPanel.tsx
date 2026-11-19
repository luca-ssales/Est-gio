import { Eye, X } from 'lucide-react'
import { TIER_BY_ID } from '../../data/stadium'
import { SECTOR_BY_ID, sectorCategory, sectorPositionLabel } from '../../data/sectors'
import { getSeat } from '../../data/seats'
import { useStadiumStore } from '../../store/useStadiumStore'

export function SeatPanel() {
  const stage = useStadiumStore((s) => s.stage)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const selectSeat = useStadiumStore((s) => s.selectSeat)
  const enterView = useStadiumStore((s) => s.enterView)
  const backToMap = useStadiumStore((s) => s.backToMap)

  if (stage !== 'sector' || !selectedSectorId || !selectedSeatId) return null
  const sector = SECTOR_BY_ID[selectedSectorId]
  const seat = getSeat(selectedSeatId)
  if (!sector || !seat) return null

  const tier = TIER_BY_ID[sector.tierId]
  const category = sectorCategory(sector)

  return (
    <aside className="glass-strong animate-panel-in fixed inset-x-3 bottom-3 z-20 rounded-2xl p-4 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[340px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#d9ff3f]">
            {sectorPositionLabel(sector)}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-white">Setor {sector.number}</h3>
          <p className="text-xs text-zinc-400">{tier.name}</p>
        </div>
        <button
          type="button"
          onClick={() => selectSeat(null)}
          aria-label="Limpar seleção de assento"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-black/30 p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Setor</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{sector.number}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Fileira</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{seat.row}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Assento</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{seat.number}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-xs">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="font-medium text-zinc-200">{category.label}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={enterView}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#d9ff3f] px-4 py-2.5 text-sm font-semibold text-[#090a0d] transition hover:bg-[#e5ff70]"
        >
          <Eye className="h-4 w-4" />
          <span>Visualizar vista 3D</span>
        </button>
        <button
          type="button"
          onClick={backToMap}
          className="w-full cursor-pointer rounded-full border border-white/10 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/8 hover:text-white"
        >
          Voltar ao mapa geral
        </button>
      </div>
    </aside>
  )
}
