# Push Notifications — Plan

Planning deliverable only — nothing in this doc is implemented yet. Native (iOS/Android) only; web
push is out of scope (see RESEARCH.md).

## 0. Infra prerequisites (not code, but blocking)

- `eas init` needs to be run once against the Shishi Expo account to get an EAS `projectId` — there
  is no `eas.json` in the repo today. That id goes into `app.json`'s `extra.eas.projectId`, and
  `Notifications.getExpoPushTokenAsync({ projectId })` needs it at runtime.
- Android: Expo's push service now requires the project's own Firebase (FCM v1) service account key
  uploaded to EAS credentials — Expo's shared/default push credentials for Android were retired.
  Someone needs a Firebase project + `google-services.json` before Android push works in a real
  build.
- iOS: needs an APNs key configured in the Apple Developer account, uploaded via `eas credentials`
  (standard EAS-managed flow, no extra Shishi-side plumbing beyond having an Apple Developer account,
  which the existing `bundleIdentifier: "org.shishi.app"` implies already exists).
- **Testing constraint**: Expo Go no longer supports remote push notifications (dropped for Android
  in SDK 53; treat as unsupported on both platforms for planning purposes). Verification (§7) must
  use an EAS development build (`expo-dev-client`) or a full standalone build — not `npx expo start`
  + Expo Go.

## 1. Migration: `push_tokens` table + RLS

New file: `supabase/migrations/20260728000000_push_tokens.sql`

```sql
-- Push notification device tokens (Tier 1: RSVP status, dinner reminders, address release,
-- sponsorship confirmed — see docs/PRODUCT_BIBLE.md §5.7). Native only (Expo push tokens);
-- no web-push subscriptions stored here.
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, expo_push_token)
);

alter table push_tokens enable row level security;

-- Owner-only, no cross-user SELECT policy at all (a token is bearer-like — see RESEARCH.md §2).
-- Server-side send functions use the service-role key and bypass RLS, same posture as
-- stripe-webhook reading/writing sponsor_donations.
create policy "users manage their own push tokens" on push_tokens
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Bookkeeping for the day-before reminder job (§4): marks a dinner as already reminded so the
-- hourly pg_cron pass doesn't re-notify every run once the 24h mark has passed.
alter table dinners add column reminder_sent_at timestamptz;
```

Note on the `unique (profile_id, expo_push_token)` constraint: it prevents duplicate rows for the
same person re-registering, but does NOT prevent the same token being attached to two different
profiles (e.g. device handed off between accounts) — the client-side upsert flow (§3) is responsible
for deleting any other profile's row for that token before writing its own, per RESEARCH.md §2.

## 2. Edge functions

### 2a. `supabase/functions/_shared/push.ts` (new, shared module)

A small helper imported by both new/modified edge functions below, so the Expo push API call and
token lookup logic lives in exactly one place:

```ts
// Shared by send-push-notification and stripe-webhook. Not deployed standalone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  profileId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  const { data: tokens, error } = await supabaseAdmin
    .from("push_tokens")
    .select("expo_push_token")
    .eq("profile_id", profileId);
  if (error || !tokens?.length) return;

  const messages = tokens.map((t) => ({ to: t.expo_push_token, title, body, data }));
  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  // Not handling Expo's per-token error tickets (e.g. DeviceNotRegistered) yet — a follow-up pass
  // should prune push_tokens rows that come back with that error so stale tokens don't accumulate.
}
```

### 2b. `supabase/functions/send-push-notification/index.ts` (new)

Invoked only by the RSVP-approval Database Webhook (§3). Receives the trigger payload Supabase's
`supabase_functions.http_request()` sends (the changed row under `record`/`old_record`), looks up
the attendee's name/dinner date for copy, and calls `sendPushToProfile`.

```ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushToProfile } from "../_shared/push.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const payload = await req.json();
  const rsvp = payload.record; // { id, dinner_id, attendee_id, status, ... }
  if (!rsvp || rsvp.status !== "approved") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const { data: dinner } = await supabaseAdmin
    .from("dinners")
    .select("date, area")
    .eq("id", rsvp.dinner_id)
    .maybeSingle();

  await sendPushToProfile(
    supabaseAdmin,
    rsvp.attendee_id,
    "You're in! 🕯️",
    dinner ? `Your RSVP for the ${dinner.date} dinner in ${dinner.area} was approved.` : "Your RSVP was approved.",
    { type: "rsvp_approved", dinnerId: rsvp.dinner_id }
  );

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});
```

Deploy: `supabase functions deploy send-push-notification`. Requires the `SUPABASE_SERVICE_ROLE_KEY`
secret (already required by `stripe-webhook`, so likely already set on the project).

### 2c. Database Webhook — `rsvps` → `send-push-notification`

Part of the same migration file (§1) or a follow-up one — Supabase Database Webhooks are just a
trigger using the platform's `supabase_functions.http_request()` function, so it's expressible as
plain SQL rather than requiring the Studio UI:

```sql
create trigger rsvp_approved_notify
after update of status on rsvps
for each row
when (new.status = 'approved' and old.status is distinct from 'approved')
execute function supabase_functions.http_request(
  'https://<PROJECT_REF>.supabase.co/functions/v1/send-push-notification',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '5000'
);
```

(`<PROJECT_REF>` filled in per-environment; this is the one piece of the migration that isn't
portable across dev/staging/prod projects without templating — call this out during review rather
than hardcoding blindly.)

### 2d. `stripe-webhook/index.ts` — modified (donation succeeded)

After the existing `.update({ status })` call (line ~47), on success and only for `status ===
"succeeded"`, look up the donation's sponsor and host and notify both:

```ts
import { sendPushToProfile } from "../_shared/push.ts";
// ...
if (!error && status === "succeeded") {
  const { data: donation } = await supabaseAdmin
    .from("sponsor_donations")
    .select("sponsor_id, host_id, dinner_id, amount")
    .eq("stripe_payment_id", paymentIntent.id)
    .maybeSingle();
  if (donation) {
    await sendPushToProfile(supabaseAdmin, donation.sponsor_id, "Donation confirmed 💛",
      `Your ${donation.amount} donation went through — thank you.`,
      { type: "donation_succeeded", dinnerId: donation.dinner_id });
    await sendPushToProfile(supabaseAdmin, donation.host_id, "Sponsorship confirmed",
      `A sponsor just funded your dinner.`,
      { type: "donation_succeeded", dinnerId: donation.dinner_id });
  }
}
```

This is the only edge function edit — no new HTTP hop, since `stripe-webhook` is already the trusted
writer (RESEARCH.md §3).

### 2e. `supabase/functions/send-dinner-reminders/index.ts` (new, cron-invoked)

Queries dinners whose 24h-before mark has just passed and haven't been reminded (`reminder_sent_at
is null`), pushes to host + every approved attendee, then stamps `reminder_sent_at`:

```ts
serve(async () => {
  const { data: dinners } = await supabaseAdmin
    .from("dinners")
    .select("id, host_id, date, start_time, area")
    .eq("status", "published")
    .is("reminder_sent_at", null)
    .lte("date", /* today or tomorrow, per date+start_time-24h <= now() */ new Date().toISOString());
    // exact filter: (date + start_time - interval '24 hours') <= now() — easiest expressed as an
    // RPC/view rather than PostgREST filter syntax; see note below.

  for (const dinner of dinners ?? []) {
    const { data: approved } = await supabaseAdmin
      .from("rsvps")
      .select("attendee_id")
      .eq("dinner_id", dinner.id)
      .eq("status", "approved");

    for (const r of approved ?? []) {
      await sendPushToProfile(supabaseAdmin, r.attendee_id, "Tomorrow night 🕯️",
        `Your dinner in ${dinner.area} is tomorrow — the address is now visible in the app.`,
        { type: "dinner_reminder", dinnerId: dinner.id });
    }
    await sendPushToProfile(supabaseAdmin, dinner.host_id, "Dinner tomorrow",
      `Your dinner in ${dinner.area} is tomorrow.`, { type: "dinner_reminder", dinnerId: dinner.id });

    await supabaseAdmin.from("dinners").update({ reminder_sent_at: new Date().toISOString() }).eq("id", dinner.id);
  }
  return new Response("ok");
});
```

The `date + start_time - interval '24 hours' <= now()` comparison mirrors `get_dinner_address()`'s
existing expression exactly (schema.sql line 196) — should reuse a small SQL view or RPC
(`dinners_due_for_reminder()`) rather than re-deriving the PostgREST filter syntax by hand, to avoid
the two expressions drifting out of sync the way the schema's own comment warns about for
`ADDRESS_REVEAL_HOURS_BEFORE`.

### 2f. `pg_cron` schedule (part of the migration or a follow-up SQL statement)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-dinner-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-dinner-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_OR_ANON_KEY>"}'::jsonb
  );
  $$
);
```

Same `<PROJECT_REF>` caveat as §2c.

## 3. Client-side files

### 3a. `mobile/package.json` — add dependencies

```
expo-notifications  (matching ~57.x per the existing expo-* pins)
expo-device
```

### 3b. `mobile/app.json` — add plugin entry

```json
[
  "expo-notifications",
  {
    "icon": "./assets/notification-icon.png",
    "color": "#E11D48"
  }
]
```

alongside the existing `plugins` array, plus `"extra": { "eas": { "projectId": "<from eas init>" } }`
once §0's `eas init` has run.

### 3c. `mobile/lib/pushNotifications.ts` (new)

Follows `lib/realtime.ts`'s precedent: config-gated, no-op stub shape, no scattered
`isSupabaseConfigured` checks at call sites.

```ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured, isDemoSessionActive } from "@/lib/env";

/** Requests permission, gets an Expo push token, and upserts it into push_tokens for this
 *  profile. No-ops entirely in demo mode or without a configured Supabase project — see
 *  docs/features/tier1-push-notifications/RESEARCH.md §4 for why. Safe to call on every
 *  successful sign-in; cheap no-op if permission was already granted and the token is unchanged. */
export async function registerForPushNotifications(profileId: string): Promise<void> {
  if (!isSupabaseConfigured || isDemoSessionActive()) return;
  if (!Device.isDevice) return; // simulators/emulators have no push capability

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return;

  const projectId = require("expo-constants").default.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // A token can outlive its account (see RESEARCH.md §2) — detach it from any other profile first.
  await supabase.from("push_tokens").delete().neq("profile_id", profileId).eq("expo_push_token", token);
  await supabase.from("push_tokens").upsert(
    {
      profile_id: profileId,
      expo_push_token: token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,expo_push_token" }
  );
}

/** Called from signOut() so a signed-out device stops receiving this account's pushes. */
export async function unregisterPushToken(profileId: string): Promise<void> {
  if (!isSupabaseConfigured || isDemoSessionActive()) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync().catch(() => ({ data: null }));
  if (!token) return;
  await supabase.from("push_tokens").delete().eq("profile_id", profileId).eq("expo_push_token", token);
}
```

### 3d. `mobile/context/AuthContext.tsx` — two call sites

- In `hydrateFromSession()`, after `setProfile(restoredProfile)` succeeds for a real (non-demo)
  session: `if (restoredProfile) { await loadRoleDetails(...); registerForPushNotifications(next.user.id); }`
  — fire-and-forget (don't block auth hydration on a permission prompt).
  - **Not** called from `continueAsDemoUser()` or the demo-cache-restore branch of the initial
    `useEffect` — those never touch `push_tokens`.
- In `signOut()`, before clearing `session`/`profile` state: `if (session && !isDemoSessionActive()) await unregisterPushToken(session.user.id);`

### 3e. `mobile/app/(tabs)/profile.tsx` — inert-in-demo hint (small addition, not building full settings UI)

Add a one-line status row ("Push notifications: on" once a token is registered, or the existing
demo-mode hint-banner pattern from `manage.tsx` — "Demo mode: notifications aren't available in the
demo" — when `!isSupabaseConfigured || isDemoSessionActive()`). Not building a full
enable/disable-per-category settings screen in this pass — that's a reasonable V2 add-on once these
four events are live and there's a reason to let users opt out of specific ones.

## 4. Notification events + copy (first pass, matches PRODUCT_BIBLE §5.7)

| Event | Recipient | Title | Body |
|---|---|---|---|
| RSVP approved | Attendee | "You're in! 🕯️" | "Your RSVP for the {date} dinner in {area} was approved." |
| Donation succeeded | Sponsor | "Donation confirmed 💛" | "Your {amount} donation went through — thank you." |
| Donation succeeded (host side) | Host | "Sponsorship confirmed" | "A sponsor just funded your dinner." |
| Day-before reminder + address release | Approved attendee | "Tomorrow night 🕯️" | "Your dinner in {area} is tomorrow — the address is now visible in the app." |
| Day-before reminder | Host | "Dinner tomorrow" | "Your dinner in {area} is tomorrow." |

Deliberately not doing in this pass: RSVP *declined* push (PRODUCT_BIBLE says "RSVP status", but a
push for a decline is a harsher UX call the product side should confirm before shipping — flagging
rather than silently including or excluding it for the reader of this plan), and donation *failed*
push to the sponsor (arguably more useful as an in-app banner on their next visit than a push, since
they were mid-checkout when it failed and likely still have the app open).

## 5. Verification plan

1. **Token registration**: build a development build (`eas build --profile development` or `npx
   expo run:ios`/`run:android` — not Expo Go, per §0) against a real Supabase project, sign in with a
   real (non-demo) account, grant the permission prompt, and confirm a row appears in `push_tokens`
   in Supabase Studio with the right `profile_id`/`platform`.
2. **Demo mode negative check**: launch the same build, tap "Continue as demo user," confirm no
   permission prompt fires and no row is written (query `push_tokens` — should be empty for that
   run).
3. **RSVP approved**: as a host account, approve a pending RSVP in `manage.tsx` against a real
   attendee account with a registered token; confirm the attendee's device receives the push within
   a few seconds. Cross-check via Expo's push notification tool
   (`https://expo.dev/notifications` — lets you send a one-off test push to a specific token) to
   isolate "is the token valid" from "did the trigger fire" if it doesn't arrive.
4. **Donation succeeded**: run a real (or Stripe test-mode) donation through `create-donation-intent`
   → Stripe → `stripe-webhook`, confirm both the sponsor's and host's devices receive their
   respective pushes, and confirm `sponsor_donations.status` actually flipped to `succeeded` in the
   same request (i.e. the push didn't fire on a webhook call that failed to update the row).
5. **Day-before reminder**: rather than waiting a real 24 hours, seed a test dinner with `date +
   start_time` set to just past the 24h-before threshold and `reminder_sent_at` null, manually invoke
   `send-dinner-reminders` (`supabase functions invoke send-dinner-reminders` or a direct HTTPS call)
   rather than waiting for the `pg_cron` schedule, confirm pushes land for both the host and every
   approved attendee, and confirm `reminder_sent_at` gets stamped so a second manual invocation is a
   no-op (no duplicate push).
6. **pg_cron wiring**: separately confirm the actual schedule fires unattended — check
   `cron.job_run_details` in Supabase Studio's SQL editor a few hours after deploy to see the hourly
   invocation showing up with a 200 from `net.http_post`, rather than only ever testing the manual
   invocation path in step 5.
