import { useEffect, useRef } from 'react'
import { Moon, Sun, Sunset, X } from 'lucide-react'
import { useStadiumStore } from '../../store/useStadiumStore'
import { subscribeDroneTelemetry } from '../../three/StadiumCamera/droneTelemetry'
import { DRONE_ACTS } from '../../three/StadiumCamera/droneTour'
import type { LightingMode } from '../../types'

const LIGHTING_OPTIONS: { id: LightingMode; label: string; Icon: typeof Sun }[] = [
  { id: 'day', label: 'Dia', Icon: Sun },
  { id: 'dusk', label: 'Pôr do sol', Icon: Sunset },
  { id: 'night', label: 'Noite', Icon: Moon },
]

export function DroneTourHud() {
  const droneTour = useStadiumStore((s) => s.droneTour)
  const lightingMode = useStadiumStore((s) => s.lightingMode)
  const setLightingMode = useStadiumStore((s) => s.setLightingMode)
  const stopDroneTour = useStadiumStore((s) => s.stopDroneTour)

  const actRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!droneTour) return
    return subscribeDroneTelemetry(({ progress, actIndex }) => {
      if (actRef.current) {
        actRef.current.textContent = DRONE_ACTS[actIndex] ?? DRONE_ACTS[0]
      }
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`
      }
    })
  }, [droneTour])

  if (!droneTour) return null

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 p-3 sm:p-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="hidden md:block" />

          <div className="glass-strong pointer-events-auto flex flex-col items-center gap-1.5 justify-self-center rounded-2xl px-4 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#d9ff3f]" />
              <span ref={actRef}>{DRONE_ACTS[0]}</span>
            </div>
            <div className="h-0.5 w-44 overflow-hidden rounded-full bg-white/12">
              <div
                ref={barRef}
                className="h-full w-full origin-left bg-[#d9ff3f]"
                style={{ transform: 'scaleX(0)' }}
              />
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 justify-self-end">
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
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={stopDroneTour}
              className="glass flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              <X className="h-3.5 w-3.5 text-[#d9ff3f]" />
              <span>Sair do Tour</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3 sm:bottom-5">
        <div className="glass rounded-full px-4 py-1.5 text-[11px] text-zinc-300 sm:text-xs">
          Arraste ou pressione Esc para assumir o controle
        </div>
      </div>
    </>
  )
}
