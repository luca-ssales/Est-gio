export interface DroneTelemetry {
  progress: number
  actIndex: number
}

type Listener = (t: DroneTelemetry) => void

const listeners = new Set<Listener>()
let latest: DroneTelemetry = { progress: 0, actIndex: 0 }

export function publishDroneTelemetry(progress: number, actIndex: number) {
  latest = { progress, actIndex }
  listeners.forEach((fn) => fn(latest))
}

export function subscribeDroneTelemetry(fn: Listener) {
  listeners.add(fn)
  fn(latest)
  return () => {
    listeners.delete(fn)
  }
}
