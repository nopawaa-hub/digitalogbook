/**
 * Minimal WebAudio-synthesized UI sounds.
 *
 * No audio files needed — everything is generated procedurally so it stays
 * tiny and offline-friendly. Sounds are MUTED by default because an
 * exhibition booth is a shared acoustic space; visitors can toggle via the
 * header control.
 *
 *   - click:    short percussive blip on button presses
 *   - scribble: very soft filtered noise loop while the pen is down
 *   - chime:     gentle two-note rising arpeggio on success
 */

type SoundName = 'click' | 'scribble' | 'chime'

class SoundManager {
  private ctx: AudioContext | null = null
  private muted = true
  private scribbleNoise: { src: AudioBufferSourceNode; gain: GainNode } | null = null

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) this.stopScribble()
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** Lazily create the AudioContext (must follow a user gesture). */
  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    // Resume if the browser suspended us (autoplay policy).
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  play(name: SoundName): void {
    if (this.muted) return
    const ctx = this.ensureCtx()
    if (!ctx) return
    switch (name) {
      case 'click':
        this.playClick(ctx)
        break
      case 'chime':
        this.playChime(ctx)
        break
      case 'scribble':
        // scribble is handled as a continuous noise bed; start/stop explicitly
        break
    }
  }

  /** Start the soft writing ambience (idempotent). */
  startScribble(): void {
    if (this.muted) return
    const ctx = this.ensureCtx()
    if (!ctx || this.scribbleNoise) return

    // White noise buffer (~1s loop).
    const bufferSize = ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    // Low-pass to make it sound like soft pen friction, not static.
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900

    const gain = ctx.createGain()
    gain.gain.value = 0.0 // fade in smoothly
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.08)

    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
    this.scribbleNoise = { src, gain }
  }

  /** Stop the soft writing ambience with a short fade (idempotent). */
  stopScribble(): void {
    if (!this.ctx || !this.scribbleNoise) return
    const { src, gain } = this.scribbleNoise
    const now = this.ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.12)
    src.stop(now + 0.16)
    this.scribbleNoise = null
  }

  private playClick(ctx: AudioContext): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.14)
  }

  private playChime(ctx: AudioContext): void {
    // Gentle rising two-note arpeggio (C6 → E6 → G6).
    const notes = [1046.5, 1318.5, 1567.98]
    const start = ctx.currentTime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = start + i * 0.12
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.52)
    })
  }
}

// Singleton used across the app.
export const sound = new SoundManager()
