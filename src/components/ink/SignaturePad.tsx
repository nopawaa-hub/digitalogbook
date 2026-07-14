import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react'
import { InkCanvas, type InkCanvasHandle } from './InkCanvas'
import { sound } from '@/lib/sound'
import type { SerializedStrokes } from './StrokeEngine'

export interface SignaturePadHandle {
  clear: () => void
  hasInk: () => boolean
  /** PNG data URL (transparent bg) for storage upload. */
  toDataURL: () => string
  /** Replace canvas contents with an imported PNG data URL. */
  loadImage: (dataUrl: string) => Promise<void>
  /** Serialized strokes for the celebration replay animation. */
  getStrokes: () => SerializedStrokes
}

interface SignaturePadProps {
  onChange?: (hasInk: boolean) => void
  /** Fired when the expand button is tapped; parent opens the full view. */
  onExpand?: (currentInkDataUrl: string) => void
}

/**
 * Signature pad built on InkCanvas.
 *
 * Premium-touch details:
 *   - A faint signature baseline (×) so visitors know where to sign, like a
 *     real paper guestbook form.
 *   - Cursive placeholder ("Sign here…") in Great Vibes.
 *   - The magical glow trail comes from the SparkleLayer overlay; on pen-up it
 *     fades naturally (penAlpha ramps down), leaving the clean black ink
 *     signature underneath — matching the "glow → normal ink" spec.
 *   - Controls: Clear + Expand (opens a fullscreen writing surface so the
 *     signature never gets clipped).
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onChange, onExpand }, ref) {
    const innerRef = useRef<InkCanvasHandle>(null)

    useImperativeHandle(
      ref,
      (): SignaturePadHandle => ({
        clear: () => innerRef.current?.clear(),
        hasInk: () => !!innerRef.current?.hasInk(),
        toDataURL: () => innerRef.current?.toDataURL() ?? '',
        loadImage: async (dataUrl: string) => {
          await innerRef.current?.loadImage(dataUrl)
        },
        getStrokes: () =>
          innerRef.current?.getStrokes() ?? { width: 0, height: 0, strokes: [] },
      }),
      [],
    )

    const handleInkChange = useCallback(
      (hasInk: boolean) => {
        onChange?.(hasInk)
      },
      [onChange],
    )

    const handleExpand = useCallback(
      (currentInk: string) => {
        sound.play('click')
        onExpand?.(currentInk)
      },
      [onExpand],
    )

    return (
      <div className="relative">
        {/* Faint signature baseline */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-16 left-8 right-8 z-10 border-b border-brand-400/40"
        >
          <span className="absolute -bottom-5 left-0 text-[10px] uppercase tracking-wider text-brand-400/60">
            Signature
          </span>
        </div>

        <InkCanvas
          ref={innerRef}
          label={undefined}
          placeholder="Sign here…"
          baseWidth={5.5}
          color="#111827"
          signatureStyle
          showToolbar
          onInkChange={handleInkChange}
          onExpand={handleExpand}
          expandable
          className="h-52 sm:h-60"
        />
      </div>
    )
  },
)
