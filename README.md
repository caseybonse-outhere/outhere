# Out Here

Invite-only map of movement-arts spots, weekly jams, and who's out right now — flow, slackline, acro, parkour.

**Stack:** Expo (React Native, SDK 57) + Expo Router · Supabase (database, email sign-in, edge function) · Expo push notifications.

## What's in v0.4

| Feature | Where |
|---|---|
| **Spots** — map with discipline filters, long-press to add, public/private, fire/lighting/surface, −5…+5 reviews | `src/app/(tabs)/index.tsx`, `src/app/spot/` |
| **Recurring jams** — weekly / every other week / one-off, fixed time or *at sunset* (computed per date), "Add to calendar" with a repeating event | `src/app/(tabs)/jams.tsx`, `src/app/event/new.tsx`, `src/lib/schedule.ts` |
| **"I'm out here" sessions** — check in at a spot until 1–3 h or sunset; auto-expires | `src/app/spot/[id].tsx` |
| **Nearby alerts** — members pick a radius (1–50 mi); new jams and check-ins push to everyone in range | `src/app/(tabs)/me.tsx`, `supabase/functions/notify-nearby` |
| **Invite-only** — email code sign-in, then an invite code; each member gets 3 codes | `src/app/sign-in.tsx`, `src/app/invite.tsx` |
| **Profiles** — photo, bio, what you do, what you're into; tap anyone checked in or reviewing to see theirs | `src/app/(tabs)/me.tsx`, `src/app/profile/[id].tsx` |
| **Music at jams** — DJ / live / speaker badge, filter jams by DJ or any music, edit jams | `src/app/(tabs)/jams.tsx`, `src/app/event/new.tsx` |
| **The line is up** — on slackline spots and jams, post what's rigged (type, length, until when); pin turns green | `src/lib/lines.tsx` |
| **Direct messages** — Messages tab with unread badge, live chat, Message button on profiles; blocks respected | `src/app/(tabs)/messages.tsx`, `src/app/messages/[id].tsx` |
| **Jam communities** — jam page with Join / Leave, members and organizer, My jams filter | `src/app/jam/[id].tsx` |
| **Photo galleries** — take or choose photos (auto-resized), captions, up to 99 per member; on the Me tab and every profile | `src/lib/gallery.tsx`, `src/app/photo/`, `src/app/gallery/[id].tsx` |
| **Jam photos** — cover photo per jam; thumbnails on jam cards and spot pages, big photo on the jam page | `src/lib/jamPhoto.tsx`, `src/app/event/new.tsx` |
| **App Store basics** — report, block, delete account | spot screen, profile screen, Me tab |

Privacy: the app stores each member's area rounded to ~1 km, never their exact location, and other members can't read it.

---

## Setup (about 20 minutes)

### 1. Install

Needs Node 20+.

```bash
git clone <your repo url> outhere && cd outhere
npm install
```

### 2. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste and run, one at a time and in this order: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `supabase/migrations/0002_profiles_music.sql`, `supabase/migrations/0003_lines_messages_jam_members.sql`, `supabase/migrations/0004_photos.sql`.
3. **Authentication → Emails → Templates → Magic Link**: make sure the email includes the code, e.g. add
   `<p>Your Out Here code: <strong>{{ .Token }}</strong></p>`. (The app signs in with the code, not the link.)
4. **Project Settings → API**: copy the Project URL and the `anon` public key.
5. In the project folder: `cp .env.example .env` and paste both values in.

### 3. Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. `npx expo start` (add `--tunnel` if your phone and computer aren't on the same Wi-Fi).
3. Scan the QR code with the iPhone camera.
4. Sign in with your email, enter the code from the email, then invite code **`FOUNDER1`** and your name. You're member #1 — the Me tab has 3 codes to share.

Your iPhone 8 (iOS 16) is supported; this SDK needs iOS 15.1+.

### 4. Turn on nearby alerts

Alerts need an Expo project ID and the Supabase function.

```bash
npx eas-cli@latest login        # free Expo account
npx eas-cli@latest init         # writes the projectId into app.json

npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set WEBHOOK_SECRET=<any-long-random-string>
npx supabase functions deploy notify-nearby --no-verify-jwt
```

Then in the Supabase dashboard → **Database → Webhooks**, create these webhooks:

| Name | Table | Events | Type | Function | HTTP header |
|---|---|---|---|---|---|
| jam-alerts | `events` | Insert | Supabase Edge Function | `notify-nearby` | `x-webhook-secret: <same string>` |
| session-alerts | `sessions` | Insert | Supabase Edge Function | `notify-nearby` | `x-webhook-secret: <same string>` |
| line-alerts | `lines` | Insert | Supabase Edge Function | `notify-nearby` | `x-webhook-secret: <same string>` |
| message-alerts | `messages` | Insert | Supabase Edge Function | `notify-nearby` | `x-webhook-secret: <same string>` |

Push in Expo Go can be limited; alerts are fully reliable in a TestFlight build (step 5).

### 5. TestFlight (when you're ready)

Needs the Apple Developer Program ($99/yr). Change `ios.bundleIdentifier` in `app.json` to one you own first.

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

Invite testers from App Store Connect → TestFlight. Apple's reviewer will need a demo login: create a test account and give them a spare invite code.

---

## Seed data

`supabase/seed.sql` adds Original Muscle Beach and South Beach Park, plus Wiggle Wednesdays, Glow Flow (starts at sunset) and Drop Squad Sunday. Durations default to 3 hours.

**To fix:** Muscle Beach coordinates are approximate — update `lat`/`lng` in the Supabase table editor.

## Project layout

```
src/app/            screens (Expo Router: every file is a route)
  (tabs)/           Map, Jams, Me
  spot/[id].tsx     spot details, check-in, jams, reviews
  spot/new.tsx      add a spot
  event/new.tsx     add a jam
src/lib/            supabase client, auth, scheduling, UI kit, theme, logo
supabase/           schema, seed, notify-nearby edge function
```

## Commands

```bash
npx expo start      # dev server
npm run typecheck   # TypeScript
```
