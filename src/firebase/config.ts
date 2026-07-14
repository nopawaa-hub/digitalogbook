import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const ENV = import.meta.env

function requireEnv(key: keyof typeof ENV): string {
  const value = ENV[key]
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[firebase] Missing env var "${String(key)}". ` +
        'Copy .env.example to .env.local and paste your Firebase project config.',
    )
  }
  return value
}

const firebaseConfig: FirebaseOptions = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
}

export const app = initializeApp(firebaseConfig)

/**
 * Firestore with IndexedDB persistence enabled at construction time.
 *
 * This gives the booth resilience to flaky exhibition Wi-Fi: writes queue in
 * the browser and auto-sync when connectivity returns.
 * `persistentMultipleTabManager` keeps multiple open tabs consistent (e.g.
 * admin + kiosk on one device).
 *
 * Persistence is best-effort: if the browser blocks IndexedDB (private mode,
 * quota) we fall back to the default in-memory cache rather than crashing
 * the booth.
 */
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    // Already initialized, or persistence unavailable — use the default instance.
    return getFirestore(app)
  }
})()

export const storage: FirebaseStorage = getStorage(app)

// Collection / document paths used across the app.
// Images are stored as crisp PNGs in Firebase Storage; the download URL is
// written to the Firestore `submissions` document.
export const FIRESTORE = {
  countersVisitor: 'counters/visitors' as const,
  submissions: 'submissions',
  signaturePath: (visitorNumber: number) => `signatures/${visitorNumber}.png`,
  commentPath: (visitorNumber: number) => `comments/${visitorNumber}.png`,
}
