import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, RefreshCw, Star, Quote, Trash2, X, PlayCircle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { VisitorCounter } from '@/components/ui/VisitorCounter'
import { NeonSignature } from '@/components/ui/NeonSignature'
import { PasswordModal } from '@/components/ui/PasswordModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  fetchSubmissions,
  deleteSubmission,
  clearAllSubmissions,
  type LogEntry,
} from '@/firebase/visitors'
import { fmtNumber } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useToast } from '@/components/ui/Toast'

/**
 * Delete-flow state machine:
 *   idle → password(open) → [incorrect] try-again/close
 *                       → [correct] confirm(open) → [yes] delete | [no] cancel
 * Saves the pending action (single entry id, or 'all') so the same modals
 * serve both per-entry delete and clear-all.
 */
type PendingDelete = { kind: 'all' } | { kind: 'one'; entry: LogEntry }

/**
 * Public, read-only visitor log.
 *
 * Pulls the most recent submissions from Firestore and renders them as elegant
 * glass cards. Per the privacy intent in the brief, this view EXCLUDES email,
 * phone, and signature — it shows only: visitor number, name, institution,
 * position, rating, comment (typed text or handwritten image), and date.
 */
export function VisitorLogsScreen({ totalCount }: { totalCount: number }) {
  const toast = useToast()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Local count mirror so the pill updates immediately after deletions without
  // waiting for App to re-fetch. Falls back to the prop when not overridden.
  const [localCount, setLocalCount] = useState<number | null>(null)
  const displayCount = localCount ?? totalCount

  // "Animate" mode: infinite marquee ticker of entry cards.
  const [animateMode, setAnimateMode] = useState(false)

  // Delete-flow state.
  const [pending, setPending] = useState<PendingDelete | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingEntry, setConfirmingEntry] = useState<LogEntry | null>(null)
  const [confirmingAll, setConfirmingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchSubmissions(100)
      setEntries(list)
    } catch (err) {
      console.error('[fetchSubmissions]', err)
      setError('Could not load visitor logs. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Open the password gate for either a single entry or clear-all. */
  const requestDelete = (p: PendingDelete) => {
    setPending(p)
    setPasswordOpen(true)
  }

  /** Password correct → close password modal, open the confirmation modal. */
  const onAuthorized = () => {
    setPasswordOpen(false)
    setConfirmOpen(true)
    if (pending?.kind === 'one') {
      setConfirmingEntry(pending.entry)
      setConfirmingAll(false)
    } else {
      setConfirmingEntry(null)
      setConfirmingAll(true)
    }
  }

  /** Confirmed → run the actual delete, then refresh. */
  const onConfirmed = async () => {
    setConfirmOpen(false)
    if (!pending) return
    setDeleting(true)
    try {
      if (pending.kind === 'one') {
        await deleteSubmission(
          pending.entry.id,
          pending.entry.signatureImage,
          pending.entry.handwrittenCommentImage,
        )
        toast.push(`Deleted entry for ${pending.entry.name || 'visitor'}.`, 'success')
      } else {
        await clearAllSubmissions()
        toast.push('All visitor logs cleared.', 'success')
      }
      // Update the local count immediately so the pill reflects reality.
      setLocalCount((prev) => {
        const base = prev ?? displayCount
        const diff = pending.kind === 'one' ? -1 : -base
        return Math.max(0, base + diff)
      })
      await load()
    } catch (err) {
      console.error('[delete]', err)
      toast.push('Could not complete the delete. Please try again.', 'error')
    } finally {
      setDeleting(false)
      setPending(null)
      setConfirmingEntry(null)
      setConfirmingAll(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-dvh w-full px-4 pb-16 pt-28 sm:px-6"
    >
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-cursive text-4xl leading-none text-brand-700 sm:text-5xl">
              Visitor Logs
            </h2>
            <p className="mt-1 text-sm text-electric-500">
              {loading
                ? 'Loading entries…'
                : `${fmtNumber(entries.length)} ${entries.length === 1 ? 'entry' : 'entries'} shown`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {displayCount > 0 && <VisitorCounter value={displayCount} variant="pill" />}
            <motion.button
              type="button"
              aria-label="Refresh"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08, boxShadow: '0 0 24px -4px rgba(59,130,246,0.7)' }}
              onClick={() => {
                sound.play('click')
                void load()
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-electric-200 bg-white/60 text-electric-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>
            {entries.length > 0 && (
              <motion.button
                type="button"
                aria-label={animateMode ? 'Stop animation' : 'Animate entries'}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.06 }}
                onClick={() => {
                  sound.play('click')
                  setAnimateMode((v) => !v)
                }}
                className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-sm backdrop-blur-md transition-colors ${
                  animateMode
                    ? 'border-brand-300 bg-brand-gradient text-white shadow-glow'
                    : 'border-brand-200 bg-white/60 text-brand-600 hover:bg-white'
                }`}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {animateMode ? 'Stop' : 'Animate'}
              </motion.button>
            )}
            <motion.button
              type="button"
              aria-label="Clear all logs"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.06 }}
              onClick={() => {
                sound.play('click')
                requestDelete({ kind: 'all' })
              }}
              disabled={entries.length === 0}
              className="flex h-10 items-center gap-1.5 rounded-full border border-rose-200 bg-white/60 px-3 text-xs font-medium text-rose-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </motion.button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-4xl border border-white/30 bg-white/40"
              />
            ))}
          </div>
        ) : error ? (
          <GlassCard className="p-8 text-center">
            <p className="text-rose-500">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
            >
              Try again
            </button>
          </GlassCard>
        ) : entries.length === 0 ? (
          <GlassCard className="flex flex-col items-center p-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-brand-300" />
            <h3 className="text-xl font-semibold text-brand-700">No entries yet</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Be the first to sign the guestbook. Your feedback will appear here
              for future visitors to see.
            </p>
          </GlassCard>
        ) : animateMode ? (
          // ── Infinite marquee / ticker: 3 brick-like rows scrolling continuously. ──
          // Each row has a different direction + speed for a staggered brick feel.
          // Content is duplicated so the -50% translate loops seamlessly.
          // Hover any row to pause it for reading.
          <div className="flex flex-col gap-4">
            {[
              { dir: 'left', dur: 42, offset: 0 },
              { dir: 'right', dur: 58, offset: 1 },
              { dir: 'left', dur: 48, offset: 0 },
            ].map((row, ri) => {
              const rowEntries =
                entries.length > 6
                  ? entries.filter((_, i) => i % 3 === row.offset)
                  : entries
              const list = rowEntries.length > 0 ? rowEntries : entries
              // Duplicate the list twice for a seamless infinite loop.
              const doubled = [...list, ...list]
              return (
                <div
                  key={ri}
                  className="marquee-row relative overflow-hidden rounded-3xl"
                  style={{
                    maskImage:
                      'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                    WebkitMaskImage:
                      'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                  }}
                >
                  <div
                    className="marquee-track py-2"
                    style={{
                      animation: `marquee-${row.dir} ${row.dur}s linear infinite`,
                    }}
                  >
                    {doubled.map((entry, i) => (
                      <MarqueeCard
                        key={`${entry.id}-${i}`}
                        entry={entry}
                        totalCount={displayCount}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="mt-2 text-center text-xs uppercase tracking-[0.2em] text-brand-400">
              Hover to pause · {entries.length} entries scrolling
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {entries.map((entry, i) => (
                <EntryCard
                  key={`${entry.visitorNumber}-${i}`}
                  entry={entry}
                  index={i}
                  totalCount={displayCount}
                  onDelete={() => requestDelete({ kind: 'one', entry })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete-flow modals: password gate → confirmation → run delete. */}
      <PasswordModal
        open={passwordOpen}
        title={pending?.kind === 'all' ? 'Clear All Logs' : 'Delete Entry'}
        onAuthorized={onAuthorized}
        onClose={() => {
          setPasswordOpen(false)
          setPending(null)
        }}
      />
      <ConfirmModal
        open={confirmOpen}
        title={confirmingAll ? 'Clear All Logs' : 'Delete Entry'}
        message={
          confirmingAll
            ? 'This will permanently delete ALL visitor log entries and their signatures. This cannot be undone. Are you sure?'
            : `This will permanently delete the entry for ${
                confirmingEntry?.name || 'this visitor'
              } and their signature. This cannot be undone. Are you sure?`
        }
        confirmLabel={confirmingAll ? 'Yes, clear all' : 'Yes, delete'}
        onConfirm={onConfirmed}
        onCancel={() => {
          setConfirmOpen(false)
          setPending(null)
          setConfirmingEntry(null)
          setConfirmingAll(false)
        }}
      />

      {/* Deleting overlay */}
      {deleting && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-brand-900/30 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </div>
      )}
    </motion.div>
  )
}

function EntryCard({
  entry,
  index,
  totalCount,
  onDelete,
}: {
  entry: LogEntry
  index: number
  totalCount: number
  onDelete: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const [sigFailed, setSigFailed] = useState(false)
  const date = entry.timestamp ? new Date(entry.timestamp) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
    >
      <GlassCard className="p-5 sm:p-6">
        {/*
          3-column grid:
            [ name                 ] [ signature ] [ ★★★★★ ]
            [ institution · position] [           ] [         ]
            [ date · time          ] [           ] [         ]
            [ comment              ] [           ] [         ]

          Left column = all text content, stacked.
          Middle column = signature, vertically centered, neon glow.
          Right column = star rating, top-aligned.
          Stacks to a single column on narrow screens.
        */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-start sm:gap-6">
          {/* ── Left: name, institution, date, comment ──────────────────── */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-brand-800">
                {entry.name || 'Anonymous'}
              </h3>
              {entry.visitorNumber > 0 && (
                <span className="shrink-0 rounded-full bg-gold-gradient px-2 py-0.5 text-xs font-semibold text-gold-600 shadow-sm">
                  #{fmtNumber(totalCount - index)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {entry.institution}
              {entry.position ? ` · ${entry.position}` : ''}
            </p>
            {date && (
              <p className="mt-1 text-xs text-slate-400">{date.toLocaleString()}</p>
            )}

            {/* Comment: typed text, or handwritten image. */}
            {entry.typedComment ? (
              <div className="mt-3 flex gap-2">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {entry.typedComment}
                </p>
              </div>
            ) : entry.handwrittenCommentImage && !imgFailed ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/40 bg-white/60">
                <img
                  src={entry.handwrittenCommentImage}
                  alt={`${entry.name}'s handwritten comment`}
                  loading="lazy"
                  onError={() => setImgFailed(true)}
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          {/* ── Middle: signature (neon glow hugs the ink, not the image box) ── */}
          {entry.signatureImage && !sigFailed && (
            <div className="flex items-center justify-center self-center sm:h-full">
              <NeonSignature
                src={entry.signatureImage}
                alt={`${entry.name}'s signature`}
                className="max-h-44 w-full max-w-[16rem] object-contain"
                onError={() => setSigFailed(true)}
              />
            </div>
          )}

          {/* ── Right: star rating + delete button (top-aligned) ─────────── */}
          <div className="flex flex-col items-end gap-2 self-start sm:pt-1">
            {entry.rating > 0 ? <StarRow value={entry.rating} /> : null}
            <button
              type="button"
              aria-label="Delete entry"
              title="Delete entry"
              onClick={() => {
                sound.play('click')
                onDelete()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200/60 bg-white/60 text-rose-400 shadow-sm backdrop-blur-md transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= value
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-brand-200'
          }`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

/**
 * Compact card for the marquee ticker — a fixed-width glass card showing the
 * visitor's name, institution, comment, rating, and neon signature. Designed
 * to tile horizontally in the scrolling rows.
 */
function MarqueeCard({
  entry,
  totalCount,
}: {
  entry: LogEntry
  totalCount: number
}) {
  const [sigFailed, setSigFailed] = useState(false)
  const date = entry.timestamp ? new Date(entry.timestamp) : null

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 rounded-3xl border border-white/40 bg-white/55 p-4 shadow-glass backdrop-blur-xl">
      {/* Name + badge */}
      <div className="flex items-center gap-2">
        <h4 className="truncate text-sm font-semibold text-brand-800">
          {entry.name || 'Anonymous'}
        </h4>
        {entry.visitorNumber > 0 && (
          <span className="shrink-0 rounded-full bg-gold-gradient px-1.5 py-0.5 text-[10px] font-semibold text-gold-600">
            #{fmtNumber(totalCount)}
          </span>
        )}
        {entry.rating > 0 && <StarRow value={entry.rating} />}
      </div>

      {/* Institution + date */}
      <p className="text-xs text-slate-500">
        {entry.institution}
        {entry.position ? ` · ${entry.position}` : ''}
      </p>
      {date && (
        <p className="text-[10px] text-slate-400">{date.toLocaleDateString()}</p>
      )}

      {/* Comment */}
      {entry.typedComment ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
          “{entry.typedComment}”
        </p>
      ) : null}

      {/* Neon signature */}
      {entry.signatureImage && !sigFailed ? (
        <div className="flex flex-1 items-center justify-center pt-1">
          <NeonSignature
            src={entry.signatureImage}
            alt={`${entry.name}'s signature`}
            className="max-h-20 w-full max-w-[12rem] object-contain"
            onError={() => setSigFailed(true)}
          />
        </div>
      ) : null}
    </div>
  )
}

