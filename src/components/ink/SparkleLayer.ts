/**
 * SparkleLayer — the magical "fairy dust" effect that floats over the ink.
 *
 * This class owns ONE transparent overlay canvas and a single
 * `requestAnimationFrame` loop. It never owns the actual strokes — those live
 * in StrokeEngine. Responsibilities:
 *
 *   1. A soft glowing point that follows the pen tip while writing. The glow
 *      gently pulses (alpha oscillation) so it feels alive, not static.
 *   2. Sparkle particles spawned near the moving pen tip. Each particle drifts
 *      gently upward, rotates slightly, and fades out over 0.3–0.6s before
 *      disappearing. The motion is calm — Disney fairy dust, not glitter.
 *
 * Design notes:
 *   - Particles are capped (~40 active) to protect 60 FPS on the 12" tablet.
 *   - The layer is cleared every frame; nothing persists here. The clean ink
 *     stroke underneath remains untouched.
 *   - When the pen lifts, `setPen(null)` and the glow/sparkles fade out
 *     naturally within the lifetime bound.
 */

interface Sparkle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // remaining, seconds
  maxLife: number
  size: number
  rot: number
  vrot: number
  hue: number // slight color variation within the purple family
}

interface PenTip {
  x: number
  y: number
  active: boolean
}

const MAX_PARTICLES = 40
const PARTICLE_MIN_LIFE = 0.3
const PARTICLE_MAX_LIFE = 0.6

export class SparkleLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId = 0
  private lastTs = 0
  private running = false

  private pen: PenTip | null = null
  private penVisible = false // fades out after lift
  private penAlpha = 0
  private lastSpawnTs = 0
  private pulsePhase = 0

  private particles: Sparkle[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('SparkleLayer: 2D context unavailable')
    this.ctx = ctx
  }

  /** Begin the rAF render loop (idempotent). */
  start(): void {
    if (this.running) return
    this.running = true
    this.lastTs = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Stop the loop and clear the overlay. */
  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.particles = []
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Report the current pen position (or null when not writing). */
  setPen(x: number | null, y: number | null, active: boolean): void {
    if (x === null || y === null) {
      this.pen = null
      return
    }
    this.pen = { x, y, active }
    if (active) {
      this.penVisible = true
      this.maybeSpawn(x, y)
    }
  }

  /** Fade out the glow now that the pen has lifted. */
  releasePen(): void {
    if (this.pen) this.pen.active = false
  }

  private maybeSpawn(x: number, y: number): void {
    const now = performance.now()
    // Throttle spawning so bursts stay calm and bounded.
    if (now - this.lastSpawnTs < 28) return
    this.lastSpawnTs = now

    // Only spawn while there is headroom.
    if (this.particles.length >= MAX_PARTICLES) return

    // Spawn 1–2 particles per tick, jittered around the tip.
    const count = 1 + (Math.random() < 0.5 ? 1 : 0)
    for (let i = 0; i < count; i++) this.spawnOne(x, y)
  }

  private spawnOne(x: number, y: number): void {
    const maxLife = PARTICLE_MIN_LIFE + Math.random() * (PARTICLE_MAX_LIFE - PARTICLE_MIN_LIFE)
    const angle = Math.random() * Math.PI * 2
    const speed = 6 + Math.random() * 18 // px/sec, gentle drift
    this.particles.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 8, // bias upward so they float up
      life: maxLife,
      maxLife,
      size: 1.5 + Math.random() * 2.5,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 3,
      // Purple family: 260–290 hue (violet→lavender). Occasionally a warm sparkle.
      hue: Math.random() < 0.85 ? 255 + Math.random() * 40 : 45 + Math.random() * 20,
    })
  }

  private tick = (ts: number): void => {
    if (!this.running) return
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05) // clamp delta to avoid jumps
    this.lastTs = ts

    // Update pulse / glow alpha. The glow softly pulses while active.
    this.pulsePhase += dt * 4
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.pulsePhase))

    if (this.pen?.active) {
      // Ramp the glow up quickly while writing.
      this.penAlpha = Math.min(1, this.penAlpha + dt * 6)
    } else {
      // Fade out smoothly after the pen lifts.
      this.penAlpha = Math.max(0, this.penAlpha - dt * 3)
      if (this.penAlpha <= 0) this.penVisible = false
    }

    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Draw & update particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      // Drift with a slight deceleration so they "linger".
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.96
      p.vy = p.vy * 0.96 - 6 * dt // gentle continued upward buoyancy
      p.rot += p.vrot * dt

      const t = p.life / p.maxLife // 1 → 0
      const alpha = t * t // ease-out fade
      const size = p.size * (0.4 + 0.6 * t)

      this.drawSparkle(p.x, p.y, size, alpha * 0.9, p.hue, p.rot)
    }

    // Draw the pen-tip glow on top of particles for that "magical ink" feel.
    if (this.penVisible && this.pen) {
      this.drawPenGlow(this.pen.x, this.pen.y, this.penAlpha * pulse)
    }

    // Keep the loop alive while there is anything to render.
    if (this.running && (this.particles.length > 0 || this.penVisible)) {
      this.rafId = requestAnimationFrame(this.tick)
    } else {
      this.running = false
      this.rafId = 0
    }
  }

  private drawSparkle(
    x: number,
    y: number,
    size: number,
    alpha: number,
    hue: number,
    rot: number,
  ): void {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.globalAlpha = alpha

    // Soft core.
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3)
    grad.addColorStop(0, `hsla(${hue}, 100%, 85%, 1)`)
    grad.addColorStop(0.4, `hsla(${hue}, 100%, 70%, 0.5)`)
    grad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, size * 3, 0, Math.PI * 2)
    ctx.fill()

    // Four-point sparkle cross for a touch of "twinkle".
    ctx.globalAlpha = alpha * 0.8
    ctx.strokeStyle = `hsla(${hue}, 100%, 92%, 1)`
    ctx.lineWidth = size * 0.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-size * 2.2, 0)
    ctx.lineTo(size * 2.2, 0)
    ctx.moveTo(0, -size * 2.2)
    ctx.lineTo(0, size * 2.2)
    ctx.stroke()

    ctx.restore()
  }

  private drawPenGlow(x: number, y: number, alpha: number): void {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    const r = 26
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(190, 170, 255, 0.9)')
    grad.addColorStop(0.3, 'rgba(156, 123, 255, 0.45)')
    grad.addColorStop(1, 'rgba(109, 94, 248, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
