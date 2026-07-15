import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Scale, Check, ShieldCheck, Undo2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { StarRating } from '@/components/ui/StarRating'
import { NeonSignature } from '@/components/ui/NeonSignature'
import { PasswordModal } from '@/components/ui/PasswordModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/ink/SignaturePad'
import { InkFullViewModal } from '@/components/ink/InkFullViewModal'
import { SignatureReplay } from '@/components/ink/SignatureReplay'
import type { SerializedStrokes } from '@/components/ink/StrokeEngine'
import { JUDGE_NAMES } from '@/lib/judges'
import {
  saveJudgeAssessmentsBatch,
  clearLatestJudgeAssessmentSession,
  type JudgeAssessmentInput,
  type JudgeAssessment,
} from '@/firebase/visitors'
import { sound } from '@/lib/sound'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

const KEYWORD = 'inspira'

interface JudgeSlotState {
  judgeName: string
  rating: number
  comment: string
  hasSignature: boolean
}

const emptySlot = (): JudgeSlotState => ({
  judgeName: '',
  rating: 0,
  comment: '',
  hasSignature: false,
})

interface JudgeAssessmentScreenProps {
  /** The latest assessment session if one exists — when non-null, render the
   *  certificate view instead of the form. */
  assessed: JudgeAssessment[] | null
  /** Call after submit or undo so App re-fetches the assessment state. */
  onAssessedChange: () => void
}

/**
 * Judge assessment screen — two modes:
 *
 *  1. **Form** (when `assessed` is null): 3 glass cards for judges to fill out
 *     (name + rating + comment + signature), an "inspira" keyword gate before
 *     the Submit button unlocks, a simultaneous 3-signature replay on success.
 *
 *  2. **Certificate** (when `assessed` is non-null): a read-only certificate
 *     card showing the 3 judges' names, ratings, comments, neon signatures,
 *     and the assessment date. An "Undo Assessment" button (password-gated
 *     via PasswordModal → ConfirmModal) deletes the session from Firestore
 *     so the form can be re-filled.
 */
export function JudgeAssessmentScreen({
  assessed,
  onAssessedChange,
}: JudgeAssessmentScreenProps) {
  const toast = useToast()
  const [slots, setSlots] = useState<JudgeSlotState[]>([
    emptySlot(),
    emptySlot(),
    emptySlot(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [replayStrokes, setReplayStrokes] = useState<
    (SerializedStrokes | null)[]
  >([null, null, null])

  // Undo/delete modal state.
  const [undoPasswordOpen, setUndoPasswordOpen] = useState(false)
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)

  const sigRefs = useRef<(SignaturePadHandle | null)[]>([null, null, null])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSlot, setModalSlot] = useState(0)
  const [modalSeed, setModalSeed] = useState('')

  const updateSlot = (i: number, patch: Partial<JudgeSlotState>) => {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    )
  }

  const availableNames = (i: number): string[] => {
    const taken = new Set(
      slots.filter((_, idx) => idx !== i).map((s) => s.judgeName),
    )
    return JUDGE_NAMES.filter((n) => !taken.has(n))
  }

  const openModal = (slotIdx: number) => {
    setModalSlot(slotIdx)
    setModalSeed(sigRefs.current[slotIdx]?.toDataURL() ?? '')
    setModalOpen(true)
  }

  const handleModalDone = async (dataUrl: string) => {
    setModalOpen(false)
    await sigRefs.current[modalSlot]?.loadImage(dataUrl)
    updateSlot(modalSlot, { hasSignature: !!sigRefs.current[modalSlot]?.hasInk() })
  }

  const handleSubmit = async () => {
    setError(null)
    sound.play('click')

    const partial = slots.find(
      (s) => (s.judgeName && !s.hasSignature) || (!s.judgeName && s.hasSignature),
    )
    if (partial) {
      setError(
        'Each card needs both a name and a signature (or be left empty). Please complete or clear the partial card.',
      )
      return
    }

    const filled = slots.filter((s) => s.judgeName && s.hasSignature)
    if (filled.length === 0) {
      setError('Please fill at least one judge assessment (name + signature) before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const inputs: JudgeAssessmentInput[] = []
      slots.forEach((s, idx) => {
        if (!s.judgeName || !s.hasSignature) return
        const sigRef = sigRefs.current[idx]
        inputs.push({
          judgeName: s.judgeName,
          rating: s.rating,
          comment: s.comment,
          signatureImage: sigRef?.toDataURL() ?? '',
          signatureStrokes: sigRef?.getStrokes() ?? undefined,
        })
      })
      await saveJudgeAssessmentsBatch(inputs)
      const captured = slots.map((s, idx) =>
        s.judgeName && s.hasSignature
          ? (sigRefs.current[idx]?.getStrokes() ?? null)
          : null,
      )
      setReplayStrokes(captured)
      sound.play('chime')
      setSuccess(true)
    } catch (err) {
      console.error('[saveJudgeAssessmentsBatch]', err)
      toast.push('Could not save the assessments. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // After the replay finishes, tell App to re-fetch → switches to certificate.
  const onReplayDone = () => {
    onAssessedChange()
  }

  // ── Undo flow: password → confirm → delete session ──
  const handleUndoConfirmed = async () => {
    setUndoConfirmOpen(false)
    setUndoing(true)
    try {
      await clearLatestJudgeAssessmentSession()
      toast.push('Assessment undone. You can re-assess.', 'success')
      onAssessedChange()
    } catch (err) {
      console.error('[clearLatestJudgeAssessmentSession]', err)
      toast.push('Could not undo the assessment. Please try again.', 'error')
    } finally {
      setUndoing(false)
    }
  }

  // ── Success / replay view ──
  if (success) {
    return (
      <ReplayView
        replayStrokes={replayStrokes}
        onDone={onReplayDone}
      />
    )
  }

  // ── Certificate view (assessment already submitted) ──
  if (assessed && assessed.length > 0) {
    return (
      <>
        <CertificateView
          assessments={assessed}
          onUndo={() => setUndoPasswordOpen(true)}
        />
        <PasswordModal
          open={undoPasswordOpen}
          title="Undo Assessment"
          onAuthorized={() => {
            setUndoPasswordOpen(false)
            setUndoConfirmOpen(true)
          }}
          onClose={() => setUndoPasswordOpen(false)}
        />
        <ConfirmModal
          open={undoConfirmOpen}
          title="Undo Assessment"
          message="This will permanently delete the current assessment record so it can be re-filled. This cannot be undone. Are you sure?"
          confirmLabel="Yes, undo"
          onConfirm={handleUndoConfirmed}
          onCancel={() => setUndoConfirmOpen(false)}
        />
        {undoing && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-brand-900/30 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </div>
        )}
      </>
    )
  }

  // ── Form view ──
  const keywordMatch = keyword.trim().toLowerCase() === KEYWORD

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-dvh w-full px-4 pb-16 pt-28 sm:px-6 sm:pt-32"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="font-cursive text-4xl leading-tight text-brand-700 sm:text-5xl">
            Impact &amp; Effectiveness Survey
          </h2>
          <p className="mt-3 text-xl font-semibold sm:text-2xl">
            <span className="text-gold-500">of the </span>
            <span className="text-brand-600">ESLessonCraftMY Teaching</span>
          </p>
          <p className="mt-3 text-sm text-electric-500">
            Select 3 judges from the panel. Each judge provides rating, comment
            (optional), and a signature.
          </p>
        </div>

        {/* 3-card grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {slots.map((slot, i) => (
            <JudgeCard
              key={i}
              slotNumber={i + 1}
              slot={slot}
              availableNames={availableNames(i)}
              sigRef={(el) => {
                sigRefs.current[i] = el
              }}
              onChange={(patch) => updateSlot(i, patch)}
              onSignatureChange={(hasInk) => updateSlot(i, { hasSignature: hasInk })}
              onExpand={() => openModal(i)}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-600"
          >
            {error}
          </motion.p>
        )}

        {/* Keyword gate + Submit */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="w-full max-w-sm">
            <label className="mb-1.5 block text-center text-xs font-semibold text-slate-600">
              Type <span className="font-bold text-brand-600">{KEYWORD}</span> to confirm submission
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={KEYWORD}
              className={cn(
                'w-full rounded-2xl border bg-white/70 px-4 py-2.5 text-center text-sm font-medium shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-4',
                keywordMatch
                  ? 'border-emerald-300 text-emerald-600 focus:ring-emerald-200/40'
                  : 'border-white/50 text-slate-800 focus:border-brand-400 focus:ring-brand-300/30',
              )}
            />
          </div>
          <GlowButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={!keywordMatch}
            className="px-12 py-5 text-lg disabled:opacity-40"
          >
            Submit Assessment
          </GlowButton>
          {!keywordMatch && (
            <p className="text-xs text-slate-400">
              The Submit button unlocks when you type the keyword.
            </p>
          )}
        </div>
      </div>

      {/* Fullscreen signature modal */}
      <InkFullViewModal
        open={modalOpen}
        title={`Judge ${modalSlot + 1} Signature`}
        initialInkDataUrl={modalSeed}
        signatureStyle
        baseWidth={5.5}
        placeholder="Sign here…"
        onDone={handleModalDone}
        onCancel={() => setModalOpen(false)}
      />
    </motion.div>
  )
}

// ── Replay view ────────────────────────────────────────────────────────────
function ReplayView({
  replayStrokes,
  onDone,
}: {
  replayStrokes: (SerializedStrokes | null)[]
  onDone: () => void
}) {
  // Auto-transition to the certificate after the replay has had time to play.
  // (The replays self-fade; we give them ~4.5s before switching.)
  const [transitioned, setTransitioned] = useState(false)
  if (!transitioned) {
    setTimeout(() => {
      setTransitioned(true)
      onDone()
    }, 4500)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6 }}
      className="flex min-h-dvh w-full items-center justify-center px-6 py-10"
    >
      {replayStrokes.map((s, i) =>
        s ? (
          <SignatureReplay
            key={i}
            strokes={s}
            region={{ widthFraction: 1 / 3, offsetFraction: i / 3 }}
          />
        ) : null,
      )}
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 1.2 }}
          className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-brand-gradient shadow-glow-lg"
        >
          <Scale className="h-14 w-14 text-white" strokeWidth={1.5} />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.7 }}
          className="font-cursive text-5xl text-brand-700 sm:text-6xl"
        >
          Thank You
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.7 }}
          className="mt-3 text-xl font-semibold text-brand-600 sm:text-2xl"
        >
          Your assessments have been recorded.
        </motion.p>
      </div>
    </motion.div>
  )
}

// ── Certificate view ────────────────────────────────────────────────────────
function CertificateView({
  assessments,
  onUndo,
}: {
  assessments: JudgeAssessment[]
  onUndo: () => void
}) {
  const date = assessments[0]?.timestamp
    ? new Date(assessments[0].timestamp)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-dvh w-full px-4 pb-16 pt-28 sm:px-6 sm:pt-32"
    >
      <div className="mx-auto max-w-5xl">
        <GlassCard elevated glow className="overflow-hidden p-8 sm:p-12">
          {/* Certificate header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-glow"
            >
              <ShieldCheck className="h-10 w-10" strokeWidth={1.5} />
            </motion.div>
            <h2 className="font-cursive text-4xl leading-tight text-brand-700 sm:text-5xl">
              Certificate of Assessment
            </h2>
            <p className="mt-2 text-sm text-electric-500">
              This confirms that ESLessonCraftMY has been formally assessed.
            </p>
            {date && (
              <p className="mt-1 text-xs text-slate-400">
                {date.toLocaleString()}
              </p>
            )}
          </div>

          {/* Assessor cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {assessments.map((a, i) => (
              <AssessorCard key={a.id} assessment={a} index={i} />
            ))}
          </div>

          {/* Undo button */}
          <div className="mt-8 flex justify-center">
            <GlowButton
              variant="ghost"
              onClick={onUndo}
              className="border-rose-200 px-8 py-3 text-rose-500"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo Assessment
            </GlowButton>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  )
}

function AssessorCard({
  assessment,
  index,
}: {
  assessment: JudgeAssessment
  index: number
}) {
  const [sigFailed, setSigFailed] = useState(false)

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/55 p-5 shadow-glass backdrop-blur-xl">
      {/* Badge + name */}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-semibold text-white">
          {index + 1}
        </span>
        <h4 className="text-sm font-semibold leading-tight text-brand-800">
          {assessment.judgeName}
        </h4>
      </div>

      {/* Rating */}
      {assessment.rating > 0 && <StarRating value={assessment.rating} />}

      {/* Comment */}
      {assessment.comment && (
        <p className="text-xs leading-relaxed text-slate-600">
          “{assessment.comment}”
        </p>
      )}

      {/* Signature — animated replay if strokes were captured, else static neon */}
      {assessment.signatureImage && !sigFailed ? (
        <div className="flex h-24 flex-1 items-center justify-center pt-2">
          {assessment.signatureStrokes ? (
            <SignatureReplay
              strokes={assessment.signatureStrokes}
              contained
              className="h-full w-full max-w-[14rem]"
            />
          ) : (
            <NeonSignature
              src={assessment.signatureImage}
              alt={`${assessment.judgeName}'s signature`}
              className="max-h-20 w-full max-w-[12rem] object-contain"
              onError={() => setSigFailed(true)}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── Form card (unchanged from before) ───────────────────────────────────────
interface JudgeCardProps {
  slotNumber: number
  slot: JudgeSlotState
  availableNames: string[]
  sigRef: (el: SignaturePadHandle | null) => void
  onChange: (patch: Partial<JudgeSlotState>) => void
  onSignatureChange: (hasInk: boolean) => void
  onExpand: () => void
}

function JudgeCard({
  slotNumber,
  slot,
  availableNames,
  sigRef,
  onChange,
  onSignatureChange,
  onExpand,
}: JudgeCardProps) {
  return (
    <GlassCard elevated className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-sm">
          {slotNumber}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-500">
          Judge {slotNumber}
        </h3>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Judge Name <span className="text-rose-400">*</span>
        </label>
        <div className="relative">
          <select
            value={slot.judgeName}
            onChange={(e) => onChange({ judgeName: e.target.value })}
            className={cn(
              'w-full appearance-none rounded-2xl border border-white/50 bg-white/70 px-3 py-2.5 pr-9 text-sm text-slate-800 shadow-sm outline-none transition-colors',
              'focus:border-brand-400 focus:ring-4 focus:ring-brand-300/30',
              !slot.judgeName && 'text-slate-400',
            )}
          >
            <option value="" disabled>
              Select a judge…
            </option>
            {availableNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {slot.judgeName && !availableNames.includes(slot.judgeName) && (
              <option value={slot.judgeName}>{slot.judgeName}</option>
            )}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-400">
            ▾
          </span>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gold-600">
          Rating <span className="text-slate-400">(optional)</span>
        </label>
        <StarRating value={slot.rating} onChange={(v) => onChange({ rating: v })} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-electric-700">
          Comment <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={slot.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder="Share your assessment…"
          className="w-full rounded-2xl border border-white/50 bg-white/70 px-3 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-300/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Signature <span className="text-rose-400">*</span>
        </label>
        <SignaturePad ref={sigRef} onChange={onSignatureChange} onExpand={onExpand} />
        {!slot.hasSignature && (
          <p className="mt-1.5 text-[11px] text-rose-400">A signature is required.</p>
        )}
      </div>

      {slot.judgeName && slot.hasSignature && (
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Ready to submit
        </div>
      )}
    </GlassCard>
  )
}
