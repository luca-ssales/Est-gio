export interface CameraTelemetry {
  dirX: number
  dirZ: number
  hFov: number
}

const current: CameraTelemetry = { dirX: 0, dirZ: -1, hFov: 1.0 }
const listeners = new Set<(t: CameraTelemetry) => void>()

export function publishCameraTelemetry(dirX: number, dirZ: number, hFov: number) {
  const delta = Math.abs(dirX - current.dirX) + Math.abs(dirZ - current.dirZ) + Math.abs(hFov - current.hFov)
  if (delta <= 0.002) return
  current.dirX = dirX
  current.dirZ = dirZ
  current.hFov = hFov
  listeners.forEach((cb) => cb(current))
}

export function getCameraTelemetry(): CameraTelemetry {
  return current
}

export function subscribeCameraTelemetry(cb: (t: CameraTelemetry) => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
