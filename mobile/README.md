# Shishi Mobile

The Shishi app (Expo / React Native + TypeScript), targeting iOS, Android, **and web**. Web deploys
to Vercel as a static SPA export (`vercel.json` → `npx expo export -p web`); native-only dependencies
(Stripe's React Native SDK, `react-native-maps`) are platform-split via `.web.tsx` file overrides so
they never reach the web bundle.

**Attendee**, **Host**, and **Sponsor** are all fully functional pillars — a sponsor browses a donor
feed of dinners seeking funding and donates toward one, an attendee/host flow runs end to end
including payment, and messaging connects host↔attendee and host↔sponsor once a donation succeeds.
See [`docs/PRODUCT_BIBLE.md`](../docs/PRODUCT_BIBLE.md) for the full product spec.

## Setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL/anon key + Stripe publishable key
npm start
```

Without a `.env` configured, the app still runs end-to-end using in-memory mock data
(`data/mock.ts`) — tap **"Continue as demo user"** on the welcome screen. See `lib/env.ts`.

To build the web version the way Vercel does:

```bash
npx expo export -p web
cp -r public/. dist/
node scripts/inject-html-meta.js
```

## Project structure

- `app/` — Expo Router routes.
  - `(auth)/` — phone/email OTP sign-in; desktop (≥900px) gets a distinct landing page
    (`components/landing/DesktopLanding.tsx`), mobile/tablet get the compact welcome screen.
  - `(onboarding)/` — role selection + attendee/host/sponsor profile fields (Bible §6).
  - `(tabs)/` — Discover, My Dinners, Messages, Sponsor (donor feed), Profile. Desktop gets a sidebar
    nav rail instead of a bottom tab bar (`(tabs)/_layout.tsx`), and Discover gets a persistent
    list+map split view (`components/discover/DiscoverDesktopLayout.tsx`).
  - `dinner/` — dinner detail, create (host), manage RSVPs (host), checkout (attendee ticket
    payment), donate (sponsor donation), potluck (host checklist editor).
  - `sponsor/my-donations.tsx` — a sponsor's donation history.
  - `messages/[dinnerId].tsx` — chat thread. Threads are keyed by (dinner, counterpart) — see
    `lib/threadKey.ts` — not by dinner alone, since a dinner can host several independent
    conversations (multiple approved attendees, or a host and a sponsor). Real-time via
    `lib/realtime.ts` when Supabase is configured; polls on send/focus in demo mode.
  - `report.tsx` — report/block flow.
- `lib/` — `supabase.ts` client, `api.ts` data layer (falls back to mock data if Supabase isn't
  configured), `env.ts` config flags, `payments.tsx`/`.web.tsx` and `donationCheckout.tsx`/`.web.tsx`
  (platform-split Stripe checkout — native uses PaymentSheet, web uses Stripe.js Payment Element in a
  Modal), `realtime.ts` (Supabase Realtime subscriptions, no-op in demo mode), `responsive.ts`
  (breakpoints for the desktop layouts above).
- `context/` — `AuthContext` (session/profile/roles), `OnboardingContext` (multi-step draft state).
- `components/` — shared UI (`ui/`, including the candlelight-motif `SelectCard`/`Reveal`/
  `StepProgress` used throughout onboarding and the donor feed) and domain components (`DinnerCard`,
  `SponsorDinnerCard`, `PhotoPicker`).
- `constants/` — theme tokens (semantic only — `colors.brand`/`bg`/`textPrimary`/etc, no legacy
  aliases) and onboarding option lists.
- `types/` — domain types (`index.ts`) and a hand-written Supabase schema stand-in
  (`database.ts` — replace with `supabase gen types typescript` once a real project exists).
- `scripts/inject-html-meta.js` — post-processes the exported `dist/index.html` with a real
  `<title>`, OG/Twitter meta tags, and manifest/icon links, since `app.json`'s `web.output: "single"`
  means `app/+html.tsx` isn't rendered into the export (see that file's header comment).
- `public/` — static web assets copied into `dist/` at build time (manifest, PWA icons, the
  placeholder social-preview image) — not handled automatically by `expo export`, hence the explicit
  `cp` step in `vercel.json`'s `buildCommand`.

## Backend

See [`../supabase/schema.sql`](../supabase/schema.sql) for the Postgres schema + RLS policies. Two
notable hardening details:

- `dinners.exact_address` has no direct `SELECT` grant — wildcard column access is revoked, and the
  `get_dinner_address` Postgres function (`security definer`) is the only way to read it, enforcing
  host-or-approved-and-past-reveal-window server-side (previously this was a client-only check).
- Sponsor donations (`sponsor_donations`) have no client-facing `UPDATE` policy at all — only the
  `stripe-webhook` Edge Function, using the service-role key, can move a donation out of `pending`.

Edge Functions in [`../supabase/functions/`](../supabase/functions/):

- `create-payment-intent` — attendee ticket payment (unchanged).
- `create-donation-intent` — sponsor donation. Charges land in Shishi's own centralized Stripe
  account (no per-host Stripe Connect) — this is a donation to the platform, earmarked for a dinner,
  not a payment to the host, per the Bible's cross-border/nonprofit-compatibility note (§11).
- `stripe-webhook` — the only writer of `sponsor_donations.status`.

## Known gaps (intentional, this pass)

- No admin UI — dinner/report moderation, and flipping `dinners.sponsor_approved` to let a dinner
  into the donor feed, are manual via Supabase Studio for now.
- Host payouts are manual/outside the app (V2 per the Bible) — a donation marks a dinner's budget as
  funded/earmarked; it doesn't move money to the host automatically.
- Tax-deductibility is not claimed anywhere in the donation flow — Shishi's nonprofit entity
  (501(c)(3)/"American Friends of") doesn't exist yet. `app/dinner/[id]/donate.tsx` has a marked TODO
  for where that disclosure slots in once it does.
- There's no way to add the sponsor (or host) role to an existing account after onboarding — role
  selection only happens once, at signup. `(tabs)/profile.tsx` doesn't offer this yet.
- ID+selfie verification, ratings/reviews, and the personality-matching quiz are still deferred — see
  `docs/PRODUCT_BIBLE.md` §5/§10.
