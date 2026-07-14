# Visitor Log Book · ESLessonCraftMY

A premium digital guestbook for the **ESLessonCraftMY** innovation exhibition booth —
designed for a 12" Android tablet in landscape kiosk mode. Every interaction is
meant to feel elegant, magical, and memorable: animated welcome screen, a live
visitor counter, a magical "fairy-dust" ink engine for handwriting and
signatures, a celebration sequence on submit, and an attract/idle mode that
returns to the welcome screen automatically.

---

## ✨ Features in this build

- **Welcome screen** — glassmorphism card, Great Vibes cursive title, breathing
  logo, softly blinking "Start Signing", floating particles, gradient backdrop.
- **Live visitor counter** — reserved atomically via a Firestore transaction
  on "Start Signing"; animates count-up with a sparkle burst.
- **Premium ink engine** — two stacked canvases per writing surface:
  - Persistent ink layer: Bézier-smoothed, velocity- and pressure-aware
    variable stroke width, anti-aliased, round caps/joins.
  - Effect overlay: a pulsing glow following the pen tip + sparkle particles
    that drift and fade (0.3–0.6s) — Disney-style fairy dust, never distracting.
  - Supports finger, stylus, S Pen, and Apple Pencil via Pointer Events with
    `getCoalescedEvents()` for sub-frame smoothness.
- **Signature pad** — same engine, with a signature baseline and a glow trail
  that fades into clean ink.
- **Submission celebration** — glowing checkmark draws on, purple sparkles
  expand outward, visitor number briefly enlarges with a glow, thank-you copy.
- **Attract / idle mode** — 45s inactivity on the form, or 10s after the
  celebration, returns to the welcome screen.
- **Sound** — subtle WebAudio-synthesized click / scribble / success chime,
  **muted by default** (exhibition booths are shared spaces). Toggle in the
  top-right corner.
- **Offline resilience** — Firestore IndexedDB persistence queues writes and
  auto-syncs when the exhibition Wi-Fi reconnects.

## 🛠 Tech stack

React 18 · Vite 5 · TypeScript · Tailwind CSS v3 · Framer Motion ·
Firebase v10 (Firestore + Storage) · React Hook Form + Zod · lucide-react.

## 🚀 Getting started

### 1. Prerequisites

- **Node 20+ LTS** — check with `node -v`.
- A **Firebase project** with **Firestore** and **Storage** enabled (Blaze plan).

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your
   project → **Project settings** → **Your apps** → **SDK setup and
   configuration** → **Config**.
2. Copy `.env.example` to `.env.local` and paste your values:

   ```bash
   cp .env.example .env.local
   ```

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. **Firestore rules** (for the booth, allow create + read of submissions and
   the counter document; tighten before going public):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Visitor counter: public read, but only allow increment via the app.
       match /counters/visitors {
         allow read: if true;
         allow write: if true; // tighten for production
       }
       // Submissions: visitors create, admin reads (see NEXT_STEPS).
       match /submissions/{doc} {
         allow read: if true;   // tighten — admin only later
         allow create: if true;
       }
     }
   }
   ```

4. **Storage rules** (allow image upload from the booth):

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /signatures/{allPaths=**} { allow read: if true; allow write: if true; }
       match /comments/{allPaths=**}   { allow read: if true; allow write: if true; }
     }
   }
   ```

> ⚠️ The app won't build/run until the Firebase env vars are present
> (`firebase/config.ts` throws a clear error if any are missing).

### 4. Run the dev server

```bash
npm run dev
```

Open the printed URL. For tablet testing on the same network, the dev server
is exposed on your LAN (`host: true`); use your machine's IP, e.g.
`http://192.168.x.x:5173`.

### 5. Production build

```bash
npm run build      # type-check + Vite build into ./dist
npm run preview    # serve the production build locally
```

## 🎯 Kiosk setup on the tablet

- Open Chrome/Edge → enable **"Add to Home screen"** for a full-screen PWA-style launch.
- Turn on **fullscreen / kiosk mode** (e.g. via Fully Kiosk Browser or Android's
  guided-access equivalent) so visitors can't leave the app.
- Disable screen auto-lock and keep the tablet plugged in.

## 📁 Project structure

```
src/
  App.tsx                          # screen state machine + idle timers
  main.tsx, index.css
  firebase/
    config.ts                      # init from env; IndexedDB persistence
    visitors.ts                    # reserve number, upload image, create submission
    lib/
    utils.ts                       # cn, clamp, device/browser detect, duplicate guard
    validation.ts                  # zod schema + Submission type + PositionOptions
    sound.ts                       # WebAudio sound manager (muted by default)
    useIdleTimer.ts                # attract-mode activity timer
  components/
    background/                    # GradientBackdrop, FloatingParticles
    ink/                           # StrokeEngine, SparkleLayer, InkCanvas, SignaturePad
    ui/                            # GlassCard, GlowButton, StarRating, Toast, VisitorCounter, SoundToggle
  screens/
    WelcomeScreen.tsx
    LogForm.tsx
    SuccessCelebration.tsx
```

## 🔒 Data stored per entry

```
visitorNumber, timestamp, createdAt, name, institution, position, email, phone,
typedComment, handwrittenCommentImage, signatureImage, rating, consent, device, browser
```

`handwrittenCommentImage` and `signatureImage` hold **Firebase Storage
download URLs** (crisp PNGs uploaded at submit time). Email and phone are
optional and are **not** displayed anywhere in this build (the public gallery
that would hide them is a planned follow-up).

## ⏭️ NEXT_STEPS (deferred follow-up)

These are **not** in this build and are documented here for the next pass:

- **`/admin` dashboard** — total visitors, average rating, latest visitors,
  table of all entries, view/delete actions, CSV/Excel/PDF export, search by
  name/institution/date, filter by rating, modal with handwriting + signature.
- **`/guestbook` gallery** — public read-only masonry of elegant cards
  (hiding email, phone, signature), fade-in animation, pagination.
- **QR code** on the success screen linking to the ESLessonCraftMY website.
- **Photo capture** option to accompany an entry.
- **Full PWA** installable shell with offline caching beyond Firestore.
- **Dark / light mode** toggle.
- **Institution logo detection** for recognized universities/schools.
