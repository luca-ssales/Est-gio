import * as THREE from 'three'
import { BOWL, PITCH } from '../data/stadium'
import { mulberry32 } from './random'

const FONT = '"Inter Variable", Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function finish(tex: THREE.Texture, srgb = true) {
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/**
 * Grass colour map covering the whole bowl floor (x: ±halfX, z: ±halfZ).
 * Mowing stripes + per-pixel noise + subtle wear patches. flipY=false so canvas row 0 = north (-Z).
 */
export function createGrassTexture(width = 1536): THREE.CanvasTexture {
  const W = width
  const H = Math.round((width * BOWL.halfZ) / BOWL.halfX)
  const { c, ctx } = canvas(W, H)
  const pxPerM = H / (BOWL.halfZ * 2)
  const stripe = PITCH.length / 18
  const toPy = (z: number) => (z + BOWL.halfZ) * pxPerM
  // base stripes aligned with the goal lines
  for (let z = -BOWL.halfZ; z < BOWL.halfZ; z += 0.25) {
    const band = Math.floor((z + PITCH.length / 2) / stripe)
    const light = band % 2 === 0
    ctx.fillStyle = light ? '#3f8a35' : '#357a2d'
    ctx.fillRect(0, toPy(z), W, 0.25 * pxPerM + 1)
  }
  // subtle diagonal secondary mowing pattern
  ctx.globalAlpha = 0.05
  ctx.fillStyle = '#000'
  for (let k = -40; k < 40; k++) {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(Math.PI / 4)
    if (k % 2 === 0) ctx.fillRect(k * stripe * pxPerM, -H, stripe * pxPerM, H * 2)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  // wear in goal mouths and centre
  const wear = (x: number, z: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(
      (x + BOWL.halfX) * pxPerM,
      toPy(z),
      0,
      (x + BOWL.halfX) * pxPerM,
      toPy(z),
      r * pxPerM,
    )
    g.addColorStop(0, `rgba(120,110,60,${a})`)
    g.addColorStop(1, 'rgba(120,110,60,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  wear(0, -50, 7, 0.22)
  wear(0, 50, 7, 0.22)
  wear(0, 0, 10, 0.08)

  // synthetic dark graphite technical track around the grass apron (|x| > 37.2 or |z| > 55.7)
  const gx0 = (BOWL.halfX - 37.2) * pxPerM
  const gy0 = toPy(-55.7)
  const gw = 74.4 * pxPerM
  const gh = 111.4 * pxPerM
  const gr = 2.8 * pxPerM
  const traceRounded = () => {
    ctx.moveTo(gx0 + gr, gy0)
    ctx.lineTo(gx0 + gw - gr, gy0)
    ctx.quadraticCurveTo(gx0 + gw, gy0, gx0 + gw, gy0 + gr)
    ctx.lineTo(gx0 + gw, gy0 + gh - gr)
    ctx.quadraticCurveTo(gx0 + gw, gy0 + gh, gx0 + gw - gr, gy0 + gh)
    ctx.lineTo(gx0 + gr, gy0 + gh)
    ctx.quadraticCurveTo(gx0, gy0 + gh, gx0, gy0 + gh - gr)
    ctx.lineTo(gx0, gy0 + gr)
    ctx.quadraticCurveTo(gx0, gy0, gx0 + gr, gy0)
    ctx.closePath()
  }
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  traceRounded()
  ctx.fillStyle = '#181c22'
  ctx.fill('evenodd')
  ctx.beginPath()
  traceRounded()
  ctx.strokeStyle = '#245622'
  ctx.lineWidth = Math.max(2, 0.35 * pxPerM)
  ctx.stroke()

  // per-pixel noise
  const img = ctx.getImageData(0, 0, W, H)
  const rand = mulberry32(7)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 22
    data[i] = Math.max(0, Math.min(255, data[i] + n * 0.6))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.4))
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false
  tex.generateMipmaps = true
  return finish(tex) as THREE.CanvasTexture
}

/** Small tiling noise used as bump map for close-up grass detail. */
export function createNoiseTexture(size = 256, seed = 3, contrast = 1): THREE.CanvasTexture {
  const { c, ctx } = canvas(size, size)
  const img = ctx.createImageData(size, size)
  const rand = mulberry32(seed)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 255 * contrast
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return finish(tex, false) as THREE.CanvasTexture
}

/** Transparent grid used for goal nets. */
export function createNetTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(64, 64)
  ctx.clearRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, 2)
  ctx.lineTo(64, 2)
  ctx.moveTo(2, 0)
  ctx.lineTo(2, 64)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return finish(tex) as THREE.CanvasTexture
}

/** LED advertising boards around the pitch. */
export function createAdTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(2048, 96)
  const blocks = [
    { bg: '#0b0c0f', fg: '#d9ff3f', text: 'ARENA TECH' },
    { bg: '#11203f', fg: '#ffffff', text: 'FINAL · 2026' },
    { bg: '#d9ff3f', fg: '#0b0c0f', text: 'AURORA FC' },
    { bg: '#0b0c0f', fg: '#ffffff', text: 'VISTA 3D' },
  ]
  const bw = 2048 / blocks.length
  blocks.forEach((b, i) => {
    ctx.fillStyle = b.bg
    ctx.fillRect(i * bw, 0, bw, 96)
    ctx.fillStyle = b.fg
    ctx.font = `800 54px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.text, i * bw + bw / 2, 50)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  return finish(tex) as THREE.CanvasTexture
}

/** Ribbon fascia between tiers. */
export function createFasciaTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 64)
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, '#2a1a05')
  g.addColorStop(0.5, '#ffb238')
  g.addColorStop(1, '#2a1a05')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 64)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  for (let x = 0; x < 1024; x += 16) ctx.fillRect(x, 0, 3, 64)
  ctx.fillStyle = '#1a0f02'
  ctx.font = `800 34px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillText('ARENA TECH  ·  FINAL  ·  AUR × ATN', 40, 34)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  return finish(tex) as THREE.CanvasTexture
}

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  home: string,
  away: string,
  clockText: string,
  liveDot: boolean,
) {
  ctx.fillStyle = '#05070a'
  ctx.fillRect(0, 0, 1024, 352)
  ctx.strokeStyle = '#1d2128'
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, 1012, 340)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 112px ${FONT}`
  ctx.fillText(`${home}  0 – 0  ${away}`, 512, 134)

  ctx.fillStyle = '#d9ff3f'
  ctx.font = `700 62px ${FONT}`
  ctx.fillText(clockText, 512, 232)

  // live badge + subtle venue footer
  ctx.font = `700 22px ${FONT}`
  const liveX = 398
  const liveY = 298
  ctx.fillStyle = liveDot ? '#d9ff3f' : '#4a5520'
  ctx.beginPath()
  ctx.arc(liveX - 48, liveY - 1, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d4d8e0'
  ctx.textAlign = 'left'
  ctx.fillText('AO VIVO', liveX - 34, liveY)
  ctx.fillStyle = '#7b8394'
  ctx.fillText('·  ARENA TECH', liveX + 74, liveY)
}

export function createScoreboardTexture(home: string, away: string, time: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 352)
  drawScoreboard(ctx, home, away, time, true)
  const tex = new THREE.CanvasTexture(c)
  return finish(tex) as THREE.CanvasTexture
}

export function createLiveScoreboard(home: string, away: string) {
  const { c, ctx } = canvas(1024, 352)
  drawScoreboard(ctx, home, away, '00:00', true)
  const texture = finish(new THREE.CanvasTexture(c)) as THREE.CanvasTexture
  let lastSec = -1

  const update = (elapsedSeconds: number) => {
    const sec = Math.max(0, Math.floor(elapsedSeconds))
    if (sec === lastSec) return
    lastSec = sec
    const mm = String(Math.floor(sec / 60)).padStart(2, '0')
    const ss = String(sec % 60).padStart(2, '0')
    drawScoreboard(ctx, home, away, `${mm}:${ss}`, sec % 2 === 0)
    texture.needsUpdate = true
  }

  return { texture, update }
}

const labelCache = new Map<string, THREE.CanvasTexture>()

/** White text on transparent background, tinted through material colour. */
export function getLabelTexture(text: string, weight = 700, fontSize = 76): THREE.CanvasTexture {
  const key = `${text}|${weight}|${fontSize}`
  const hit = labelCache.get(key)
  if (hit) return hit
  const { c, ctx } = canvas(256, 128)
  ctx.clearRect(0, 0, 256, 128)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${weight} ${fontSize}px ${FONT}`
  ctx.fillText(text, 128, 68, 232)
  const tex = new THREE.CanvasTexture(c)
  finish(tex)
  labelCache.set(key, tex)
  return tex
}

/** Illuminated glazed VIP skyboxes wrapped around the mid-tier ring. */
export function createSkyboxTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 128
  const { c, ctx } = canvas(W, H)
  const rand = mulberry32(42)

  ctx.fillStyle = '#0d1016'
  ctx.fillRect(0, 0, W, H)

  const bays = 16
  const bayW = W / bays
  for (let i = 0; i < bays; i++) {
    const x = i * bayW
    const lit = 0.55 + rand() * 0.45
    const g = ctx.createLinearGradient(0, 12, 0, H - 10)
    g.addColorStop(0, `rgba(255, 214, 146, ${(0.88 * lit).toFixed(2)})`)
    g.addColorStop(0.6, `rgba(218, 138, 48, ${(0.62 * lit).toFixed(2)})`)
    g.addColorStop(1, `rgba(72, 42, 16, ${(0.75 * lit).toFixed(2)})`)
    ctx.fillStyle = g
    ctx.fillRect(x + 4, 10, bayW - 8, H - 20)

    // interior depth pillars / subtle silhouettes
    ctx.fillStyle = 'rgba(14, 16, 22, 0.35)'
    ctx.fillRect(x + bayW * 0.36, 10, 4, H - 20)
    ctx.fillRect(x + bayW * 0.68, 10, 4, H - 20)

    // mullion frames
    ctx.fillStyle = '#11141a'
    ctx.fillRect(x, 0, 5, H)
    ctx.fillRect(x + bayW - 5, 0, 5, H)
  }
  // top & bottom structural transoms + glazed reflection line
  ctx.fillStyle = '#12151c'
  ctx.fillRect(0, 0, W, 10)
  ctx.fillRect(0, H - 10, W, 10)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.fillRect(0, 16, W, 3)

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  return finish(tex) as THREE.CanvasTexture
}

/** Classic match football texture for the centre-spot ball. */
export function createBallTexture(): THREE.CanvasTexture {
  const W = 256
  const H = 128
  const { c, ctx } = canvas(W, H)
  ctx.fillStyle = '#f3f4f0'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#181b22'
  const spots: [number, number, number][] = [
    [32, 32, 12],
    [96, 36, 12],
    [160, 32, 12],
    [224, 36, 12],
    [64, 92, 12],
    [128, 88, 12],
    [192, 92, 12],
  ]
  for (const [cx, cy, r] of spots) {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(a) * r
      const py = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  return finish(tex) as THREE.CanvasTexture
}

export const PARK_AVENUE_ANGLES = [0.35, 1.25, 2.25, 3.35, 4.35, 5.35]

/** Procedural top-down texture (1000x1000m) for the sunlit park, stone stadium plaza and curving avenues. */
export function createParkTexture(size = 2048): THREE.CanvasTexture {
  const { c, ctx } = canvas(size, size)
  const scale = size / 1000
  const toPx = (m: number) => (m + 500) * scale

  // Base emerald park meadow
  const bg = ctx.createRadialGradient(toPx(0), toPx(0), 90 * scale, toPx(0), toPx(0), 500 * scale)
  bg.addColorStop(0, '#6aaa39')
  bg.addColorStop(0.45, '#5c9c32')
  bg.addColorStop(1, '#4e8d29')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // Subtle organic meadow mowing/terrain mottling
  const rand = mulberry32(101)
  for (let i = 0; i < 160; i++) {
    const rx = toPx((rand() - 0.5) * 940)
    const ry = toPx((rand() - 0.5) * 940)
    const r = (24 + rand() * 52) * scale
    const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, r)
    g.addColorStop(0, rand() > 0.5 ? 'rgba(130, 194, 66, 0.22)' : 'rgba(54, 108, 28, 0.18)')
    g.addColorStop(1, 'rgba(92, 156, 50, 0)')
    ctx.fillStyle = g
    ctx.fillRect(rx - r, ry - r, r * 2, r * 2)
  }

  // Sweeping curving avenues (6 radial boulevards + outer ring parkway)
  const drawAvenue = (strokeStyle: string, widthM: number, dashed = false) => {
    ctx.save()
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = widthM * scale
    ctx.lineCap = 'round'
    if (dashed) ctx.setLineDash([12 * scale, 14 * scale])

    // Ring parkway oval
    ctx.beginPath()
    ctx.ellipse(toPx(0), toPx(0), 205 * scale, 225 * scale, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 6 graceful curved boulevards radiating from the stadium plaza
    for (const a0 of PARK_AVENUE_ANGLES) {
      ctx.beginPath()
      for (let r = 112; r <= 496; r += 8) {
        const ang = a0 + 0.14 * Math.sin(r / 120)
        const px = toPx(Math.cos(ang) * r)
        const py = toPx(Math.sin(ang) * r)
        if (r === 112) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  // Concrete white road shoulders/curbs, dark asphalt, and dashed centerlines
  drawAvenue('#e8ecf0', 17.5)
  drawAvenue('#353a44', 13.5)
  drawAvenue('rgba(235, 240, 246, 0.65)', 0.9, true)

  // Light-stone pedestrian stadium plaza wrapping tightly around the exterior
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(toPx(0), toPx(0), 114 * scale, 132 * scale, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#d4dae2'
  ctx.fill()
  ctx.lineWidth = 3.5 * scale
  ctx.strokeStyle = '#eceff4'
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(toPx(0), toPx(0), 103 * scale, 121 * scale, 0, 0, Math.PI * 2)
  ctx.lineWidth = 1.6 * scale
  ctx.strokeStyle = 'rgba(130, 142, 160, 0.45)'
  ctx.stroke()
  ctx.restore()

  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false
  tex.generateMipmaps = true
  return finish(tex) as THREE.CanvasTexture
}
