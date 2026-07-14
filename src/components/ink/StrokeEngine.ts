/**
 * StrokeEngine — the persistent, clean ink layer.
 *
 * Owns one canvas and renders premium pen strokes. Sits *under* the
 * SparkleLayer overlay. Responsibilities:
 *
 *   - Smooth raw pointer input into flowing strokes via quadratic Bézier
 *     interpolation through midpoints (the classic "perfect-freehand"-style
 *     smoothing). Eliminates jagged edges from finger input.
 *   - Variable stroke width derived from velocity AND pressure (where the
 *     device reports it), giving natural taper at stroke ends.
 *   - Anti-aliased, round caps/joins for a premium pen look.
 *   - Undo / redo of whole strokes, and clear.
 *   - Export the canvas as a PNG data URL (used to store signature +
 *     handwritten comments in Firebase Storage).
 *
 * Rendering strategy:
 *   - During an active stroke we draw only the *new* Bézier segment each
 *     pointermove (fast, no full redraw).
 *   - On undo/redo we re-render every committed stroke from scratch so the
 *     stacks stay visually correct.
 */

export interface InkPoint {
  x: number
  y: number
  /** Normalized pressure 0..1 (devices that report 0 are treated as ~0.5). */
  p: number
  /** Timestamp (ms) — used for velocity. */
  t: number
}

export interface Stroke {
  points: InkPoint[]
  /** RGB color string, e.g. "#111". */
  color: string
  /** Base width in CSS px before pressure/velocity modulation. */
  baseWidth: number
}

/**
 * Serializable snapshot of the canvas's strokes — for the celebration
 * signature-replay animation. Dimensions are CSS px relative to the source
 * canvas (the replay scales them to its own surface).
 */
export interface SerializedPoint {
  x: number
  y: number
  /** normalized pressure 0..1 */
  p: number
  /** original draw timestamp (ms) — drives the replay velocity curve */
  t: number
}
export interface SerializedStroke {
  baseWidth: number
  points: SerializedPoint[]
}
export interface SerializedStrokes {
  width: number
  height: number
  strokes: SerializedStroke[]
}

interface StrokeEngineOptions {
  color?: string
  baseWidth?: number
  /** Smooths width across this many recent points (larger = smoother). */
  smoothing?: number
}

const DEFAULT_COLOR = '#111827' // near-black, premium ink
const DEFAULT_WIDTH = 3
const DEFAULT_SMOOTHING = 5
const MIN_WIDTH = 2.4
const MAX_WIDTH = 11
const VELOCITY_WIDTH_K = 0.09 // lower = speed thins the stroke less (bolder)

export class StrokeEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  color = DEFAULT_COLOR
  baseWidth = DEFAULT_WIDTH
  smoothing = DEFAULT_SMOOTHING

  private strokes: Stroke[] = []
  private redoStack: Stroke[] = []
  private current: Stroke | null = null
  /**
   * True when an image was imported via `loadImage()` (used by the full-view
   * modal to transfer ink back to the inline canvas). Treated as ink presence
   * so validation + the placeholder hint behave correctly.
   */
  private hasExternalImage = false

  constructor(canvas: HTMLCanvasElement, options: StrokeEngineOptions = {}) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('StrokeEngine: 2D context unavailable')
    this.ctx = ctx
    if (options.color !== undefined) this.color = options.color
    if (options.baseWidth !== undefined) this.baseWidth = options.baseWidth
    if (options.smoothing !== undefined) this.smoothing = options.smoothing
  }

  /** True if there are any committed or in-progress strokes, or an imported image. */
  hasInk(): boolean {
    return this.strokes.length > 0 || this.current !== null || this.hasExternalImage
  }

  /** Total committed strokes (excludes the live one). */
  strokeCount(): number {
    return this.strokes.length
  }

  canUndo(): boolean {
    return this.strokes.length > 0 || this.current !== null
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Begin a new stroke at the given point. */
  beginStroke(x: number, y: number, pressure: number): void {
    const p = this.normalizePressure(pressure)
    this.current = {
      points: [{ x, y, p, t: performance.now() }],
      color: this.color,
      baseWidth: this.baseWidth,
    }
    // Clear redo history once a new stroke begins.
    this.redoStack = []
    // Draw a starting dot so a tap registers as ink.
    this.drawDot(x, y, this.widthFor(this.current, 0))
  }

  /** Extend the current stroke. Coalesced events should call this per-point. */
  extendStroke(x: number, y: number, pressure: number): void {
    if (!this.current) return
    const pts = this.current.points
    const p = this.normalizePressure(pressure)
    const now = performance.now()
    pts.push({ x, y, p, t: now })

    // We need at least 4 points to draw a smoothed quadratic segment using
    // the midpoint technique. Below that, draw a simple quadratic to the
    // midpoint of the last two points.
    const n = pts.length
    if (n < 4) {
      if (n >= 2) {
        const p0 = pts[n - 2]
        const p1 = pts[n - 1]
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
        const w = this.widthFor(this.current, n - 1)
        this.drawSegment(p0, mid, p0, w, this.current.color)
      }
      return
    }

    // Quadratic Bézier through midpoints:
    //   - control point = pts[n-3] (the "anchor" we just passed)
    //   - from = midpoint(pts[n-3], pts[n-2])
    //   - to   = midpoint(pts[n-2], pts[n-1])
    const b = pts[n - 3]
    const c = pts[n - 2]
    const d = pts[n - 1]
    const from = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
    const to = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
    const w = this.widthFor(this.current, n - 2)
    this.drawSegment(from, to, b, w, this.current.color)
  }

  /** Finish the current stroke and commit it to the undo stack. */
  endStroke(): void {
    if (!this.current) return
    // Final segment: draw from the last midpoint straight to the last point
    // so the stroke terminates exactly where the pen lifted.
    const pts = this.current.points
    const n = pts.length
    if (n >= 3) {
      const b = pts[n - 2]
      const c = pts[n - 1]
      const from = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
      const w = this.widthFor(this.current, n - 1)
      this.drawSegment(from, c, b, w, this.current.color)
    }
    this.strokes.push(this.current)
    this.current = null
  }

  /** Abort the in-progress stroke without committing it (e.g. pointercancel). */
  cancelStroke(): void {
    this.current = null
    this.repaint()
  }

  /** Undo the last committed stroke (moves it to the redo stack). */
  undo(): void {
    if (this.strokes.length === 0) {
      // If there's a live stroke, drop it instead.
      this.current = null
      this.repaint()
      return
    }
    const last = this.strokes.pop()
    if (last) this.redoStack.push(last)
    this.repaint()
  }

  /** Redo the most recently undone stroke. */
  redo(): void {
    const stroke = this.redoStack.pop()
    if (!stroke) return
    this.strokes.push(stroke)
    this.repaint()
  }

  /** Remove all strokes and clear the canvas. */
  clear(): void {
    this.strokes = []
    this.redoStack = []
    this.current = null
    this.hasExternalImage = false
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Export the canvas as a PNG data URL (transparent background). */
  toDataURL(): string {
    return this.canvas.toDataURL('image/png')
  }

  /**
   * Serialize the current strokes (committed + the in-progress one) for replay
   * animation. Points keep their original x/y (in CSS px relative to the
   * canvas), pressure, and timestamp (ms) — the timestamp drives the replay's
   * velocity curve so it re-traces HOW the visitor actually signed.
   */
  getStrokes(): SerializedStrokes {
    const all: SerializedStroke[] = [...this.strokes]
    if (this.current && this.current.points.length > 0) {
      all.push(this.current)
    }
    return {
      width: this.canvas.clientWidth || this.canvas.width,
      height: this.canvas.clientHeight || this.canvas.height,
      strokes: all.map((s) => ({
        baseWidth: s.baseWidth,
        points: s.points.map((p) => ({ x: p.x, y: p.y, p: p.p, t: p.t })),
      })),
    }
  }

  /** Export with a white background (nicer for archival/printing). */
  toDataURLWhiteBg(): string {
    const { canvas } = this
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const octx = out.getContext('2d')
    if (!octx) return canvas.toDataURL('image/png')
    octx.fillStyle = '#ffffff'
    octx.fillRect(0, 0, out.width, out.height)
    octx.drawImage(canvas, 0, 0)
    return out.toDataURL('image/png')
  }

  /**
   * Replace the canvas contents with an imported image (PNG data URL). Used by
   * the full-view modal to transfer ink back to the inline canvas. Clears any
   * previously drawn strokes first; the image is drawn at raw buffer resolution
   * so it matches the source canvas exactly.
   *
   * The undo stack is reset (an imported image is treated as a fresh base).
   */
  async loadImage(dataUrl: string): Promise<void> {
    this.strokes = []
    this.redoStack = []
    this.current = null
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!dataUrl) {
      this.hasExternalImage = false
      return
    }
    this.hasExternalImage = true
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Reset the transform: the context is normally DPR-scaled for CSS
        // coordinates, but here we want to fill exactly the buffer pixels.
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        ctx.restore()
        resolve()
      }
      img.onerror = () => reject(new Error('StrokeEngine.loadImage: image failed to load'))
      img.src = dataUrl
    })
  }

  // ── internal rendering ─────────────────────────────────────────

  private normalizePressure(p: number): number {
    // Many touch devices report 0 pressure; treat that as a neutral 0.5.
    if (!p || p <= 0) return 0.5
    return Math.min(Math.max(p, 0.05), 1)
  }

  /**
   * Compute the stroke width at a given point based on pressure and velocity.
   * Slower / harder = thicker; faster / lighter = thinner.
   */
  private widthFor(stroke: Stroke, index: number): number {
    const pts = stroke.points
    const p = pts[index]
    // Velocity from the previous point.
    let velocity = 0
    if (index > 0) {
      const prev = pts[index - 1]
      const d = Math.hypot(p.x - prev.x, p.y - prev.y)
      const dt = Math.max(p.t - prev.t, 1)
      velocity = d / dt // px / ms
    }
    // Pressure contribution (0.4..1.0 of base).
    const pressureFactor = 0.4 + 0.6 * p.p
    // Velocity thinning (clamped).
    const velocityFactor = 1 / (1 + velocity * VELOCITY_WIDTH_K)
    let w = stroke.baseWidth * pressureFactor * velocityFactor
    // Smooth across a small window so width doesn't jump on jittery input.
    const win = Math.min(this.smoothing, index, pts.length - index - 1)
    if (win > 0) {
      let sum = w
      let count = 1
      for (let k = 1; k <= win; k++) {
        const nb = index - k
        if (nb < 0) break
        sum += this.rawWidthAt(stroke, nb)
        count++
      }
      w = sum / count
    }
    return Math.min(Math.max(w, MIN_WIDTH), MAX_WIDTH)
  }

  private rawWidthAt(stroke: Stroke, index: number): number {
    const pts = stroke.points
    const p = pts[index]
    let velocity = 0
    if (index > 0) {
      const prev = pts[index - 1]
      const d = Math.hypot(p.x - prev.x, p.y - prev.y)
      const dt = Math.max(p.t - prev.t, 1)
      velocity = d / dt
    }
    const pressureFactor = 0.4 + 0.6 * p.p
    const velocityFactor = 1 / (1 + velocity * VELOCITY_WIDTH_K)
    return Math.min(
      Math.max(stroke.baseWidth * pressureFactor * velocityFactor, MIN_WIDTH),
      MAX_WIDTH,
    )
  }

  private drawDot(x: number, y: number, width: number): void {
    const { ctx } = this
    ctx.save()
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(x, y, width / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /**
   * Draw a smoothed quadratic segment from `from` to `to`, using `cp` as the
   * Bézier control point, at the precomputed `width` and `color`.
   *
   * Width is resolved by the caller via `widthFor(stroke, anchorIndex)` so we
   * avoid fragile point-reference lookups (computed midpoints have no entry in
   * the points array).
   */
  private drawSegment(
    from: { x: number; y: number },
    to: { x: number; y: number },
    cp: { x: number; y: number },
    width: number,
    color: string,
  ): void {
    const { ctx } = this
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo(cp.x, cp.y, to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }

  /** Re-render every committed stroke from scratch (used after undo/redo). */
  private repaint(): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of this.strokes) {
      this.renderStroke(stroke)
    }
  }

  private renderStroke(stroke: Stroke): void {
    const pts = stroke.points
    if (pts.length === 0) return
    this.drawDot(pts[0].x, pts[0].y, this.widthFor(stroke, 0))
    if (pts.length < 4) {
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1]
        const p1 = pts[i]
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
        const w = this.widthFor(stroke, i)
        this.drawSegment(p0, mid, p0, w, stroke.color)
      }
      return
    }
    for (let i = 3; i < pts.length; i++) {
      const b = pts[i - 2]
      const c = pts[i - 1]
      const d = pts[i]
      const from = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
      const to = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
      const w = this.widthFor(stroke, i - 1)
      this.drawSegment(from, to, b, w, stroke.color)
    }
    // Final tail to the last point.
    const n = pts.length
    if (n >= 2) {
      const b = pts[n - 2]
      const c = pts[n - 1]
      const from = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
      const w = this.widthFor(stroke, n - 1)
      this.drawSegment(from, c, b, w, stroke.color)
    }
  }
}
