# OUTHERENOW

Map of movement-arts spots, weekly camps, and who's out right now — flow, slackline, acro, yoga, hiking and more. Open to everyone.

**Stack:** Expo (React Native, SDK 57) + Expo Router · Supabase (database, email sign-in, edge function) · Expo push notifications.

## What’s in v0.10

| Feature | Where |
|---|---|
| **Spots** — map with discipline filters, long-press to add, public/private, fire/lighting/surface, −5…+5 reviews | `src/app/(tabs)/index.tsx`, `src/app/spot/` |
| **Recurring camps** — weekly / every other week / one-off, fixed time or *at sunset* (computed per date), "Add to calendar" with a repeating event | `src/app/(tabs)/camps.tsx`, `src/app/camp/new.tsx`, `src/lib/schedule.ts` |
| **"I'm out here" sessions** — check in at a spot until 1–3 h or sunset; auto-expires | `src/app/spot/[id].tsx` |
| **Nearby alerts** — members pick a radius (1–50 mi); new camps, lines and check-ins push to everyone in range | `src/app/(tabs)/me.tsx`, `supabase/functions/notify-nearby` |
| **Open sign-up** — email code sign-in, then pick a name and agree to the Terms (18+) | `src/app/sign-in.tsx`, `src/app/welcome.tsx` |
| **Profiles** — photo, bio, what you do, what you're into; tap anyone checked in or reviewing to see theirs | `src/app/(tabs)/me.tsx`, `src/app/profile/[id].tsx` |
| **Music at camps** — DJ / live / speaker badge, filter camps by DJ or any music | `src/app/(tabs)/camps.tsx`, `src/app/camp/new.tsx` |
| **Going this week** — "I'm going Wednesday" for a camp's next session; who's going on the camp page, "8 going" on camp cards | `src/lib/going.tsx` |
| **Share links + QR codes** — share any camp or spot as a link, or show a QR code to print for a sign; links open the app via `docs/open.html` | `src/lib/share.ts`, `src/app/share.tsx` |
| **The line is up** — on slackline spots and camps, post what's rigged (type, length, until when); pin turns green | `src/lib/lines.tsx` |
| **Camp communities** — camp page with Join / Leave, members and organizer, My camps filter | `src/app/camp/[id].tsx` |
| **Camp photos** — cover photo per camp; thumbnails on cards and spot pages | `src/lib/jamPhoto.tsx`, `src/app/camp/new.tsx` |
| **Safety & moderation** — Terms + Community Guidelines agreement, report anything (spots, camps, reviews, check-ins, lines, profiles) with a reason, block hides a person's posts and camps, admin report queue with Remove / Ban / Dismiss, banned emails can't rejoin, report emails to the admin | `src/lib/moderation.tsx`, `src/app/admin.tsx`, `supabase/functions/notify-report` |
| **Legal & support** — Terms, Community Guidelines, Privacy Policy, Support in the app and on the web; Contact support form | `src/lib/legal.json`, `src/app/legal/[doc].tsx`, `src/app/support.tsx`, `docs/` |
| **Account deletion** — deletes the profile, uploaded photos, posts and camps you started | Me tab |
| **App Review sign-in** — password sign-in for a demo account | `src/app/sign-in.tsx` |

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
2. **SQL Editor → New query**: paste and run, one at a time and in this order: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `supabase/migrations/0002_profiles_music.sql`, `supabase/migrations/0003_lines_messages_jam_members.sql`, `supabase/migrations/0004_photos.sql`, `supabase/migrations/0005_remove_gallery_messages.sql`, `supabase/migrations/0006_repair.sql`, `supabase/migrations/0007_open_signup.sql`, `supabase/migrations/0008_app_store.sql`, `supabase/migrations/0009_going_pins.sql`, `supabase/migrations/0010_delete_spots.sql`.
3. **Authentication → Emails → Templates → Magic Link**: make sure the email includes the code, e.g. add
   `<p>Your OUTHERENOW code: <strong>{{ .Token }}</strong></p>`. (The app signs in with the code, not the link.)
4. **Project Settings → API**: copy the Project URL and the `anon` public key.
5. In the project folder: `cp .env.example .env` and paste both values in.
6. Make yourself an admin (after you've signed in once and picked a name) — SQL Editor:
   ```sql
   update public.profiles set is_admin = true
    where id = (select id from auth.users where email = 'you@example.com');
   ```
   The Me tab then shows **Moderation → Review reports**.

### 3. Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. `npx expo start` (add `--tunnel` if your phone and computer aren't on the same Wi-Fi).
3. Scan the QR code with the iPhone camera.
4. Sign in with your email, enter the code from the email, then pick your name.

Your iPhone 8 (iOS 16) is supported; this SDK needs iOS 15.1+.

### 3b. Run it without the laptop (EAS Update)

Publish the app to Expo's servers once, then open it in Expo Go any time — no `npx expo start`, no tunnel.

One-time setup (from the project folder):

```bash
npx eas-cli@latest login     # same Expo account as Expo Go
npx eas-cli@latest init      # links the project; writes extra.eas.projectId into app.json
```

Each time you want the phone to get the latest code:

```bash
npm run share                # = eas update --channel main --platform ios --environment production
```

Then on expo.dev → your project → **Updates** → open the newest update → **Preview** → scan the QR code with the iPhone camera (it opens in Expo Go). After the first time, the project stays in Expo Go's recent list.

`runtimeVersion` uses the `sdkVersion` policy (`exposdk:57.0.0`), which is what lets Expo Go load the update. Updates are built on your computer, so your `.env` values get bundled in.

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

Push in Expo Go can be limited; alerts are fully reliable in a TestFlight build (step 5).

### 4b. Report and support emails

So you hear about reports right away (Apple expects them handled within 24 hours):

```bash
npx supabase secrets set RESEND_API_KEY=<re_... from resend.com → API Keys> ADMIN_EMAIL=<your email>
npx supabase functions deploy notify-report --no-verify-jwt
```

Until your domain is verified in Resend, `ADMIN_EMAIL` must be the email you signed up to Resend with. After it's verified, also set `FROM_EMAIL="OUTHERENOW <alerts@yourdomain>"`.

Then add two more webhooks (same header as above):

| Name | Table | Events | Type | Function |
|---|---|---|---|---|
| report-emails | `reports` | Insert | Supabase Edge Function | `notify-report` |
| support-emails | `support_messages` | Insert | Supabase Edge Function | `notify-report` |

### 4c. Terms, Privacy and Support pages on the web

The App Store listing needs a Privacy Policy URL and a Support URL. The same text the app shows is in `src/lib/legal.json`; `npm run legal` rebuilds the web pages in `docs/`.

1. Put your support email in `"contactEmail"` in `src/lib/legal.json` and run `npm run legal`.
2. GitHub → repo **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/docs` → Save.
3. A minute later they're live:
   - Privacy Policy: `https://outherenow.app/privacy.html`
   - Support: `https://outherenow.app/support.html`
   - Terms: `https://outherenow.app/terms.html`
   - Share links land on `https://outherenow.app/open.html?camp=<id>`, which opens the app. Once the app is on the App Store, set `APP_STORE_URL` in `docs/open.html` so the "Get OUTHERENOW" button goes there.

Share links open the installed app (TestFlight / App Store). Expo Go can't be opened by `outhere://` links, so while testing in Expo Go they only show the web page.


### 5. TestFlight (when you're ready)

Needs the Apple Developer Program ($99/yr). The bundle ID is `com.outherenow.app`; register it in your Apple Developer account (or change it in `app.json` first).

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

Invite testers from App Store Connect → TestFlight.

**Demo account for App Review** (Apple's reviewer can't receive your email codes):

1. Supabase → **Authentication → Users → Add user → Create new user**: an email like `appreview@yourdomain`, a strong password, tick **Auto Confirm User**.
2. Sign in once on your phone with **Sign in with password** (bottom of the sign-in screen), pick a name, agree to the Terms, then sign out.
3. In App Store Connect → your app → **App Review Information**: tick *Sign-in required*, enter that email and password, and add a note: "Tap 'Have a password? Sign in with password' at the bottom of the sign-in screen."


---

## Seed data

`supabase/seed.sql` adds Original Muscle Beach and South Beach Park, plus Wiggle Wednesdays, Glow Flow (starts at sunset) and Drop Squad Sunday. Durations default to 3 hours.

**To fix:** Muscle Beach coordinates are approximate — update `lat`/`lng` in the Supabase table editor.

## Project layout

```
src/app/            screens (Expo Router: every file is a route)
  (tabs)/           Map, Camps, Me
  spot/[id].tsx     spot details, check-in, camps, reviews
  spot/new.tsx      add a spot
  camp/             camp page, start / edit a camp
  welcome.tsx       name + Terms agreement
  admin.tsx         report queue (admins)
  support.tsx       contact support
  legal/[doc].tsx   Terms, Guidelines, Privacy, Support
src/lib/            supabase client, auth, scheduling, moderation, legal text, UI kit, theme, logo
supabase/           schema, seed, notify-nearby + notify-report edge functions
docs/               public web pages (GitHub Pages)
```

## Commands

```bash
npx expo start      # dev server
npm run typecheck   # TypeScript
npx expo lint       # lint
npm run legal       # rebuild docs/ from src/lib/legal.json
npm run share       # publish to Expo Go (EAS Update, channel main)
npm run share:testflight  # publish JS changes to TestFlight / App Store builds (channel production)
```
