# Tier-1 Analytics — Implementation Plan

Scope: wire up PostHog (see RESEARCH.md for rationale) with explicit `track()` calls at the funnel
points that matter, correctly split for native vs. web, tagged for demo mode, and free of PII. No
autocapture, no session replay, no feature flags — just events.

## 1. New dependencies (`mobile/package.json`)

```
"posthog-react-native": "^3.x"   // native (iOS/Android)
"posthog-js": "^1.x"             // web (react-native-web export)
```

Add via `npx expo install posthog-react-native posthog-js` from `mobile/` so Expo resolves
SDK-57-compatible versions and surfaces any additional peer deps (e.g. `expo-file-system`,
`expo-application`, `expo-device`, `expo-localization`) that need adding alongside — confirm the
exact peer-dep list at install time rather than guessing versions here. No native config plugin
work should be required beyond what `expo install` sets up automatically; if it turns out one is
needed, that's a signal to re-check the "no Expo Go constraint" assumption in RESEARCH.md before
proceeding.

## 2. Env vars (`mobile/lib/env.ts` + `mobile/.env.example`)

Add to `lib/env.ts`, following the exact pattern already used for `isSupabaseConfigured`/
`isStripeConfigured`:

```ts
export const isAnalyticsConfigured = Boolean(process.env.EXPO_PUBLIC_POSTHOG_KEY);
export const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
```

Add to `.env.example` (two new lines alongside the existing Supabase/Stripe ones):

```
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Without these set, `isAnalyticsConfigured` is `false` and `lib/analytics.ts`'s `initAnalytics()`
should no-op entirely (so local machines with no PostHog project configured don't error or spam a
placeholder key) — this is a separate gate from `is_demo`; a real deployed build with a real
PostHog key still tags demo-user sessions as `is_demo: true`, it just doesn't skip sending them.

## 3. New file: `mobile/lib/analyticsEvents.ts`

Shared event-name constants and prop types so screens import typed constants instead of raw
strings (mirrors how `types/database.ts` centralizes shared shapes). One file, used by both the
native and web analytics implementations and by every screen below.

```ts
export const AnalyticsEvent = {
  // Auth
  WelcomeViewed: "welcome_viewed",
  SignupEmailSubmitted: "signup_email_submitted",
  LoginEmailSubmitted: "login_email_submitted",
  OtpVerified: "otp_verified",
  DemoPersonaSelected: "demo_persona_selected",
  // Onboarding
  OnboardingRoleSelected: "onboarding_role_selected",
  OnboardingProfileCompleted: "onboarding_profile_completed",
  OnboardingHostDetailsCompleted: "onboarding_host_details_completed",
  OnboardingSponsorDetailsCompleted: "onboarding_sponsor_details_completed",
  OnboardingCompleted: "onboarding_completed",
  OnboardingFailed: "onboarding_failed",
  // Discovery -> RSVP
  DiscoverViewed: "discover_viewed",
  DinnerViewed: "dinner_viewed",
  RsvpAttempted: "rsvp_attempted",
  RsvpCompleted: "rsvp_completed",
  CheckoutViewed: "checkout_viewed",
  CheckoutPaymentAttempted: "checkout_payment_attempted",
  CheckoutPaymentCompleted: "checkout_payment_completed",
  CheckoutPaymentFailed: "checkout_payment_failed",
  // Sponsor donor-feed -> donate
  DonorFeedViewed: "donor_feed_viewed",
  DonorFeedUpsellViewed: "donor_feed_upsell_viewed",
  DonateViewed: "donate_viewed",
  DonateAttempted: "donate_attempted",
  DonateCompleted: "donate_completed",
  DonateFailed: "donate_failed",
  // Messaging
  ConversationOpened: "conversation_opened",
  MessageSent: "message_sent",
} as const;
```

## 4. New files: `mobile/lib/analytics.ts` (native) + `mobile/lib/analytics.web.ts` (web)

Same platform-split pattern as `lib/payments.tsx`/`lib/payments.web.tsx`. Both export the identical
interface so calling code never branches on platform:

```ts
export function initAnalytics(): void;
export function identifyUser(userId: string, props?: Record<string, unknown>): void;
export function track(event: string, props?: Record<string, unknown>): void;
export function resetAnalytics(): void; // call on sign-out
```

**`analytics.ts` (native)**: wraps `posthog-react-native`. `initAnalytics()` no-ops if
`!isAnalyticsConfigured`; otherwise constructs a `PostHog` client with `posthogApiKey`/`posthogHost`,
`captureAppLifecycleEvents: false` (explicit — no autocapture per RESEARCH.md), stores the instance
module-level (singleton, same approach `lib/supabase.ts` uses for its client). `track()` and
`identifyUser()` are no-ops if the client was never initialized.

**`analytics.web.ts`**: wraps `posthog-js`. `initAnalytics()` calls `posthog.init(posthogApiKey, {
api_host: posthogHost, autocapture: false, capture_pageview: false, disable_session_recording: true
})` — every autocapture-adjacent flag explicitly turned off, matching the native side's opt-out
posture and the "no autocapture" decision in RESEARCH.md. `capture_pageview: false` specifically
because Expo Router's static export doesn't have PostHog-recognizable page loads the way a
traditional multi-page site does — screen views are tracked explicitly per screen below instead.

Every `track()` call site in this plan is responsible for adding `is_demo:
isDemoSessionActive() || !isSupabaseConfigured` itself (not baked into the wrapper), so it's
visible at each call site — see RESEARCH.md's demo-mode section for why both flags are checked.

## 5. New file: `mobile/components/AnalyticsProvider.tsx`

A thin provider, same shape as `components/PaymentProvider.tsx`, placed **inside** `AuthProvider` so
it can read `useAuth()`:

```tsx
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAuthenticated } = useAuth();
  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => {
    if (isAuthenticated && profile) {
      identifyUser(profile.id, { roles: profile.roles, is_demo: isDemoSessionActive() || !isSupabaseConfigured });
    } else {
      resetAnalytics();
    }
  }, [isAuthenticated, profile]);
  return <>{children}</>;
}
```

## 6. Modify `mobile/app/_layout.tsx`

Insert `AnalyticsProvider` between `AuthProvider` and `PaymentProvider` (line ~57-61):

```tsx
<AuthProvider>
  <AnalyticsProvider>
    <PaymentProvider>
      ...
    </PaymentProvider>
  </AnalyticsProvider>
</AuthProvider>
```

## 7. Screen-by-screen event wiring

Each entry: file, call site (existing function/handler), event, key properties. `dinner_id`
everywhere refers to `Dinner.id`, never any address/PII field.

| File | Call site | Event | Properties |
|---|---|---|---|
| `app/(auth)/welcome.tsx` | mount (`useEffect`) | `WelcomeViewed` | `{ is_desktop, demo_available: !isSupabaseConfigured }` |
| `app/(auth)/email.tsx` | `handleContinue()`, after `requestOtp` resolves | `SignupEmailSubmitted` | `{ role: role ?? null, mode: isSupabaseConfigured ? "magic_link" : "demo_code" }` |
| `app/(auth)/login.tsx` | `handleContinue()`, after `requestOtp` resolves | `LoginEmailSubmitted` | `{ mode: isSupabaseConfigured ? "magic_link" : "demo_code" }` |
| `app/(auth)/verify.tsx` | `handleVerify()`, after `verifyOtp` resolves | `OtpVerified` | `{}` |
| `app/(auth)/demo-role.tsx` | `handleContinue()` | `DemoPersonaSelected` | `{ persona: selected }` |
| `app/(onboarding)/role-select.tsx` | `handleContinue()` | `OnboardingRoleSelected` | `{ roles: selected, role_count: selected.length }` |
| `app/(onboarding)/attendee.tsx` | its continue handler (final step before host/sponsor or done) | `OnboardingProfileCompleted` | `{ has_photo: !!profile.photoUrl }` |
| `app/(onboarding)/host.tsx` | its continue handler | `OnboardingHostDetailsCompleted` | `{}` |
| `app/(onboarding)/sponsor.tsx` | its continue handler | `OnboardingSponsorDetailsCompleted` | `{ budget_ceiling: sponsorDetails.budgetCeiling ?? null }` |
| `app/(onboarding)/done.tsx` | `completeOnboarding().then(...)` success branch (line ~28) | `OnboardingCompleted` | `{ roles: draft.roles }` |
| `app/(onboarding)/done.tsx` | `.catch(...)` branch (line ~29) | `OnboardingFailed` | `{ roles: draft.roles }` |
| `app/(tabs)/index.tsx` | mount / on `load()` success | `DiscoverViewed` | `{ kosher_filter: kosherFilter, radius_km: radiusKm, view }` |
| `app/dinner/[id]/index.tsx` | `load()` success | `DinnerViewed` | `{ dinner_id: id, is_free: dinner.isFree, approval_mode: dinner.approvalMode, seats_left: dinner.capacity - dinner.seatsTaken }` |
| `app/dinner/[id]/index.tsx` | start of `handleRsvp()` | `RsvpAttempted` | `{ dinner_id: dinner.id, is_free: dinner.isFree }` |
| `app/dinner/[id]/index.tsx` | in `handleRsvp()`, after `createRsvp()` resolves (free-dinner path only — paid dinners complete via checkout.tsx below) | `RsvpCompleted` | `{ dinner_id: dinner.id, auto_approved: dinner.approvalMode === "auto_accept" }` |
| `app/dinner/[id]/checkout.tsx` | mount | `CheckoutViewed` | `{ dinner_id: dinner.id, amount: dinner.costPerHead }` |
| `app/dinner/[id]/checkout.tsx` | start of `handlePay()` | `CheckoutPaymentAttempted` | `{ dinner_id: dinner.id, amount: dinner.costPerHead }` |
| `app/dinner/[id]/checkout.tsx` | in `handlePay()`, `result.ok === true` branch, after `confirmRsvp()` | `CheckoutPaymentCompleted` | `{ dinner_id: dinner.id, amount: dinner.costPerHead }` |
| `app/dinner/[id]/checkout.tsx` | in `handlePay()`, `result.ok === false` branch and `catch` | `CheckoutPaymentFailed` | `{ dinner_id: dinner.id, error: result.error ?? "unknown" }` |
| `app/(tabs)/sponsor.tsx` | `DonorFeed`'s `load()` success | `DonorFeedViewed` | `{ dinner_count: dinners.length }` |
| `app/(tabs)/sponsor.tsx` | `NonSponsorUpsell` mount | `DonorFeedUpsellViewed` | `{}` |
| `app/dinner/[id]/donate.tsx` | mount (after `fetchDinner` resolves) | `DonateViewed` | `{ dinner_id: dinner.id, remaining_budget: remaining }` |
| `app/dinner/[id]/donate.tsx` | start of `handleDonate()` | `DonateAttempted` | `{ dinner_id: dinner.id, amount: Number(amount), anonymous }` |
| `app/dinner/[id]/donate.tsx` | in `handleDonate()`, success branch | `DonateCompleted` | `{ dinner_id: dinner.id, amount: Number(amount), anonymous }` |
| `app/dinner/[id]/donate.tsx` | in `handleDonate()`, `!result.ok` branch | `DonateFailed` | `{ dinner_id: dinner.id, error: result.error ?? "unknown" }` |
| `components/messages/ConversationView.tsx` | mount (`load()` success) | `ConversationOpened` | `{ dinner_id: dinnerId }` |
| `components/messages/ConversationView.tsx` | `handleSend()`, after `sendMessage()` resolves | `MessageSent` | `{ dinner_id: dinnerId }` — **never** `body` |

Every `track()` call adds `is_demo` itself, per §4 above — omitted from the properties column here
to avoid repeating it 24 times.

## 8. Verification

1. **Static checks**: `cd mobile && npm run typecheck` passes with the new files/imports (no `any`
   leaks from the PostHog SDK's types into call sites).
2. **Native, demo mode**: run `npm start`, open in a dev client (or simulator via `npm run ios`),
   tap "Continue as demo user" through each persona (attendee/host/sponsor), complete onboarding,
   RSVP to a free dinner, pay for a paid dinner (demo Stripe branch), donate as a sponsor persona,
   send a message. With `EXPO_PUBLIC_POSTHOG_KEY` set to a real test project's key even while
   Supabase/Stripe stay unconfigured, confirm every event above appears in PostHog's **Activity ▸
   Events** live view within a few seconds, each carrying `is_demo: true`.
3. **Native/web, configured mode**: point `.env` at a real (or Supabase local/staging) project and a
   test Stripe key, repeat the same walkthrough as a real signed-up account via the email
   magic-link flow, confirm the same event set fires with `is_demo: false`, and confirm
   `identifyUser` correctly attaches `profile.id` (check the PostHog **Persons** tab shows one
   merged person across the session rather than an anonymous-only entry).
4. **Web build parity**: run `npx expo export -p web`, serve the `dist/` export locally (e.g. `npx
   serve dist`), and repeat the discovery→RSVP and donor-feed→donate walkthroughs in a browser.
   Confirm events appear in PostHog from the web SDK too, and that no page-view-shaped noise events
   appear (`capture_pageview: false` doing its job) — the web funnel should contain the same named
   events as native, not a parallel set.
5. **PII spot-check**: in PostHog's event properties for `DonateCompleted`/`MessageSent`/
   `DinnerViewed`, confirm no `donorLegalName`, `donorReceiptEmail`, message `body`, `photoUrl`, or
   address string ever appears — grep the diff for any of those identifiers being passed into a
   `track()` call as a final check before merging.
6. **Funnel sanity check**: build one PostHog funnel insight for
   `WelcomeViewed → SignupEmailSubmitted → OtpVerified → OnboardingCompleted` and one for
   `DinnerViewed → RsvpAttempted → RsvpCompleted`/`CheckoutPaymentCompleted`, using the walkthrough
   sessions from steps 2-4 as the underlying data, to confirm the events are actually structured in
   a way that produces a sensible funnel (not just that each event fires in isolation).

## Out of scope (explicitly deferred, not part of this plan)

- Session replay, feature flags, or any other PostHog product beyond event capture.
- A consent banner / cookie-notice UI for the web export (flagged as a product/legal open question
  in RESEARCH.md, not resolved here).
- Server-side event capture from the Stripe webhook Edge Function
  (`supabase/functions/stripe-webhook/`) — all events in this plan are client-fired only; a
  server-side `DonateCompleted` mirror (to catch cases where the client never gets to report
  success, e.g. app closed mid-webhook) is a reasonable future improvement but adds a second
  PostHog integration point (server-side capture from Deno) that's out of scope for this pass.
- Self-hosting PostHog — this plan uses PostHog Cloud; migrating to self-hosted is a config change
  (`EXPO_PUBLIC_POSTHOG_HOST`) for a later phase, not part of this implementation.
