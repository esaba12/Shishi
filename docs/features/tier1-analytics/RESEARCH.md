# Tier-1 Analytics — Research

## Current state (grounded in code, 2026-07-28)

Confirmed via repo-wide grep (`analytics|posthog|amplitude|segment\.|mixpanel|track\(`, all of
`mobile/`) — there is **zero** analytics or event-tracking code anywhere in the codebase. No SDK
dependency in `mobile/package.json`, no custom event-logging utility in `mobile/lib/`, no
`.identify(`/`.track(`/`.capture(` call anywhere in `mobile/app/`, `mobile/context/`, or
`mobile/components/`. The team's only signal today is Supabase Studio's raw table browser and
Stripe's dashboard — there is no way to see where users drop off in onboarding, what fraction of
dinner views convert to an RSVP, or what fraction of donor-feed impressions convert to a donation.

### Relevant existing architecture to build on

- **Provider tree** (`mobile/app/_layout.tsx:54-65`): `SafeAreaProvider > ToastProvider >
  AuthProvider > PaymentProvider > Stack`. Any analytics provider needs to sit *inside*
  `AuthProvider` (to read `profile` for `identify()`) and *outside* the `Stack` (so it mounts once,
  app-wide).
- **Auth/session state** (`mobile/context/AuthContext.tsx`): `profile.id` (a UUID, real Supabase
  user id or the literal string `"demo-user"` in demo mode — see `continueAsDemoUser`,
  line 179-190) is the only stable per-user identifier. `profile` also carries real PII: `name`,
  `photoUrl`, `age`, `gender`, `origin`, `kosherLevel`, `dietaryPrefs`, `interests`, `funFact`
  (`types/index.ts`, `Profile`).
- **Demo mode** (`mobile/lib/env.ts`): `isSupabaseConfigured` is a build-time flag (env vars
  present or not); `isDemoSessionActive()` is a runtime flag set by `AuthContext` whenever the
  active session is the local-only demo user rather than a real Supabase Auth session — notably
  this stays `true` even if a real Supabase project *is* configured, because `continueAsDemoUser`
  fakes a session in memory without ever hitting Supabase Auth (`lib/env.ts:7-11` comment). Per
  `mobile/app/(auth)/welcome.tsx:52`, the "Continue as demo user" button itself only renders when
  `!isSupabaseConfigured`, so in practice today demo traffic and unconfigured-build traffic are the
  same population — but the two flags are checked independently in the plan below since they're
  logically distinct and `isDemoSessionActive()` is the one documented as intended for exactly this
  "route mock vs. real" purpose.
- **Platform-split pattern already established**: `lib/payments.tsx` / `lib/payments.web.tsx` and
  `lib/donationCheckout.tsx` / `lib/donationCheckout.web.tsx` already split native vs. web
  implementations behind one shared interface, because Stripe's native SDK
  (`@stripe/stripe-react-native`) can't ship to the web bundle. Analytics needs the identical split
  (native PostHog SDK vs. `posthog-js` for web) — this is not a new pattern, it's reusing one that
  already exists twice in `lib/`.
- **Static web export**: per `mobile/README.md`, web deploys via `npx expo export -p web` to a
  static SPA on Vercel — no Node server, no API routes, no way to proxy analytics calls
  server-side. Whatever SDK is chosen has to work as a pure client-side script bundled into that
  static export.

## Tool recommendation: PostHog

**Recommendation: PostHog Cloud** (US or EU region — see privacy section), using
`posthog-react-native` for iOS/Android and `posthog-js` for the web export, behind one shared
`lib/analytics.ts` / `lib/analytics.web.ts` interface (mirroring the existing `payments.tsx` split).

### Why PostHog over the alternatives

| Tool | RN + web parity | Self-host option | Early-stage pricing | Fit for this repo |
|---|---|---|---|---|
| **PostHog** | First-class SDKs for both (`posthog-react-native`, `posthog-js`), same dashboard, same event schema | Yes — open-source, can self-host later without re-instrumenting (same API) | 1M events/mo free, then usage-based; no seat fees | Matches the existing native/web platform-split pattern exactly |
| Amplitude | Separate RN and web SDKs, workable but less unified tooling around cross-platform funnels | No — proprietary SaaS only | ~50k MTUs free, then jumps quickly | Solid analytics but no self-host escape hatch given this app handles payment + PII data |
| Segment | Not an analytics UI itself — a routing layer that still needs a destination (e.g. Amplitude/Mixpanel/PostHog) bolted on | No | Paid from day one at meaningful volume | Adds a second vendor and cost for no benefit at this stage — there's only one destination needed right now |
| Mixpanel | Decent RN SDK, workable web SDK | No | Free tier exists but pricing/seat model is punishing as usage grows | No structural advantage over PostHog here, and no self-host story |
| Firebase Analytics | App-only story is fine, but GA4-for-web is a *different* product with a different data model — would mean two disconnected reporting surfaces for one funnel (native app vs. static web export) | No | Free, but that's the only advantage | Reintroduces Google-services native linking the project has otherwise avoided, and breaks the "one funnel, one dashboard" goal since a user can complete a funnel across native+web |

Key deciding factors specific to this repo:

1. **One codebase, three platforms, one funnel.** A single user might browse on mobile web and
   RSVP in the native app, or vice versa. PostHog is the only option here where one project/API key
   gives one unified funnel across both SDKs without a second product (GA4) or a routing
   middleman (Segment).
2. **The project already accepts custom native builds.** `@stripe/stripe-react-native` and
   `react-native-maps` are both non-Expo-Go native modules, so this app already requires an EAS
   dev/production build to run on device — "must work in Expo Go" is not a constraint here, which
   removes what would otherwise be PostHog RN's main friction point.
3. **Self-host is a real escape hatch, not just a checkbox.** Given this app handles legal names,
   photos, and Stripe donation records (see privacy section below), keeping the option to move to
   self-hosted PostHog later — using the same client code, just a different `EXPO_PUBLIC_POSTHOG_HOST`
   — is valuable and no other option on this list offers it.
4. **Free tier matches actual early-stage volume.** 1M events/month covers this app's likely
   traffic for a long time before any pricing conversation is needed.

### Tradeoffs / honest downsides of PostHog

- Session replay and feature flags are bundled in but not needed for this plan — mentioned only so
  they aren't mistaken for required scope; this plan does not turn them on.
- PostHog's RN SDK autocaptures fewer things "for free" than, say, Amplitude's; this plan uses
  explicit `track()` calls everywhere rather than relying on autocapture, so that gap doesn't
  matter here — see PLAN.md.
- PostHog Cloud is US-region by default; the EU region option must be chosen explicitly at project
  creation if data residency for Israeli/EU sponsor donor PII becomes a requirement (see privacy
  section) — this is a one-time setup decision, not a code concern.

## Funnels and events worth tracking

Prioritized to match the four funnels named in the task, each grounded in an actual function in the
current codebase (exact event names and properties are specified in PLAN.md):

1. **Onboarding (role-select → profile fields).** `mobile/app/(onboarding)/role-select.tsx`,
   `attendee.tsx`, `host.tsx`, `sponsor.tsx`, `done.tsx`. This is the funnel most likely to have
   silent drop-off today — `onboardingStepCount()` (`lib/onboardingSteps.ts`) shows the flow is
   already variable-length (2-4 steps depending on chosen roles), which is exactly the kind of
   funnel that's impossible to reason about without step-level instrumentation. `done.tsx` also
   has a real failure path (`status === "error"`, line 56-62) that today only shows a toast — an
   `onboarding_failed` event turns a currently-invisible failure into a monitorable one.
2. **Signup/auth** (`mobile/app/(auth)/`). Magic-link email auth (`email.tsx`, `verify.tsx`,
   `login.tsx`) has an inherent drop-off point — a user can submit their email and then never click
   the emailed link, and the app has no way to know that happened today. Tracking
   "link requested" vs. "link/code verified" as two separate events is the only way to see that
   gap.
3. **Discovery → RSVP** (`(tabs)/index.tsx` → `dinner/[id]/index.tsx` → `dinner/[id]/checkout.tsx`).
   This is the core attendee conversion funnel and the one most directly tied to revenue for paid
   dinners. `handleRsvp()` (dinner detail) and `handlePay()` (checkout) are the two concrete
   conversion moments; `pay()`'s `PayResult { ok, error }` return shape
   (`lib/payments.tsx`/`.web.tsx`) already distinguishes success/failure, so a failed-payment event
   is nearly free to add.
4. **Sponsor donor-feed → donate** (`(tabs)/sponsor.tsx` → `dinner/[id]/donate.tsx`). Same
   reasoning as above, plus one extra signal worth capturing that the task didn't call out: the
   `NonSponsorUpsell` component (`sponsor.tsx:18-45`) is shown to any non-sponsor who taps the
   Sponsor tab — tracking that view is a cheap way to measure "how many people are curious about
   sponsoring but never onboarded as one," which today leaves zero trace.
5. **Messaging** (`components/messages/ConversationView.tsx`, shared by
   `app/messages/[dinnerId].tsx` and the desktop split view). Lower priority than the above four but
   cheap to add alongside them since the component is already centralized — `handleSend()` is the
   one conversion point. Message *content* must never be sent (see privacy section).

## Demo mode handling

Demo mode should **not** be a hard no-op. Two reasons:

- Most local development happens in demo mode (no `.env` configured is the documented default —
  `mobile/README.md:21-22`), so a hard no-op would mean the instrumentation is never exercised
  during day-to-day development, and event bugs (typos in event names, missing properties) would
  only surface once real users hit production.
- The team may want to sanity-check the *onboarding persona flow itself* using demo data (e.g. "did
  our internal test of the sponsor persona actually fire `donate_completed`?").

Instead: every event should carry a boolean property, e.g. `is_demo: isDemoSessionActive() ||
!isSupabaseConfigured`, computed at call time (both flags are cheap synchronous reads — see
`lib/env.ts`). This lets the PostHog dashboard filter demo traffic out of default insights (a saved
"Real users" filter on `is_demo = false`) without discarding the ability to see demo events when
debugging the instrumentation itself. This also sidesteps needing a second PostHog project/API key
for dev — one project, one key, filtered by property, which is the simpler operational setup for an
early-stage team.

## Privacy / PII considerations

This app handles real names, profile photos, and Stripe-backed payments/donations (with donor legal
name + receipt email — see `dinner/[id]/donate.tsx:26-27,112-125`), so analytics needs explicit
guardrails, not just "install SDK and start calling `.track()` everywhere":

- **Identify by UUID only.** Call `identify(profile.id, ...)` using the existing `Profile.id` —
  never pass `name`, `photoUrl`, email, or phone as the distinct ID or as a person property. In demo
  mode `profile.id` is the literal string `"demo-user"` for every demo session on every device,
  which is fine (it's already tagged `is_demo: true` and isn't a real identifier anyway).
- **Never send `exact_address`.** The schema already revokes wildcard `SELECT` access to
  `dinners.exact_address` server-side (`mobile/README.md`'s "Backend" section, `get_dinner_address`
  RPC) — analytics events must not accidentally re-expose it client-side by including the resolved
  `revealedAddress`/`dinner.exactAddress` value from `dinner/[id]/index.tsx` in any event property.
  Only send `dinner_id`, never the address string.
- **Never send donor legal name, receipt email, or message body.** `donate.tsx`'s
  `donorLegalName`/`donorReceiptEmail` fields and `ConversationView.tsx`'s message `body` are
  free-text PII entered by the user for a specific transactional purpose (a donation receipt, a
  chat message) — they must never appear as event properties. `donate_completed` should carry
  `amount`/`anonymous`/`dinner_id`, not the donor's name or email; `message_sent` should carry
  `dinner_id` only, never `body`.
- **Photo URLs**: don't pass `profile.photoUrl` in any event property. It's already
  semi-public within the app (visible to matched attendees/hosts) but there's no analytics reason to
  duplicate it into a third-party system.
- **No autocapture / no session replay in this pass.** PostHog's autocapture and session-replay
  features can inadvertently record free-text form fields (onboarding bio fields, the donation
  amount/name inputs, chat composer) — this plan uses only explicit, allow-listed `track()` calls
  and does not enable either feature. If session replay is wanted later, it needs explicit input
  masking configured first as its own follow-up, not bundled into this pass.
- **GDPR/CCPA and a possible consent banner**: PostHog's web SDK persists a distinct ID via
  `localStorage` by default, which is functionally similar to a cookie for consent-banner purposes
  depending on jurisdiction and how "essential" the analytics is judged to be. This plan does not
  resolve that — it's a product/legal call (whether Shishi's current privacy policy already covers
  this, and whether a consent banner is needed on the web export for EU/Israeli visitors) that
  should happen before this ships to production traffic, not something to decide in code. Flagging
  it here so it isn't silently skipped.
- **Region**: if data residency ends up mattering (sponsor donor PII, Israeli user base per the
  product's Tel Aviv-centric mock data), create the PostHog Cloud project in the EU region up front
  — switching regions later requires a full data migration, whereas choosing correctly at project
  creation is free.
