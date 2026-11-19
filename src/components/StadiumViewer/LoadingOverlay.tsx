import { useEffect, useState } from 'react'
import { useStadiumStore } from '../../store/useStadiumStore'

export function LoadingOverlay() {
  const sceneReady = useStadiumStore((s) => s.sceneReady)
  const loadProgress = useStadiumStore((s) => s.loadProgress)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    if (!sceneReady) return
    const timer = window.setTimeout(() => setMounted(false), 380)
    return () => window.clearTimeout(timer)
  }, [sceneReady])

  if (!mounted) return null

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090a0d] transition-opacity duration-300',
        sceneReady ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d9ff3f]">Arena Tech</p>
      <p className="mt-2 text-sm text-zinc-400">Preparando ambiente 3D…</p>
      <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-white/10">
        {loadProgress > 0 ? (
          <div
            className="h-full rounded-full bg-[#d9ff3f] transition-all duration-300"
            style={{ width: `${Math.round(loadProgress * 100)}%` }}
          />
        ) : (
          <div className="animate-loading-slide h-full w-1/2 rounded-full bg-[#d9ff3f]" />
        )}
      </div>
    </div>
  )
}
