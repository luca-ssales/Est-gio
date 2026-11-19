import { useEffect } from 'react'
import { StadiumScene } from '../three/StadiumViewer/StadiumScene'
import { TopBar } from '../components/Navigation/TopBar'
import { MapHud } from '../components/StadiumMap/MapHud'
import { SectorHud } from '../components/SectorSelection/SectorHud'
import { SeatPanel } from '../components/SeatSelection/SeatPanel'
import { SeatInfoPanel } from '../components/SeatInformation/SeatInfoPanel'
import { CursorTooltip } from '../components/StadiumViewer/CursorTooltip'
import { DroneTourHud } from '../components/StadiumViewer/DroneTourHud'
import { LoadingOverlay } from '../components/StadiumViewer/LoadingOverlay'
import { useStadiumStore } from '../store/useStadiumStore'
import { setStadiumAudio } from '../lib/stadiumAudio'

export function StadiumPage() {
  const stage = useStadiumStore((s) => s.stage)
  const droneTour = useStadiumStore((s) => s.droneTour)
  const ambientAudio = useStadiumStore((s) => s.ambientAudio)

  useEffect(() => {
    const sync = () => setStadiumAudio(ambientAudio, (stage === 'view' || droneTour) && !document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
    }
  }, [stage, droneTour, ambientAudio])

  useEffect(() => () => setStadiumAudio(false, false), [])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const {
        stage,
        mapView,
        droneTour,
        cleanMode,
        toggleCleanMode,
        setCleanMode,
        backToSector,
        backToMap,
        backToOverview,
        stopDroneTour,
        selectSeat,
        selectedSeatId,
      } = useStadiumStore.getState()
      if (e.key.toLowerCase() === 'h' && stage === 'view') {
        toggleCleanMode()
        return
      }
      if (e.key !== 'Escape') return
      if (droneTour) {
        stopDroneTour()
        return
      }
      if (stage === 'view') {
        if (cleanMode) setCleanMode(false)
        else backToSector()
      } else if (stage === 'sector') {
        if (selectedSeatId) selectSeat(null)
        else backToMap()
      } else if (stage === 'map' && mapView === 'top') {
        backToOverview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#090a0d]">
      <StadiumScene />
      <TopBar />
      <MapHud />
      <SectorHud />
      <SeatPanel />
      <SeatInfoPanel />
      <DroneTourHud />
      <CursorTooltip />
      <LoadingOverlay />
    </main>
  )
}
