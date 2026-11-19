import { sectorStats } from '../../data/seats'
import { SECTOR_BY_ID, sectorCategory, sectorLabel } from '../../data/sectors'
import { useStadiumStore } from '../../store/useStadiumStore'

export function SectorHud() {
  const stage = useStadiumStore((s) => s.stage)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const backToMap = useStadiumStore((s) => s.backToMap)

  if (stage !== 'sector' || !selectedSectorId) return null
  const sector = SECTOR_BY_ID[selectedSectorId]
  if (!sector) return null

  const category = sectorCategory(sector)
  const { free, total } = sectorStats(sector.id)

  return (
    <aside
      className={[
        'glass-strong animate-panel-in fixed bottom-3 left-3 z-20 max-w-[310px] rounded-2xl p-4 sm:bottom-5 sm:left-5',
        selectedSeatId ? 'hidden sm:block' : 'right-3 sm:right-auto',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {sectorLabel(sector)}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-white">Setor {sector.number}</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
          {category.label}
        </span>
      </div>

      {!sector.available ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-xs font-medium text-zinc-200">Setor esgotado neste evento</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Nenhum assento disponível aqui. Escolha outro setor no mapa geral.
          </p>
          <button
            type="button"
            onClick={backToMap}
            className="mt-2.5 w-full cursor-pointer rounded-full bg-white/10 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
          >
            Voltar ao mapa
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2.5 text-xs text-zinc-300">
            <span className="font-semibold text-white">{free}</span> de {total} assentos disponíveis
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#dc2f46]" />
              Disponível
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#d9ff3f]" />
              Selecionado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#1e232c] ring-1 ring-white/15" />
              Ocupado
            </span>
          </div>
          <p className="mt-2.5 text-[11px] text-zinc-500">
            Clique em um assento disponível para entrar direto na vista 3D.
          </p>
        </>
      )}
    </aside>
  )
}
