import { ArrowRight } from 'lucide-react'
import { useStadiumStore } from '../../store/useStadiumStore'

export function MapHud() {
  const stage = useStadiumStore((s) => s.stage)
  const mapView = useStadiumStore((s) => s.mapView)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectSector = useStadiumStore((s) => s.selectSector)

  if (stage !== 'map' || droneTour) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-3 sm:bottom-5">
      {selectedSectorId && (
        <button
          type="button"
          onClick={() => selectSector(selectedSectorId)}
          className="glass-strong animate-panel-in pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border-[#d9ff3f]/40 px-4 py-1.5 text-xs font-medium text-[#d9ff3f] transition hover:bg-[#d9ff3f]/15"
        >
          <span>Retornar ao Setor {selectedSectorId}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}

      {mapView === 'overview' ? (
        <div className="glass pointer-events-auto flex items-center justify-center rounded-full px-4 py-2 text-center text-[11px] text-zinc-300 sm:text-xs">
          Clique no estádio para escolher um setor · Arraste ou WASD para girar · Scroll ou Q/E para zoom
        </div>
      ) : (
        <div className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-full px-4 py-2 text-[11px] text-zinc-300 sm:text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#c9253c] ring-1 ring-white/25" />
            Disponível
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#ff8c1a]" />
            Destaque
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#0b0e16] ring-1 ring-white/20" />
            Indisponível
          </span>
          <span className="hidden text-zinc-500 md:inline">·</span>
          <span className="hidden text-zinc-400 md:inline">Clique em um setor · Esc para voltar</span>
        </div>
      )}
    </div>
  )
}
