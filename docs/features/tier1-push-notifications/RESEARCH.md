# Push Notifications — Research

Scope: native (iOS/Android) Expo push notifications only. Web push is a separate, lower-priority
concern (different permission model, different token type — a web push subscription, not an Expo
push token — and no existing web-notification UI anywhere in this codebase) and is explicitly out
of scope for this MVP pass. Everything below assumes the native app.

Covers the four system notifications named in `docs/PRODUCT_BIBLE.md` §5.7: **RSVP status**,
**dinner reminders**, **address release**, **sponsorship confirmed**. None of this exists today.

## 1. Current state (confirmed by reading the code)

- `mobile/package.json` has no `expo-notifications`, no `expo-device`. Zero push infra. Expo SDK
  is `~57.0.1` / RN `0.86.0` / `expo-router ~57.0.2`.
- `mobile/app.json` has no `expo-notifications` plugin entry, no `extra.eas.projectId`, and there is
  no `eas.json` in the repo at all — this project has never been through `eas init`/`eas build`.
  Getting a real Expo push token requires a `projectId`, so that's a real setup step, not just a
  code change (see PLAN.md's Infra prerequisites).
- **RSVP approval** lives in `mobile/app/dinner/[id]/manage.tsx`: the host taps Approve/Decline,
  which calls `updateRsvpStatus(rsvpId, status)` in `mobile/lib/api.ts` (line ~311), which does a
  plain client-side `supabase.from("rsvps").update({ status }).eq("id", rsvpId)`. This is allowed by
  the RLS policy `"attendee or host can update an rsvp"` (schema.sql line 274) — no edge function is
  involved. **This means there is no single trusted server-side chokepoint for RSVP status changes**
  the way there is for donations — any of {host's client, a future admin tool, direct SQL} could
  flip an rsvp to `approved`. A notification hook that only fires from `manage.tsx`'s call site
  would miss those other paths.
- **Donation status** is the opposite: `sponsor_donations.status` has *no client UPDATE policy at
  all* (schema.sql line 284's comment is explicit about this). The only writer is
  `supabase/functions/stripe-webhook/index.ts`, which runs with the service-role key and flips
  `pending` → `succeeded`/`failed` after verifying the Stripe signature. This is already the single
  trusted chokepoint — a notification for "sponsorship confirmed" can hook in right there with no
  new trigger plumbing.
- `mobile/lib/realtime.ts` is the existing precedent for "Supabase-triggered client behavior": it
  no-ops when `!isSupabaseConfigured` (see `mobile/lib/env.ts`), and otherwise opens a
  `postgres_changes` channel. That pattern (config-gate via `lib/env.ts`, no-op stub in demo mode)
  is exactly what a `lib/pushNotifications.ts` should follow — see §4.
- `mobile/lib/env.ts` has two flags worth distinguishing: `isSupabaseConfigured` (is a real project
  wired up at all) and `isDemoSessionActive()` (is *this session* the local-only demo user, set by
  `AuthContext`). Push registration must gate on both — even against a real Supabase project, a demo
  session's `profile.id` is the literal string `"demo-user"`, which is not a valid FK into
  `profiles.id`, so an insert into a new `push_tokens` table would fail (or worse, if `profiles.id`
  weren't enforced, would silently misattribute a token).
- `mobile/context/AuthContext.tsx`'s `hydrateFromSession()` is the one function that runs after every
  real sign-in, restored session, and auth-state-change event — it's the natural place to trigger
  token registration for real users. `continueAsDemoUser()` and the demo-cache restore path in the
  initial `useEffect` are the two places that must *not* trigger it.
- `supabase/migrations/` has two files so far (`20260721182227_init_schema.sql`,
  `20260721200000_seed_host_listings_and_expiry.sql`) — a new migration for this feature follows
  that same timestamp-prefixed naming convention.
- Supabase's `pg_net` extension and the `supabase_functions` schema (which backs the Studio
  "Database Webhooks" UI) ship enabled by default on hosted Supabase projects, including the free
  tier. `pg_cron` is also available as an extension to enable on the free tier as of the current
  Supabase platform, though cron job frequency/reliability guarantees are a paid-tier feature in some
  plans — treat "every N minutes" scheduling as best-effort on free tier, not SLA'd.

## 2. Token storage design

New table, `push_tokens`, one row per (profile, installed device):

```sql
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_id text, -- expo-device's installationId-equivalent; lets us upsert per-install rather than
                   -- accumulating a stale duplicate row every time permissions are re-requested
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, expo_push_token)
);
```

Two things worth flagging rather than hand-waving:

- **A token can outlive its account.** If user A signs out and user B signs into the same physical
  device, the Expo push token itself doesn't change — only the row's `profile_id` should. The
  registration flow (PLAN.md §3) must delete any *other* profile's row for that same
  `expo_push_token` before inserting/upserting its own, or B's actions will keep pinging A's device.
- RLS should be strictly owner-only — a push token is bearer-like (whoever holds it can address a
  push to that device via a much bigger surface than this app), so it should never be broadly
  readable the way `profiles`/`dinners` are (`auth.role() = 'authenticated'` policies). Model it after
  `sponsor_details`' "owner only" policy, not `profiles`' "viewable by authenticated users" one:

```sql
alter table push_tokens enable row level security;

create policy "users manage their own push tokens" on push_tokens
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
```

No `authenticated`-wide SELECT policy at all — hosts don't need to read attendees' tokens; the only
code that reads across profiles is the service-role edge function, which bypasses RLS entirely (same
posture as `stripe-webhook` reading/writing `sponsor_donations`).

## 3. Trigger architecture — options considered

The real design question is: **what actually calls Expo's push API, and what invokes that thing?**
Sending itself is a single `POST https://exp.host/--/api/v2/push/send` with a JSON body of
`{to, title, body, data}` (no third-party push SDK needed server-side — Expo's push service is just
an HTTP API + Deno's `fetch`, so it belongs naturally in an edge function).

**What invokes it, per event:**

| Event | Where the status change actually happens | Option A | Option B | Recommendation |
|---|---|---|---|---|
| RSVP → `approved` | Client-side `.update()` from any authorized caller (`manage.tsx` today, but RLS permits others) | Postgres trigger (Database Webhook) on `rsvps` UPDATE → edge function | Call an edge function explicitly from `manage.tsx`'s `respond()` after `updateRsvpStatus` succeeds | **A** — decoupled from the call site, fires regardless of which client/tool changes the row, matches the "don't trust the client, trust the data" posture the schema already uses elsewhere |
| Donation → `succeeded`/`failed` | Already server-side only, inside `stripe-webhook` | Inline in `stripe-webhook` after its existing `.update()` succeeds | Postgres trigger → edge function (same as RSVP) | **A (inline)** — `stripe-webhook` is already the single trusted writer; adding one more `fetch` call after its existing update is simpler than adding a second HTTP hop through a DB trigger for a table that's already server-controlled |
| Day-before reminder / address release | Not a row-change event at all — it's a **time passing** a threshold (`date + start_time - 24h`, the same expression `get_dinner_address()` already uses) | `pg_cron` job on a schedule, calling an edge function that queries "dinners crossing the 24h mark since last run" | External scheduler (Vercel Cron, since the web build already deploys to Vercel; or a third-party cron pinging a webhook URL) | **`pg_cron`** — see below |

**Recommendation in full:**

1. **RSVP approved** → a Postgres trigger on `rsvps` (`AFTER UPDATE OF status ... WHEN (new.status = 'approved' AND old.status IS DISTINCT FROM 'approved')`) that calls Supabase's built-in `supabase_functions.http_request()` trigger function (this is exactly what creating a "Database Webhook" in Studio generates, and it can be written directly as SQL in a migration instead of clicking through Studio) to POST to a new edge function, `send-push-notification`.
2. **Donation succeeded** → `stripe-webhook/index.ts` calls a small shared helper directly (see PLAN.md) after its existing `supabaseAdmin.from("sponsor_donations").update(...)` succeeds. No new trigger needed — it's already the trusted writer.
3. **Day-before reminder + address release** → these are the *same moment* (both keyed off `date + start_time - interval '24 hours'`, per `get_dinner_address()`), so one scheduled edge function, `send-dinner-reminders`, covers both in one notification per recipient rather than two. A `pg_cron` job (e.g. hourly) invokes it via `pg_net.http_post`; the function queries dinners whose 24h mark just passed and haven't been reminded yet (see PLAN.md for the "haven't been reminded yet" bookkeeping column), and pushes to the host + every approved attendee.

Why `pg_cron` over an external scheduler: it keeps the whole feature inside Supabase (no new
external account/secret to manage, no dependency on the mobile team's Vercel web deploy being up),
and it's the same "Postgres is the source of truth for when things fire" philosophy the rest of this
schema already follows (see `update_dinner_amount_funded()`'s trigger, `get_dinner_address()`'s
time-gate). The tradeoff, stated plainly: `pg_cron` reliability/frequency on Supabase's free tier is
best-effort, not SLA'd — acceptable for an hourly reminder job, worth revisiting if this becomes
time-critical.

Both the RSVP-approval trigger and the `send-dinner-reminders` cron call an edge function that reads
`push_tokens` — that function must use the service-role key (same posture as `stripe-webhook`),
since RLS on `push_tokens` is owner-only and this function needs to read across every recipient.

## 4. Demo mode behavior

Demo mode (`!isSupabaseConfigured` or `isDemoSessionActive()`) must never:
- Prompt for native push permission (there's no backend to register a token against, and
  prompting inside a sales-demo/no-account flow is bad UX — `manage.tsx` already shows an explicit
  "Demo mode: ..." hint banner rather than silently no-opping; a Profile-screen notifications toggle
  should follow the same pattern, visibly inert with an explanatory hint, not just quietly do
  nothing).
- Attempt to write to `push_tokens` (the FK to `profiles.id` would reject the literal
  `"demo-user"` id used throughout `AuthContext`, so this would need to be prevented in application
  code, not just left to fail loudly against the DB).

Concretely: `lib/pushNotifications.ts`'s registration function should early-return (no-op, same
shape as `realtime.ts`'s `NOOP_UNSUBSCRIBE` guard) whenever `!isSupabaseConfigured ||
isDemoSessionActive()`, checked at the call site in `AuthContext.hydrateFromSession()` — never
called at all from `continueAsDemoUser()`.

## 5. Copy source

Notification copy (title/body per event) is specified in PLAN.md §5, informed by
`docs/PRODUCT_BIBLE.md` §5.7's four named events: RSVP status, dinner reminders, address release,
sponsorship confirmed.
