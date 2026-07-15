import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Scale, Check } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { StarRating } from '@/components/ui/StarRating'
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/ink/SignaturePad'
import { InkFullViewModal } from '@/components/ink/InkFullViewModal'
import { JUDGE_NAMES } from '@/lib/judges'
import { saveJudgeAssessmentsBatch, type JudgeAssessmentInput } from '@/firebase/visitors'
import { sound } from '@/lib/sound'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

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

/**
 * Judge assessment screen — three glass cards in a grid (3 columns on tablet,
 * stacks on smaller screens), one per judging slot.
 *
 * Each card contains:
 *   - A name selector (dropdown) listing the 9-judge pool, minus names already
 *     picked in the other cards (so each judge can be selected once across the
 *     3 slots).
 *   - Star rating (optional).
 *   - Comment textarea (optional).
 *   - Signature pad (required for an entry to be submitted).
 *
 * On submit, every card that has BOTH a name and a signature is saved into the
 * `judgeAssessments` Firestore collection (signature uploaded to Storage).
 * Cards that are entirely empty are skipped. A card with a name but no
 * signature (or vice versa) blocks submission with a clear error so judges
 * don't accidentally submit half-filled entries.
 */
export function JudgeAssessmentScreen() {
  const toast = useToast()
  const [slots, setSlots] = useState<JudgeSlotState[]>([
    emptySlot(),
    emptySlot(),
    emptySlot(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // One signature-pad ref per slot, plus modal wiring (same pattern as LogForm).
  const sigRefs = useRef<(SignaturePadHandle | null)[]>([null, null, null])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSlot, setModalSlot] = useState(0)
  const [modalSeed, setModalSeed] = useState('')

  /** Set one slot's field immutably. */
  const updateSlot = (i: number, patch: Partial<JudgeSlotState>) => {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    )
  }

  /** Names that are still available for a given slot (exclude the other slots). */
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

    // Validate: each card must be either entirely empty OR have both name + sig.
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
      sound.play('chime')
      setSuccess(true)
    } catch (err) {
      console.error('[saveJudgeAssessmentsBatch]', err)
      toast.push('Could not save the assessments. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSlots([emptySlot(), emptySlot(), emptySlot()])
    sigRefs.current.forEach((r) => r?.clear())
    setSuccess(false)
    setError(null)
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
        transition={{ duration: 0.6 }}
        className="flex min-h-dvh w-full items-center justify-center px-6 py-10"
      >
        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-brand-gradient shadow-glow-lg"
          >
            <Scale className="h-14 w-14 text-white" strokeWidth={1.5} />
          </motion.div>
          <h2 className="font-cursive text-5xl text-brand-700 sm:text-6xl">
            Thank You
          </h2>
          <p className="mt-3 text-xl font-semibold text-brand-600 sm:text-2xl">
            Your assessments have been recorded.
          </p>
          <p className="mt-2 text-base text-slate-600">
            We appreciate your time evaluating ESLessonCraftMY.
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8"
          >
            <GlowButton variant="ghost" onClick={resetForm} className="px-8 py-3">
              New Assessment
            </GlowButton>
          </motion.div>
        </div>
      </motion.div>
    )
  }

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

        {/* Submit */}
        <div className="mt-8 flex justify-center">
          <GlowButton
            onClick={handleSubmit}
            loading={submitting}
            className="px-12 py-5 text-lg"
          >
            Submit Assessment
          </GlowButton>
        </div>
      </div>

      {/* Fullscreen signature modal (same pattern as the visitor form). */}
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
      {/* Slot badge */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-sm">
          {slotNumber}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-500">
          Judge {slotNumber}
        </h3>
      </div>

      {/* Name selector */}
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
            {/* The currently-selected name stays visible even though it's not in
                availableNames for this slot (it was filtered out). */}
            {slot.judgeName && !availableNames.includes(slot.judgeName) && (
              <option value={slot.judgeName}>{slot.judgeName}</option>
            )}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-400">
            ▾
          </span>
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-gold-600">
          Rating <span className="text-slate-400">(optional)</span>
        </label>
        <StarRating
          value={slot.rating}
          onChange={(v) => onChange({ rating: v })}
        />
      </div>

      {/* Comment */}
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

      {/* Signature */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Signature <span className="text-rose-400">*</span>
        </label>
        <SignaturePad
          ref={sigRef}
          onChange={onSignatureChange}
          onExpand={onExpand}
        />
        {!slot.hasSignature && (
          <p className="mt-1.5 text-[11px] text-rose-400">A signature is required.</p>
        )}
      </div>

      {/* Completed indicator */}
      {slot.judgeName && slot.hasSignature && (
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Ready to submit
        </div>
      )}
    </GlassCard>
  )
}
