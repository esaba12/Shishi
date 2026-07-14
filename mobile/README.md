# Shishi Mobile

The Shishi mobile app (Expo / React Native + TypeScript), targeting iOS and Android. Web isn't
supported as a build target since Stripe's React Native SDK and `react-native-maps` are native-only.

Scope for this pass: **Attendee** and **Host** pillars are fully functional. The **Sponsor** pillar
is present in onboarding/data model but stubbed as a "coming soon" screen — see
[`docs/PRODUCT_BIBLE.md`](../docs/PRODUCT_BIBLE.md) and the plan history for why.

## Setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL/anon key + Stripe publishable key
npm start
```

Without a `.env` configured, the app still runs end-to-end using in-memory mock data
(`data/mock.ts`) — tap **"Continue as demo user"** on the welcome screen. See `lib/env.ts`.

## Project structure

- `app/` — Expo Router routes.
  - `(auth)/` — phone/email OTP sign-in.
  - `(onboarding)/` — role selection + attendee/host/sponsor profile fields (Bible §6).
  - `(tabs)/` — Discover, My Dinners, Messages, Sponsor (placeholder), Profile.
  - `dinner/` — dinner detail, create (host), manage RSVPs (host), checkout (Stripe).
  - `messages/[dinnerId].tsx` — chat thread, unlocked post-RSVP-approval.
  - `report.tsx` — report/block flow.
- `lib/` — `supabase.ts` client, `api.ts` data layer (falls back to mock data if Supabase isn't
  configured), `env.ts` config flags.
- `context/` — `AuthContext` (session/profile/roles), `OnboardingContext` (multi-step draft state).
- `components/` — shared UI (`ui/`) and domain components (`DinnerCard`, `PhotoPicker`).
- `constants/` — theme tokens and onboarding option lists.
- `types/` — domain types (`index.ts`) and a hand-written Supabase schema stand-in
  (`database.ts` — replace with `supabase gen types typescript` once a real project exists).

## Backend

See [`../supabase/schema.sql`](../supabase/schema.sql) for the Postgres schema + RLS policies, and
[`../supabase/functions/create-payment-intent`](../supabase/functions/create-payment-intent) for the
Stripe PaymentIntent Edge Function (attendee ticketing only — sponsor/donor payments and host
payouts are out of scope for this pass; see the Bible §5.11).

## Known gaps (intentional, this pass)

- No admin UI — dinner/report moderation is manual via Supabase Studio for now.
- Dinners auto-publish (no pre-publish approval queue) since that gate exists to protect sponsor
  money, which isn't flowing yet.
- Host payouts are manual/outside the app (V2 per the Bible).
- Sponsor donor feed, sponsor↔host messaging, ID+selfie verification, ratings/reviews, and the
  personality-matching quiz are all deferred — see `docs/PRODUCT_BIBLE.md` §5/§10.
