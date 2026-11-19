/**
 * Procedural open-air stadium crowd ambience using Web Audio API (no external audio assets).
 */

interface AudioNodes {
  ctx: AudioContext
  master: GainNode
}

let nodes: AudioNodes | null = null

function createSeamlessPinkBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045
      b6 = white * 0.115926
    }
    // crossfade edges over 0.1s for seamless looping
    const fade = Math.floor(ctx.sampleRate * 0.1)
    for (let i = 0; i < fade; i++) {
      const t = i / fade
      data[i] = data[i] * t + data[length - fade + i] * (1 - t)
    }
  }
  return buf
}

function createSeamlessBrownBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let lastOut = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      lastOut = (lastOut + 0.02 * white) / 1.02
      data[i] = lastOut * 0.45
    }
    const fade = Math.floor(ctx.sampleRate * 0.1)
    for (let i = 0; i < fade; i++) {
      const t = i / fade
      data[i] = data[i] * t + data[length - fade + i] * (1 - t)
    }
  }
  return buf
}

function initAudio(): AudioNodes | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.connect(ctx.destination)

  // Crowd murmur: pink noise -> bandpass 340Hz -> lowpass 950Hz with slow 0.11Hz breath LFO
  const pinkSrc = ctx.createBufferSource()
  pinkSrc.buffer = createSeamlessPinkBuffer(ctx, 4)
  pinkSrc.loop = true

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 340
  bp.Q.value = 0.85

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 950

  const crowdGain = ctx.createGain()
  crowdGain.gain.value = 0.45

  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.11
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.12
  lfo.connect(lfoGain)
  lfoGain.connect(crowdGain.gain)

  pinkSrc.connect(bp)
  bp.connect(lp)
  lp.connect(crowdGain)
  crowdGain.connect(master)

  // Open-bowl depth air: brown noise -> lowpass 180Hz
  const brownSrc = ctx.createBufferSource()
  brownSrc.buffer = createSeamlessBrownBuffer(ctx, 4)
  brownSrc.loop = true

  const airLp = ctx.createBiquadFilter()
  airLp.type = 'lowpass'
  airLp.frequency.value = 180

  const airGain = ctx.createGain()
  airGain.gain.value = 0.22

  brownSrc.connect(airLp)
  airLp.connect(airGain)
  airGain.connect(master)

  pinkSrc.start()
  brownSrc.start()
  lfo.start()

  nodes = { ctx, master }
  return nodes
}

export function setStadiumAudio(enabled: boolean, active: boolean) {
  const shouldPlay = enabled && active
  if (!nodes && !shouldPlay) return
  const audio = nodes ?? initAudio()
  if (!audio) return

  const { ctx, master } = audio
  const now = ctx.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)

  if (shouldPlay) {
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    master.gain.linearRampToValueAtTime(0.55, now + 0.6)
  } else {
    master.gain.linearRampToValueAtTime(0.0001, now + 0.35)
  }
}
