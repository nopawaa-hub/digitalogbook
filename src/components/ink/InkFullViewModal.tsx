import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { InkCanvas, type InkCanvasHandle } from './InkCanvas'
import { sound } from '@/lib/sound'

interface InkFullViewModalProps {
  open: boolean
  /** Title shown top-center, e.g. "Signature" or "Handwritten comment". */
  title: string
  /** The ink present when the expand button was tapped (to continue editing). */
  initialInkDataUrl: string
  /** Ink color / width — should match the source pad. */
  color?: string
  baseWidth?: number
  signatureStyle?: boolean
  placeholder?: string
  /** Called with the final canvas data URL when the visitor taps "Done". */
  onDone: (dataUrl: string) => void
  /** Called when dismissed without applying (X / backdrop). */
  onCancel: () => void
}

/**
 * Fullscreen writing modal with a blurred backdrop.
 *
 * The visitor gets a near-full-viewport canvas so there is plenty of room to
 * write a signature or comment with zero clipping. On "Done", the rendered
 * ink is returned to the parent (as a data URL) which loads it back onto the
 * small inline pad via StrokeEngine.loadImage().
 *
 * The modal mounts its own InkCanvas (separate engine instance) seeded with
 * `initialInkDataUrl` if the visitor had already started writing before
 * expanding — so the experience is "continue on a big surface" rather than
 * "start over".
 */
export function InkFullViewModal({
  open,
  title,
  initialInkDataUrl,
  color = '#111827',
  baseWidth = 3.4,
  signatureStyle = false,
  placeholder = 'Write here…',
  onDone,
  onCancel,
}: InkFullViewModalProps) {
  const canvasRef = useRef<InkCanvasHandle>(null)
  const [hadInitial] = useState(() => initialInkDataUrl.length > 0)

  // Seed the big canvas with the visitor's in-progress ink when the modal opens.
  useEffect(() => {
    if (!open || !initialInkDataUrl) return
    // Allow the canvas to mount + size before loading.
    const t = window.setTimeout(() => {
      void canvasRef.current?.loadImage(initialInkDataUrl)
    }, 80)
    return () => window.clearTimeout(t)
  }, [open, initialInkDataUrl])

  const handleDone = () => {
    sound.play('click')
    // Transparent PNG — NOT white-bg. A white background would break the neon
    // glow effect in the logs (drop-shadow would glow the rectangle, not the ink).
    const dataUrl = canvasRef.current?.toDataURL() ?? ''
    onDone(dataUrl)
  }

  const handleClear = () => {
    sound.play('click')
    canvasRef.current?.clear()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6"
        >
          {/* Blurred backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-brand-900/40 backdrop-blur-xl"
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative z-10 flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-4xl border border-white/40 bg-white/80 shadow-glass-lg backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/30 px-6 py-4">
              <h3 className="font-cursive text-3xl text-brand-700">{title}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  sound.play('click')
                  onCancel()
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Big writing surface */}
            <div className="flex min-h-0 flex-1 p-4">
              <InkCanvas
                ref={canvasRef}
                placeholder={placeholder}
                color={color}
                baseWidth={baseWidth}
                signatureStyle={signatureStyle}
                showToolbar={false}
                className="h-full w-full"
              />
            </div>

            {/* Footer controls */}
            <div className="flex items-center justify-between gap-3 border-t border-white/30 px-6 py-4">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-white/40 bg-white/60 px-5 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-white"
              >
                Clear
              </button>
              <p className="hidden text-xs text-brand-400 sm:block">
                {hadInitial ? 'Continue your writing, or start fresh.' : 'Write freely — nothing will be clipped.'}
              </p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.03 }}
                onClick={handleDone}
                className="flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-2.5 text-sm font-semibold text-white shadow-glow"
              >
                <Check className="h-4 w-4" />
                Done
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
