/** Captures the active WebGL stadium canvas with a minimal Arena Tech badge and downloads it as PNG. */
export function captureSeatSnapshot(sectorNumber: number, row: number, seatNumber: number): boolean {
  const src = document.querySelector('canvas')
  if (!src || src.width === 0 || src.height === 0) return false

  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')
  if (!ctx) return false

  ctx.drawImage(src, 0, 0)

  const s = Math.max(1, out.width / 1280)
  const label = `ARENA TECH  ·  Setor ${sectorNumber} · Fileira ${row} · Assento ${seatNumber}`
  const fontSize = Math.round(14 * s)
  ctx.font = `600 ${fontSize}px "Inter Variable", Inter, system-ui, sans-serif`
  const textW = ctx.measureText(label).width
  const padX = Math.round(18 * s)
  const badgeW = textW + padX * 2 + Math.round(16 * s)
  const badgeH = Math.round(36 * s)
  const x = Math.round(24 * s)
  const y = out.height - badgeH - Math.round(24 * s)
  const r = badgeH / 2

  ctx.beginPath()
  ctx.roundRect(x, y, badgeW, badgeH, r)
  ctx.fillStyle = 'rgba(9, 10, 13, 0.78)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = Math.max(1, s)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + padX + Math.round(4 * s), y + badgeH / 2, Math.round(4 * s), 0, Math.PI * 2)
  ctx.fillStyle = '#d9ff3f'
  ctx.fill()

  ctx.fillStyle = '#f4f5f7'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + padX + Math.round(16 * s), y + badgeH / 2 + s * 0.5)

  const link = document.createElement('a')
  link.download = `arena-tech-setor-${sectorNumber}-f${row}-a${seatNumber}.png`
  link.href = out.toDataURL('image/png')
  link.click()
  return true
}
