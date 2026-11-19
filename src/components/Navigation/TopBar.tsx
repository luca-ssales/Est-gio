import { useState } from 'react'
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Moon,
  Play,
  RotateCcw,
  Search,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { CATEGORIES, MATCH } from '../../data/stadium'
import { SECTORS, SECTOR_BY_ID, sectorLabel } from '../../data/sectors'
import { getSeat } from '../../data/seats'
import { captureSeatSnapshot } from '../../lib/captureView'
import { setStadiumAudio } from '../../lib/stadiumAudio'
import { useStadiumStore } from '../../store/useStadiumStore'
import type { CategoryId, LightingMode } from '../../types'

const CATEGORY_LIST = Object.values(CATEGORIES)

const LIGHTING_OPTIONS: { id: LightingMode; label: string; Icon: typeof Sun }[] = [
  { id: 'day', label: 'Dia', Icon: Sun },
  { id: 'dusk', label: 'Pôr do sol', Icon: Sunset },
  { id: 'night', label: 'Noite', Icon: Moon },
]

const QUICK_JUMPS = [
  { id: '102', label: '1º Anel · Atrás do gol' },
  { id: '112', label: '1º Anel · Central VIP' },
  { id: '206', label: '2º Anel · Canto nordeste' },
  { id: '312', label: '3º Anel · Lateral panorâmica' },
]

export function TopBar() {
  const stage = useStadiumStore((s) => s.stage)
  const mapView = useStadiumStore((s) => s.mapView)
  const selectedSectorId = useStadiumStore((s) => s.selectedSectorId)
  const selectedSeatId = useStadiumStore((s) => s.selectedSeatId)
  const categoryFilter = useStadiumStore((s) => s.categoryFilter)
  const lightingMode = useStadiumStore((s) => s.lightingMode)
  const ambientAudio = useStadiumStore((s) => s.ambientAudio)
  const cleanMode = useStadiumStore((s) => s.cleanMode)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const setCategoryFilter = useStadiumStore((s) => s.setCategoryFilter)
  const setLightingMode = useStadiumStore((s) => s.setLightingMode)
  const toggleAmbientAudio = useStadiumStore((s) => s.toggleAmbientAudio)
  const toggleCleanMode = useStadiumStore((s) => s.toggleCleanMode)
  const setCleanMode = useStadiumStore((s) => s.setCleanMode)
  const startDroneTour = useStadiumStore((s) => s.startDroneTour)
  const selectSector = useStadiumStore((s) => s.selectSector)
  const backToOverview = useStadiumStore((s) => s.backToOverview)
  const backToMap = useStadiumStore((s) => s.backToMap)
  const backToSector = useStadiumStore((s) => s.backToSector)
  const resetView = useStadiumStore((s) => s.resetView)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [savedPhoto, setSavedPhoto] = useState(false)

  const sector = selectedSectorId ? SECTOR_BY_ID[selectedSectorId] : null
  const seat = selectedSeatId ? getSeat(selectedSeatId) : null

  const cycleSector = (dir: -1 | 1) => {
    if (!sector) return
    const idx = SECTORS.findIndex((s) => s.id === sector.id)
    const next = SECTORS[(idx + dir + SECTORS.length) % SECTORS.length]
    selectSector(next.id)
  }

  const toggleFilter = (id: CategoryId | null) => {
    setCategoryFilter(categoryFilter === id ? null : id)
  }

  const matches = query.trim()
    ? SECTORS.filter((s) => s.id.includes(query.trim())).slice(0, 6)
    : []

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = query.trim()
    const exact = SECTOR_BY_ID[clean] ?? matches[0]
    if (exact) {
      selectSector(exact.id)
      setSearchOpen(false)
      setQuery('')
    }
  }

  if (droneTour) return null

  if (stage === 'view' && sector && seat) {
    if (cleanMode) {
      return (
        <div className="pointer-events-none fixed right-3 top-3 z-20 sm:right-5 sm:top-5">
          <button
            type="button"
            onClick={() => setCleanMode(false)}
            className="glass pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
          >
            <Minimize2 className="h-3.5 w-3.5 text-[#d9ff3f]" />
            <span>Sair da tela limpa (H)</span>
          </button>
        </div>
      )
    }

    return (
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 p-3 sm:p-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={backToSector}
            aria-label="Voltar para seleção de assento"
            className="glass pointer-events-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-200 transition hover:border-white/25 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="glass pointer-events-auto flex min-w-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs sm:text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#d9ff3f]" />
            <span className="truncate font-medium text-zinc-100">
              Vista do Setor {sector.number} · Fileira {seat.row} · Assento {seat.number}
            </span>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={resetView}
              title="Resetar câmera (R)"
              className="glass flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Resetar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (captureSeatSnapshot(sector.number, seat.row, seat.number)) {
                  setSavedPhoto(true)
                  window.setTimeout(() => setSavedPhoto(false), 1800)
                }
              }}
              title="Salvar foto desta vista (PNG)"
              className="glass flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              {savedPhoto ? <Check className="h-3.5 w-3.5 text-[#d9ff3f]" /> : <Camera className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{savedPhoto ? 'Foto salva!' : 'Foto'}</span>
            </button>
            <button
              type="button"
              onClick={toggleCleanMode}
              title="Tela limpa (H)"
              className="glass flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Tela limpa</span>
            </button>
            <button
              type="button"
              onClick={backToMap}
              title="Voltar ao mapa geral"
              className="glass flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mapa geral</span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1" role="group" aria-label="Iluminação do estádio">
            {LIGHTING_OPTIONS.map(({ id, label, Icon }) => {
              const active = lightingMode === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLightingMode(id)}
                  className={[
                    'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                    active ? 'bg-[#d9ff3f] text-[#090a0d]' : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  <Icon className="h-3 w-3" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !ambientAudio
              setStadiumAudio(next, true)
              toggleAmbientAudio()
            }}
            aria-pressed={ambientAudio}
            title={ambientAudio ? 'Desativar som ambiente do estádio' : 'Ativar som ambiente do estádio'}
            className={[
              'glass pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition',
              ambientAudio
                ? 'border-[#d9ff3f]/60 bg-[#d9ff3f]/15 text-[#d9ff3f]'
                : 'text-zinc-300 hover:border-white/25 hover:text-white',
            ].join(' ')}
          >
            {ambientAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{ambientAudio ? 'Som ativo' : 'Som'}</span>
          </button>
        </div>
      </header>
    )
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 p-3 sm:p-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5">
        {stage === 'sector' && sector ? (
          <div className="flex items-center justify-between gap-3">
            <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={backToMap}
                aria-label="Voltar ao mapa geral"
                className="glass flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-200 transition hover:border-white/25 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="glass min-w-0 rounded-full px-4 py-1.5">
                <p className="truncate text-sm font-semibold text-white">Setor {sector.number}</p>
                <p className="truncate text-[11px] text-zinc-400">{sectorLabel(sector)}</p>
              </div>
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              <div className="glass flex items-center gap-0.5 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => cycleSector(-1)}
                  aria-label="Setor anterior"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => cycleSector(1)}
                  aria-label="Próximo setor"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {mapView === 'top' ? (
              <button
                type="button"
                onClick={backToOverview}
                aria-label="Voltar à visão geral"
                title="Voltar à visão geral"
                className="glass pointer-events-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center justify-self-start rounded-full text-zinc-200 transition hover:border-white/25 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <div />
            )}

            <div className="glass pointer-events-auto min-w-0 max-w-full justify-self-center rounded-2xl px-5 py-2 text-center">
              <p className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                {MATCH.home} – {MATCH.away}
              </p>
              <p className="truncate text-[11px] text-zinc-400 sm:text-xs">
                {MATCH.stage} · {MATCH.date} · {MATCH.time} · {MATCH.venue}
              </p>
            </div>

            <div />
          </div>
        )}

        {stage === 'map' && (
          <div className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={[
                'glass cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition',
                categoryFilter === null
                  ? 'border-[#d9ff3f]/60 bg-[#d9ff3f]/15 text-[#d9ff3f]'
                  : 'text-zinc-300 hover:border-white/25 hover:text-white',
              ].join(' ')}
            >
              Todos os setores
            </button>
            {CATEGORY_LIST.map((cat) => {
              const active = categoryFilter === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleFilter(cat.id)}
                  className={[
                    'glass flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'border-white/35 bg-white/12 text-white'
                      : 'text-zinc-300 hover:border-white/25 hover:text-white',
                  ].join(' ')}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.label}</span>
                </button>
              )
            })}

            {/* Lighting mode toggle in map stage */}
            <div className="glass flex items-center gap-0.5 rounded-full p-1" role="group" aria-label="Iluminação do estádio">
              {LIGHTING_OPTIONS.map(({ id, label, Icon }) => {
                const active = lightingMode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLightingMode(id)}
                    className={[
                      'flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                      active ? 'bg-[#d9ff3f] text-[#090a0d]' : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Quick sector search trigger */}
            <div className="relative">
              {searchOpen ? (
                <form onSubmit={submitSearch} className="glass-strong flex items-center gap-1.5 rounded-full px-3 py-1">
                  <Search className="h-3.5 w-3.5 text-[#d9ff3f]" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex: 217"
                    className="w-20 bg-transparent text-xs text-white placeholder-zinc-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false)
                      setQuery('')
                    }}
                    aria-label="Fechar busca"
                    className="cursor-pointer text-zinc-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="glass flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:text-white"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Buscar setor</span>
                </button>
              )}

              {searchOpen && (
                <div className="glass-strong animate-panel-in absolute right-0 top-10 z-30 w-56 rounded-2xl p-2 shadow-2xl">
                  {matches.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {matches.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            selectSector(s.id)
                            setSearchOpen(false)
                            setQuery('')
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-white/10"
                        >
                          <span className="font-semibold text-white">Setor {s.number}</span>
                          <span className="truncate pl-2 text-[10px] text-zinc-400">
                            {s.available ? sectorLabel(s) : 'Esgotado'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Atalhos rápidos
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {QUICK_JUMPS.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              selectSector(q.id)
                              setSearchOpen(false)
                              setQuery('')
                            }}
                            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-white/10"
                          >
                            <span>{q.label}</span>
                            <span className="font-semibold text-[#d9ff3f]">{q.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={startDroneTour}
              title="Sobrevoo cinemático pela Arena Tech"
              className="glass flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#d9ff3f] transition hover:border-[#d9ff3f]/50 hover:bg-[#d9ff3f]/15"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Tour 3D</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
