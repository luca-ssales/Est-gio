import { create } from 'zustand'
import { getSeat, getSectorSeats } from '../data/seats'
import type { CategoryId, LightingMode, MapView, Stage } from '../types'

export interface TooltipState {
  x: number
  y: number
  title: string
  subtitle?: string
  tone?: 'default' | 'muted'
}

interface StadiumState {
  stage: Stage
  mapView: MapView
  selectedSectorId: string | null
  hoveredSectorId: string | null
  selectedSeatId: string | null
  hoveredSeatId: string | null
  categoryFilter: CategoryId | null
  tooltip: TooltipState | null
  /** Incremented to request a camera reset inside the 3D view. */
  resetToken: number
  /** True while the camera is flying between stages. */
  transitioning: boolean
  /** True once the user has dragged in the 3D view (hides the hint). */
  hasLookedAround: boolean
  lightingMode: LightingMode
  ambientAudio: boolean
  cleanMode: boolean
  viewPanelReady: boolean
  droneTour: boolean
  sceneReady: boolean
  loadProgress: number

  startDroneTour: () => void
  stopDroneTour: () => void
  enterTopMap: () => void
  backToOverview: () => void
  selectSector: (id: string) => void
  backToMap: () => void
  selectSeat: (id: string | null) => void
  stepSeat: (dRow: number, dSeat: number) => void
  enterView: () => void
  backToSector: () => void
  resetView: () => void
  setHoveredSector: (id: string | null) => void
  setHoveredSeat: (id: string | null) => void
  setTooltip: (t: TooltipState | null) => void
  setCategoryFilter: (c: CategoryId | null) => void
  setTransitioning: (v: boolean) => void
  markLookedAround: () => void
  setLightingMode: (mode: LightingMode) => void
  toggleAmbientAudio: () => void
  toggleCleanMode: () => void
  setCleanMode: (v: boolean) => void
  setViewPanelReady: (v: boolean) => void
  setLoadProgress: (p: number) => void
  setSceneReady: () => void
}

export const useStadiumStore = create<StadiumState>((set, get) => ({
  stage: 'map',
  mapView: 'overview',
  selectedSectorId: null,
  hoveredSectorId: null,
  selectedSeatId: null,
  hoveredSeatId: null,
  categoryFilter: null,
  tooltip: null,
  resetToken: 0,
  transitioning: false,
  hasLookedAround: false,
  lightingMode: 'day',
  ambientAudio: false,
  cleanMode: false,
  viewPanelReady: false,
  droneTour: false,
  sceneReady: false,
  loadProgress: 0,

  startDroneTour: () =>
    set({
      droneTour: true,
      stage: 'map',
      mapView: 'overview',
      selectedSectorId: null,
      selectedSeatId: null,
      hoveredSectorId: null,
      hoveredSeatId: null,
      tooltip: null,
      cleanMode: false,
      transitioning: false,
    }),
  stopDroneTour: () =>
    set({
      droneTour: false,
      transitioning: false,
    }),
  enterTopMap: () =>
    set({
      droneTour: false,
      stage: 'map',
      mapView: 'top',
      hoveredSectorId: null,
      tooltip: null,
    }),
  backToOverview: () =>
    set({
      droneTour: false,
      stage: 'map',
      mapView: 'overview',
      selectedSectorId: null,
      selectedSeatId: null,
      hoveredSectorId: null,
      tooltip: null,
      categoryFilter: null,
    }),
  selectSector: (id) => {
    const { selectedSectorId, selectedSeatId } = get()
    set({
      droneTour: false,
      stage: 'sector',
      mapView: 'top',
      selectedSectorId: id,
      // keep the previous seat only if it belongs to the same sector
      selectedSeatId: selectedSectorId === id ? selectedSeatId : null,
      hoveredSectorId: null,
      hoveredSeatId: null,
      tooltip: null,
    })
  },
  backToMap: () =>
    set({
      droneTour: false,
      stage: 'map',
      mapView: 'top',
      selectedSectorId: null,
      selectedSeatId: null,
      hoveredSeatId: null,
      hoveredSectorId: null,
      tooltip: null,
      cleanMode: false,
      viewPanelReady: false,
    }),
  selectSeat: (id) => set({ selectedSeatId: id }),
  stepSeat: (dRow, dSeat) => {
    const { selectedSectorId, selectedSeatId } = get()
    if (!selectedSectorId || !selectedSeatId) return
    const seats = getSectorSeats(selectedSectorId)
    const cur = getSeat(selectedSeatId)
    if (!cur) return

    if (dRow !== 0) {
      const dir = Math.sign(dRow)
      let row = cur.row + dir
      while (row >= 1 && row <= 30) {
        const candidates = seats.filter((s) => s.available && s.row === row)
        if (candidates.length > 0) {
          let best = candidates[0]
          let bestDist = Math.abs(best.number - cur.number)
          for (const c of candidates) {
            const d = Math.abs(c.number - cur.number)
            if (d < bestDist) {
              best = c
              bestDist = d
            }
          }
          set({ selectedSeatId: best.id })
          return
        }
        row += dir
      }
      return
    }

    if (dSeat !== 0) {
      const dir = Math.sign(dSeat)
      const sameRow = seats
        .filter((s) => s.available && s.row === cur.row && (dir > 0 ? s.number > cur.number : s.number < cur.number))
        .sort((a, b) => (dir > 0 ? a.number - b.number : b.number - a.number))
      if (sameRow.length > 0) {
        set({ selectedSeatId: sameRow[0].id })
      }
    }
  },
  enterView: () => {
    if (!get().selectedSeatId) return
    set({
      droneTour: false,
      stage: 'view',
      hoveredSeatId: null,
      hoveredSectorId: null,
      tooltip: null,
      hasLookedAround: false,
      cleanMode: false,
      transitioning: true,
      viewPanelReady: false,
    })
  },
  backToSector: () => set({ stage: 'sector', tooltip: null, cleanMode: false, viewPanelReady: false }),
  resetView: () => set((s) => ({ resetToken: s.resetToken + 1 })),
  setHoveredSector: (id) => set({ hoveredSectorId: id }),
  setHoveredSeat: (id) => set({ hoveredSeatId: id }),
  setTooltip: (t) => set({ tooltip: t }),
  setCategoryFilter: (c) => {
    const { stage, mapView } = get()
    if (c !== null && stage === 'map' && mapView === 'overview') {
      set({ categoryFilter: c, mapView: 'top', hoveredSectorId: null, tooltip: null })
    } else {
      set({ categoryFilter: c })
    }
  },
  setTransitioning: (v) => set({ transitioning: v }),
  markLookedAround: () => {
    if (!get().hasLookedAround) set({ hasLookedAround: true })
  },
  setLightingMode: (lightingMode) => set({ lightingMode }),
  toggleAmbientAudio: () => set((s) => ({ ambientAudio: !s.ambientAudio })),
  toggleCleanMode: () => set((s) => ({ cleanMode: !s.cleanMode })),
  setCleanMode: (cleanMode) => set({ cleanMode }),
  setViewPanelReady: (viewPanelReady) => set({ viewPanelReady }),
  setLoadProgress: (p) => set({ loadProgress: p }),
  setSceneReady: () => set({ sceneReady: true, loadProgress: 1 }),
}))
