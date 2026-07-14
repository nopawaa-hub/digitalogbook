import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, FIRESTORE } from './config'
import type { Submission } from '@/lib/validation'
import { detectDevice, detectBrowser } from '@/lib/utils'

/**
 * Atomically reserve and return the next visitor number.
 *
 * This runs the moment a visitor taps "Start Signing" so they immediately see
 * their assigned number (per spec) — instead of reserving only on submit,
 * which would make the number ambiguous if several visitors start at once.
 *
 * The counter lives at `counters/visitors`. It is seeded to 0 on first use.
 *
 * NOTE: reserving earlier than submission means a number can be "wasted" if a
 * visitor walks away. At an exhibition this is acceptable and keeps the flow
 * magical (the number they see is the number they keep).
 */
export async function reserveVisitorNumber(): Promise<number> {
  const counterRef = doc(db, FIRESTORE.countersVisitor)

  return runTransaction(db, async (tx) => {
    const snap = await getDoc(counterRef)
    const current = snap.exists() ? (Number(snap.data()?.count) || 0) : 0
    const next = current + 1
    if (snap.exists()) {
      tx.update(counterRef, { count: next })
    } else {
      tx.set(counterRef, { count: next })
    }
    return next
  })
}

/**
 * Read the current visitor counter (reserved-start counter).
 * Best-effort: returns 0 if the doc doesn't exist yet or the read fails.
 *
 * NOTE: this counts every "Start Signing" tap — including visitors who walked
 * away without submitting. For the displayed "X visitors" total, prefer
 * `getSubmissionCount()` which counts actual entries instead.
 */
export async function getCurrentVisitorCount(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, FIRESTORE.countersVisitor))
    return snap.exists() ? Number(snap.data()?.count) || 0 : 0
  } catch {
    return 0
  }
}

/**
 * Count actual submission documents — the real number of signed entries.
 * Used for the "X visitors" display so deleting entries (clear-all or
 * per-entry) reflects immediately, and walk-aways (reserved but never
 * submitted) aren't counted.
 *
 * For large collections this fetches all doc ids; for an exhibition booth (tens
 * to low-hundreds of entries) that's fine. For scale, switch to a Firestore
 * count aggregation query.
 */
export async function getSubmissionCount(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, FIRESTORE.submissions))
    return snap.size
  } catch {
    return 0
  }
}

/** Ensure the counter document exists (used once, defensively, at boot). */
export async function ensureCounterSeed(): Promise<void> {
  try {
    const counterRef = doc(db, FIRESTORE.countersVisitor)
    const snap = await getDoc(counterRef)
    if (!snap.exists()) {
      await setDoc(counterRef, { count: 0 })
    }
  } catch {
    // Non-fatal: the first reserveVisitorNumber() will seed it inside the txn.
  }
}

/**
 * Upload a data-URL image (PNG from the ink canvas) to Firebase Storage and
 * return its long-lived download URL. The URL is stored on the Firestore doc
 * so the future admin dashboard can render images directly via `<img src>`.
 */
export async function uploadImageData(
  dataUrl: string,
  storagePath: string,
): Promise<string> {
  const storageRef = ref(storage, storagePath)
  const result = await uploadString(storageRef, dataUrl, 'data_url')
  return getDownloadURL(result.ref)
}

/**
 * Persist a completed visitor log entry.
 *
 * `visitorNumber` was already reserved at welcome→form time; we reuse it here
 * so the visitor keeps the number they saw. Images are uploaded to Storage
 * first (by the caller), so the Firestore doc stores final download URLs.
 */
export async function createSubmission(
  input: Omit<
    Submission,
    'timestamp' | 'createdAt' | 'device' | 'browser' | 'visitorNumber'
  > & { visitorNumber: number },
): Promise<void> {
  const record: Omit<Submission, 'createdAt'> = {
    visitorNumber: input.visitorNumber,
    timestamp: Date.now(),
    name: input.name,
    institution: input.institution,
    position: input.position,
    email: input.email ?? '',
    phone: input.phone ?? '',
    typedComment: input.typedComment ?? '',
    // Storage download URLs (uploaded in App.tsx before this call), or '' if none.
    handwrittenCommentImage: input.handwrittenCommentImage ?? '',
    signatureImage: input.signatureImage ?? '',
    // Serialized strokes for the celebration replay (JSON in Firestore).
    signatureStrokes: input.signatureStrokes ?? null,
    rating: input.rating ?? 0,
    consent: input.consent,
    device: detectDevice(),
    browser: detectBrowser(),
  }

  await addDoc(collection(db, FIRESTORE.submissions), {
    ...record,
    createdAt: serverTimestamp(),
  })
}

/**
 * A single entry in the public visitor log. This is a deliberately narrow
 * projection of a `submissions` doc — it EXCLUDES email and phone (the public
 * log view never exposes contact details), but DOES include the signature so
 * other visitors can see who signed.
 */
export interface LogEntry {
  /** Firestore document id — needed for single-entry deletion. */
  id: string
  visitorNumber: number
  timestamp: number
  name: string
  institution: string
  position: string
  typedComment: string
  /** Firebase Storage download URL of the handwritten comment (may be ''). */
  handwrittenCommentImage: string
  /** Firebase Storage download URL of the signature (may be ''). */
  signatureImage: string
  rating: number
}

/**
 * Fetch the most recent visitor log entries, newest first, for the public
 * "View the Visitor Logs" screen. Ordered by the client-set `timestamp` field
 * (always present, a number) so we don't depend on the server-resolved
 * `createdAt` for sorting.
 *
 * Best-effort: throws upward so the caller can show an error/empty state.
 */
export async function fetchSubmissions(max = 100): Promise<LogEntry[]> {
  const q = query(
    collection(db, FIRESTORE.submissions),
    orderBy('timestamp', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      visitorNumber: Number(data.visitorNumber) || 0,
      timestamp: Number(data.timestamp) || 0,
      name: String(data.name ?? ''),
      institution: String(data.institution ?? ''),
      position: String(data.position ?? ''),
      typedComment: String(data.typedComment ?? ''),
      handwrittenCommentImage: String(data.handwrittenCommentImage ?? ''),
      signatureImage: String(data.signatureImage ?? ''),
      rating: Number(data.rating) || 0,
    }
  })
}

/**
 * Delete a stored image by its Storage download URL. Best-effort: swallows
 * errors (the Firestore doc is still deleted even if the image is gone).
 */
async function deleteStorageObjectByUrl(url: string): Promise<void> {
  if (!url) return
  try {
    await deleteObject(ref(storage, url))
  } catch {
    /* already gone or permission — ignore */
  }
}

/**
 * Delete a single visitor entry: its Firestore document AND any associated
 * Storage images (signature + handwritten comment). Best-effort on images.
 */
export async function deleteSubmission(
  docId: string,
  signatureUrl: string,
  commentUrl: string,
): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, FIRESTORE.submissions, docId)),
    deleteStorageObjectByUrl(signatureUrl),
    deleteStorageObjectByUrl(commentUrl),
  ])
}

/**
 * Delete ALL visitor entries: every submission document and its images.
 * Used by the "Clear all logs" action (password-gated in the UI).
 *
 * Iterates in batches to stay under Firestore write limits; image deletes are
 * best-effort and run in parallel. The visitor counter is left untouched (the
 * next visitor still gets the next sequential number).
 */
export async function clearAllSubmissions(): Promise<void> {
  const snap = await getDocs(collection(db, FIRESTORE.submissions))
  const dels = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const sig = String(data.signatureImage ?? '')
    const comment = String(data.handwrittenCommentImage ?? '')
    return deleteSubmission(d.id, sig, comment)
  })
  await Promise.all(dels)
}


