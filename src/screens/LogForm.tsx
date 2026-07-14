import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Keyboard, PenLine, Check } from 'lucide-react'
import { formSchema, POSITION_OPTIONS, type FormValues } from '@/lib/validation'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { StarRating } from '@/components/ui/StarRating'
import { VisitorCounter } from '@/components/ui/VisitorCounter'
import { InkCanvas, type InkCanvasHandle } from '@/components/ink/InkCanvas'
import { SignaturePad, type SignaturePadHandle } from '@/components/ink/SignaturePad'
import { InkFullViewModal } from '@/components/ink/InkFullViewModal'
import type { SerializedStrokes } from '@/components/ink/StrokeEngine'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** Submitted payload handed up to App for Firebase persistence. */
export interface SubmitPayload {
  name: string
  institution: string
  position: FormValues['position']
  email: string
  phone: string
  typedComment: string
  /** PNG data URL of the handwritten comment (empty if none). */
  handwrittenCommentImage: string
  /** PNG data URL of the signature. */
  signatureImage: string
  /** Serialized signature strokes for the celebration replay (empty if none). */
  signatureStrokes?: SerializedStrokes
  rating: number
  consent: boolean
}

interface LogFormProps {
  visitorNumber: number
  submitting: boolean
  onSubmit: (payload: SubmitPayload) => Promise<void>
}

type CommentMode = 'type' | 'write'

export function LogForm({ visitorNumber, submitting, onSubmit }: LogFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      institution: '',
      position: undefined,
      email: '',
      phone: '',
      typedComment: '',
      rating: 0,
      consent: false as unknown as true,
    },
  })

  const [commentMode, setCommentMode] = useState<CommentMode>('type')
  const [hasHandwriting, setHasHandwriting] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [rating, setRating] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Full-view modal state. `modalTarget` selects which pad to return the ink to.
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTarget, setModalTarget] = useState<'comment' | 'signature'>('comment')
  const [modalSeed, setModalSeed] = useState('')

  const inkRef = useRef<InkCanvasHandle>(null)
  const sigRef = useRef<SignaturePadHandle>(null)

  const typedComment = watch('typedComment') ?? ''

  const openCommentModal = (currentInk: string) => {
    setModalTarget('comment')
    setModalSeed(currentInk)
    setModalOpen(true)
  }
  const openSignatureModal = (currentInk: string) => {
    setModalTarget('signature')
    setModalSeed(currentInk)
    setModalOpen(true)
  }
  const handleModalDone = async (dataUrl: string) => {
    setModalOpen(false)
    if (modalTarget === 'comment') {
      await inkRef.current?.loadImage(dataUrl)
    } else {
      await sigRef.current?.loadImage(dataUrl)
    }
  }
  const handleModalCancel = () => setModalOpen(false)

  const processSubmit = async (values: FormValues): Promise<void> => {
    setSubmitError(null)

    // Cross-field rule: at least one comment method.
    const hasTyped = !!values.typedComment && values.typedComment.trim().length > 0
    if (!hasTyped && !hasHandwriting) {
      setSubmitError('Please type a comment or write one on the canvas.')
      return
    }
    if (!hasSignature) {
      setSubmitError('Please add your signature before submitting.')
      return
    }

    const handwrittenCommentImage = hasHandwriting
      ? (inkRef.current?.toDataURLWhiteBg() ?? '')
      : ''
    const signatureImage = sigRef.current?.toDataURL() ?? ''
    // Capture serialized strokes for the celebration replay animation.
    const signatureStrokes =
      sigRef.current?.getStrokes() ?? undefined

    await onSubmit({
      name: values.name,
      institution: values.institution,
      position: values.position,
      email: values.email ?? '',
      phone: values.phone ?? '',
      typedComment: values.typedComment ?? '',
      handwrittenCommentImage,
      signatureImage,
      signatureStrokes,
      rating,
      consent: !!values.consent,
    })
  }

  const onError = (): void => {
    setSubmitError('Please complete the required fields before submitting.')
    sound.play('click')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-dvh w-full items-start justify-center px-4 pb-8 pt-24 sm:px-6 sm:pt-28"
    >
      <GlassCard
        elevated
        className="w-full max-w-3xl px-6 py-8 sm:px-10 sm:py-10"
      >
        {/* Header + visitor counter */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-cursive text-4xl leading-none text-brand-700 sm:text-5xl">
              Sign the Guestbook
            </h2>
            <p className="mt-1 text-sm text-electric-500">Your feedback means a lot to us.</p>
          </div>
          <VisitorCounter value={visitorNumber} variant="banner" />
        </div>

        <form onSubmit={handleSubmit(processSubmit, onError)} className="space-y-6">
          {/* Name + Institution row */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message} required>
              <input
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                className={inputClass(!!errors.name)}
                {...register('name')}
              />
            </Field>
            <Field label="Institution / School" error={errors.institution?.message} required>
              <input
                type="text"
                placeholder="e.g. Universiti Malaya"
                className={inputClass(!!errors.institution)}
                {...register('institution')}
              />
            </Field>
          </div>

          {/* Position + (email or phone) */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Position" error={errors.position?.message} required>
              <div className="relative">
                <select
                  className={cn(inputClass(!!errors.position), 'appearance-none pr-10')}
                  defaultValue=""
                  {...register('position')}
                >
                  <option value="" disabled>
                    Select your position
                  </option>
                  {POSITION_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-400">
                  ▾
                </span>
              </div>
            </Field>
            <Field label="Email (optional)" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                className={inputClass(!!errors.email)}
                {...register('email')}
              />
            </Field>
          </div>

          {/* Phone — own row since it's short */}
          <Field label="Phone (optional)" error={errors.phone?.message}>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="012-345 6789"
              className={cn(inputClass(!!errors.phone), 'sm:max-w-xs')}
              {...register('phone')}
            />
          </Field>

          {/* Comment section: Type | Write toggle */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-electric-700">
                Comment / Feedback
              </label>
              <div className="flex rounded-full border border-white/40 bg-white/50 p-1 backdrop-blur-md">
                <ModeButton
                  active={commentMode === 'type'}
                  onClick={() => {
                    sound.play('click')
                    setCommentMode('type')
                  }}
                >
                  <Keyboard className="h-4 w-4" />
                  Type
                </ModeButton>
                <ModeButton
                  active={commentMode === 'write'}
                  onClick={() => {
                    sound.play('click')
                    setCommentMode('write')
                  }}
                >
                  <PenLine className="h-4 w-4" />
                  Write
                </ModeButton>
              </div>
            </div>

            {commentMode === 'type' ? (
              <textarea
                rows={5}
                placeholder="Share your thoughts, suggestions or appreciation..."
                className={cn(inputClass(false), 'min-h-[140px] resize-y')}
                {...register('typedComment')}
              />
            ) : (
              <InkCanvas
                ref={inkRef}
                label="Handwritten comment"
                placeholder="Write your comment…"
                className="h-56"
                onInkChange={setHasHandwriting}
                expandable
                onExpand={openCommentModal}
              />
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              {commentMode === 'type'
                ? 'Or switch to "Write" to handwrite your comment.'
                : 'Or switch to "Type" to use the keyboard.'}
              {!typedComment && !hasHandwriting && (
                <span className="text-rose-400"> At least one comment is required.</span>
              )}
            </p>
          </div>

          {/* Signature — always available, required */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Signature <span className="text-rose-400">*</span>
            </label>
            <SignaturePad
              ref={sigRef}
              onChange={setHasSignature}
              onExpand={openSignatureModal}
            />
            {!hasSignature && (
              <p className="mt-1.5 text-xs text-rose-400">A signature is required.</p>
            )}
          </div>

          {/* Rating — optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gold-600">
              Rating <span className="text-slate-400">(optional)</span>
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Consent — required */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/40 bg-white/40 p-4 backdrop-blur-sm">
            <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-brand-300 bg-white checked:border-brand-500 checked:bg-brand-gradient"
                {...register('consent')}
              />
              <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
            </span>
            <span className="text-sm text-slate-600">
              I agree that my feedback may be used for academic documentation.
            </span>
          </label>
          {errors.consent && (
            <p className="-mt-3 text-xs text-rose-400">{errors.consent.message}</p>
          )}

          {/* Submit error */}
          {submitError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600"
            >
              {submitError}
            </motion.p>
          )}

          {/* Submit */}
          <div className="flex justify-center pt-2">
            <GlowButton
              type="submit"
              loading={submitting}
              className="px-12 py-5 text-lg"
            >
              Submit
            </GlowButton>
          </div>
        </form>
      </GlassCard>

      {/* Fullscreen writing modal — gives the visitor room to write a comment
          or signature without any clipping. Ink transfers back on "Done". */}
      <InkFullViewModal
        open={modalOpen}
        title={modalTarget === 'comment' ? 'Handwritten Comment' : 'Signature'}
        initialInkDataUrl={modalSeed}
        signatureStyle={modalTarget === 'signature'}
        baseWidth={modalTarget === 'signature' ? 5.5 : 3.2}
        placeholder={modalTarget === 'comment' ? 'Write your comment…' : 'Sign here…'}
        onDone={handleModalDone}
        onCancel={handleModalCancel}
      />
    </motion.div>
  )
}

// ── small presentational helpers ────────────────────────────────

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-brand-gradient text-white shadow-sm' : 'text-brand-600 hover:bg-white/60',
      )}
    >
      {children}
    </motion.button>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'w-full rounded-2xl border bg-white/70 px-4 py-3 text-base text-slate-800 shadow-sm outline-none backdrop-blur-sm transition-colors placeholder:text-slate-400',
    'focus:border-brand-400 focus:ring-4 focus:ring-brand-300/30',
    hasError ? 'border-rose-300' : 'border-white/50',
  )
}
