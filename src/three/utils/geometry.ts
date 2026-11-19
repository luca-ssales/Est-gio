import * as THREE from 'three'
import type { Piece } from '../../types'
import { PIECES, pieceLength, piecePoint, pieceSamples } from '../../data/stadium'

export type ProfilePoint = [d: number, h: number]

interface SweepOptions {
  arcSegments?: number
  closed?: boolean
  pieces?: Piece[]
  /** offset at which U is measured (for texture repeat along the path) */
  uD?: number
  uScale?: number
  vScale?: number
  /** colour for each profile segment (enables vertex colours) */
  segColor?: (index: number, a: ProfilePoint, b: ProfilePoint) => THREE.Color
}

/**
 * Sweeps a 2D profile (d = outward offset, h = height) along the bowl path.
 * Every profile segment gets its own vertices (sharp creases across the profile),
 * while vertices are shared along the path (smooth curved corners).
 */
export function sweepProfile(profile: ProfilePoint[], opts: SweepOptions = {}): THREE.BufferGeometry {
  const { arcSegments = 28, closed = false, pieces = PIECES, uD = 0, uScale = 1, vScale = 1, segColor } = opts
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const segs = closed ? profile.length : profile.length - 1
  const vCum: number[] = [0]
  for (let j = 1; j <= profile.length; j++) {
    const a = profile[j - 1]
    const b = profile[j % profile.length]
    vCum.push(vCum[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  let uAcc = 0
  for (const piece of pieces) {
    const fs = pieceSamples(piece, arcSegments)
    const len = pieceLength(piece, uD)
    const base = fs.map((f) => piecePoint(piece, f, 0))
    for (let j = 0; j < segs; j++) {
      const A = profile[j]
      const B = profile[(j + 1) % profile.length]
      const color = segColor?.(j, A, B)
      const start = pos.length / 3
      fs.forEach((f, i) => {
        const p = base[i]
        const u = (uAcc + f * len) / uScale
        pos.push(p.x + p.nx * A[0], A[1], p.z + p.nz * A[0])
        pos.push(p.x + p.nx * B[0], B[1], p.z + p.nz * B[0])
        uv.push(u, vCum[j] / vScale, u, vCum[j + 1] / vScale)
        if (color) col.push(color.r, color.g, color.b, color.r, color.g, color.b)
      })
      for (let i = 0; i < fs.length - 1; i++) {
        const a = start + i * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
    uAcc += len
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Builds flat ribbons (in XZ plane at height y) from polylines – used for pitch markings. */
export class RibbonBuilder {
  private pos: number[] = []
  private idx: number[] = []

  line(points: [number, number][], width: number, closed = false) {
    const pts = closed ? [...points, points[0]] : points
    const hw = width / 2
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i]
      const [x2, z2] = pts[i + 1]
      const len = Math.hypot(x2 - x1, z2 - z1) || 1
      const dx = (x2 - x1) / len
      const dz = (z2 - z1) / len
      // extend slightly so joints have no gaps
      const ex = dx * hw
      const ez = dz * hw
      const nx = -dz * hw
      const nz = dx * hw
      const s = this.pos.length / 3
      this.pos.push(
        x1 - ex + nx, 0, z1 - ez + nz,
        x1 - ex - nx, 0, z1 - ez - nz,
        x2 + ex + nx, 0, z2 + ez + nz,
        x2 + ex - nx, 0, z2 + ez - nz,
      )
      this.idx.push(s, s + 2, s + 1, s + 1, s + 2, s + 3)
    }
    return this
  }

  arc(cx: number, cz: number, r: number, a0: number, a1: number, width: number, segments = 64) {
    const pts: [number, number][] = []
    for (let i = 0; i <= segments; i++) {
      const a = a0 + ((a1 - a0) * i) / segments
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
    return this.line(pts, width)
  }

  disc(cx: number, cz: number, r: number, segments = 24) {
    const s = this.pos.length / 3
    this.pos.push(cx, 0, cz)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      this.pos.push(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)
    }
    for (let i = 1; i <= segments; i++) this.idx.push(s, s + i + 1, s + i)
    return this
  }

  build(y: number) {
    const g = new THREE.BufferGeometry()
    const p = this.pos.slice()
    for (let i = 1; i < p.length; i += 3) p[i] = y
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    const normals = new Float32Array(p.length)
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    g.setIndex(this.idx)
    return g
  }
}

/** Polygon outline of the bowl at offset d (closed), as XZ points. */
export function bowlOutline(d: number, arcSegments = 24): [number, number][] {
  const pts: [number, number][] = []
  for (const piece of PIECES) {
    const fs = pieceSamples(piece, arcSegments)
    fs.forEach((f, i) => {
      if (i === fs.length - 1) return
      const p = piecePoint(piece, f, d)
      pts.push([p.x, p.z])
    })
  }
  return pts
}
