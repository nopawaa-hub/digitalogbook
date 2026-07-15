import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { GradientBackdrop } from '@/components/background/GradientBackdrop'
import { FloatingParticles } from '@/components/background/FloatingParticles'
import { WelcomeScreen } from '@/screens/WelcomeScreen'
import { LogForm, type SubmitPayload } from '@/screens/LogForm'
import { SuccessCelebration } from '@/screens/SuccessCelebration'
import { VisitorLogsScreen } from '@/screens/VisitorLogsScreen'
import { JudgeAssessmentScreen } from '@/screens/JudgeAssessmentScreen'
import { NavBar, type NavSection } from '@/components/ui/NavBar'
import type { SerializedStrokes } from '@/components/ink/StrokeEngine'
import { useIdleTimer } from '@/lib/useIdleTimer'
import {
  isWithinDuplicateWindow,
  markSubmittedNow,
  DUPLICATE_WINDOW_SECONDS,
} from '@/lib/utils'
import {
  ensureCounterSeed,
  getSubmissionCount,
  reserveVisitorNumber,
  uploadImageData,
  createSubmission,
} from '@/firebase/visitors'
import { FIRESTORE } from '@/firebase/config'

type Screen = 'welcome' | 'form' | 'celebration' | 'logs' | 'judges'

function AppInner() {
  const toast = useToast()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [visitorNumber, setVisitorNumber] = useState(0)
  const [totalVisitors, setTotalVisitors] = useState(0)
  const [reserving, setReserving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Signature replay data for the celebration (strokes for new submissions,
  // image URL fallback for older entries without captured strokes).
  const [signatureStrokes, setSignatureStrokes] =
    useState<SerializedStrokes | null>(null)
  const [signatureImageUrl, setSignatureImageUrl] = useState('')

  // Boot: seed the counter doc (defensively, for reserved-number uniqueness)
  // and read the ACTUAL submission count for the displayed total.
  useEffect(() => {
    void ensureCounterSeed().finally(() => {
      void getSubmissionCount().then(setTotalVisitors)
    })
  }, [])

  // Refresh the total (actual entries) whenever we return to the welcome screen.
  const refreshTotal = useCallback(() => {
    void getSubmissionCount().then(setTotalVisitors)
  }, [])

  const goWelcome = useCallback(() => {
    setScreen('welcome')
    refreshTotal()
  }, [refreshTotal])

  /**
   * Top navigation between the two sections.
   *   - "sign" → the signing flow. Lands on the welcome screen (the magical
   *     entry) so the visitor taps Start Signing to reserve a number. If they
   *     were already mid-signing (on the form), this is a no-op.
   *   - "logs" → the public read-only visitor log.
   */
  const handleNav = useCallback(
    (section: NavSection) => {
      if (section === 'logs') {
        setScreen('logs')
        return
      }
      if (section === 'judges') {
        setScreen('judges')
        return
      }
      // 'sign': only move if not already in the signing flow.
      if (screen !== 'welcome' && screen !== 'form') {
        goWelcome()
      }
    },
    [screen, goWelcome],
  )

  /** Welcome → Form: reserve the visitor's number atomically. */
  const handleStart = useCallback(async () => {
    if (reserving) return
    setReserving(true)
    try {
      const num = await reserveVisitorNumber()
      setVisitorNumber(num)
      setScreen('form')
    } catch (err) {
      console.error('[reserveVisitorNumber]', err)
      toast.push(
        'Could not assign a visitor number. Please check your connection and try again.',
        'error',
      )
    } finally {
      setReserving(false)
    }
  }, [reserving, toast])

  /** Form → Celebration: upload images + persist the submission to Firestore. */
  const handleSubmit = useCallback(
    async (payload: SubmitPayload): Promise<void> => {
      // 30s duplicate-submission guard (original prompt requirement).
      if (isWithinDuplicateWindow(DUPLICATE_WINDOW_SECONDS)) {
        toast.push(
          'A submission was just recorded. Please wait a moment before submitting again.',
          'error',
        )
        return
      }

      setSubmitting(true)
      try {
        // Upload images to Firebase Storage first so the Firestore doc stores
        // final download URLs. Crisp PNGs, no compression needed.
        const commentUrl = payload.handwrittenCommentImage
          ? await uploadImageData(
              payload.handwrittenCommentImage,
              FIRESTORE.commentPath(visitorNumber),
            )
          : ''
        const signatureUrl = payload.signatureImage
          ? await uploadImageData(
              payload.signatureImage,
              FIRESTORE.signaturePath(visitorNumber),
            )
          : ''

        await createSubmission({
          visitorNumber,
          name: payload.name,
          institution: payload.institution,
          position: payload.position,
          email: payload.email,
          phone: payload.phone,
          typedComment: payload.typedComment,
          handwrittenCommentImage: commentUrl,
          signatureImage: signatureUrl,
          signatureStrokes: payload.signatureStrokes,
          rating: payload.rating,
          consent: payload.consent,
        })
        // Keep the strokes for the celebration replay before clearing state.
        setSignatureStrokes(payload.signatureStrokes ?? null)
        setSignatureImageUrl(signatureUrl)

        markSubmittedNow()
        setScreen('celebration')
      } catch (err) {
        console.error('[createSubmission]', err)
        toast.push(
          'Something went wrong while saving your entry. Please try again.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [visitorNumber, toast],
  )

  // Attract / idle mode:
  //   - 45s of inactivity on the form → back to welcome
  //   - 10s after the celebration → back to welcome
  //   - 60s on the logs screen → back to welcome (kiosk returns to attract)
  useIdleTimer(goWelcome, 45_000, screen === 'form')
  useIdleTimer(goWelcome, 10_000, screen === 'celebration')
  useIdleTimer(goWelcome, 60_000, screen === 'logs')
  useIdleTimer(goWelcome, 90_000, screen === 'judges')

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden">
      {/* Ambient background — always present across all screens */}
      <GradientBackdrop />
      <FloatingParticles />

      {/* Sound toggle in the corner (muted by default for exhibition booths) */}
      <SoundToggle />

      {/* Top navigation — hidden only during the momentary celebration animation,
          so visitors can switch between signing and browsing the logs at any time. */}
      {screen !== 'celebration' && (
        <NavBar
          active={
            screen === 'logs' ? 'logs' : screen === 'judges' ? 'judges' : 'sign'
          }
          onChange={handleNav}
        />
      )}

      <AnimatePresence mode="wait">
        {screen === 'welcome' && (
          <WelcomeScreen
            key="welcome"
            totalVisitors={totalVisitors}
            reserving={reserving}
            onStart={handleStart}
          />
        )}
        {screen === 'form' && (
          <LogForm
            key="form"
            visitorNumber={visitorNumber}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
        {screen === 'celebration' && (
          <SuccessCelebration
            key="celebration"
            visitorNumber={visitorNumber}
            signatureStrokes={signatureStrokes}
            signatureImageUrl={signatureImageUrl}
            onDone={goWelcome}
          />
        )}
        {screen === 'logs' && (
          <VisitorLogsScreen key="logs" totalCount={totalVisitors} />
        )}
        {screen === 'judges' && <JudgeAssessmentScreen key="judges" />}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
