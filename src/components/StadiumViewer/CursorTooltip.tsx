import { useStadiumStore } from '../../store/useStadiumStore'

export function CursorTooltip() {
  const tooltip = useStadiumStore((s) => s.tooltip)
  const stage = useStadiumStore((s) => s.stage)
  if (!tooltip) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const isMobile = vw < 640

  if (isMobile) {
    const mobilePos =
      stage === 'sector'
        ? 'fixed left-1/2 top-[68px] -translate-x-1/2'
        : 'fixed left-1/2 bottom-[72px] -translate-x-1/2'

    return (
      <div className={`glass-strong pointer-events-none z-30 w-max max-w-[calc(100vw-24px)] rounded-full px-3.5 py-1.5 text-center shadow-xl ${mobilePos}`}>
        <p className="text-xs font-semibold text-white">{tooltip.title}</p>
        {tooltip.subtitle && (
          <p className={['text-[11px]', tooltip.tone === 'muted' ? 'text-zinc-400' : 'text-zinc-300'].join(' ')}>
            {tooltip.subtitle}
          </p>
        )}
      </div>
    )
  }

  const flipLeft = tooltip.x + 260 > vw
  const left = flipLeft ? Math.max(12, tooltip.x - 16) : Math.max(12, tooltip.x + 16)
  const top = Math.min(vh - 76, Math.max(12, tooltip.y - 16))

  return (
    <div
      style={{ left, top, transform: flipLeft ? 'translateX(-100%)' : undefined }}
      className="glass-strong pointer-events-none fixed z-30 max-w-[230px] rounded-xl px-3 py-2 shadow-xl"
    >
      <p className="text-xs font-semibold text-white">{tooltip.title}</p>
      {tooltip.subtitle && (
        <p className={['mt-0.5 text-[11px]', tooltip.tone === 'muted' ? 'text-zinc-500' : 'text-zinc-300'].join(' ')}>
          {tooltip.subtitle}
        </p>
      )}
    </div>
  )
}
