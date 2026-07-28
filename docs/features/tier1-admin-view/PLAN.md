# Tier-1 Admin View — Plan

Planning deliverable only. Nothing in this document is implemented yet.

Scope: the smallest admin surface that replaces manual Supabase Studio edits for the two things
called out in `mobile/README.md`'s "Known gaps" — approving dinners into the sponsor donor feed
(`dinners.sponsor_approved`), and triaging `reports`. Founder-only tooling (1-2 people), web/desktop
only, no self-service admin signup.

## 1. Migration

New file: `supabase/migrations/20260728000000_add_admin_role.sql` (follows the existing
`YYYYMMDDHHMMSS_description.sql` naming convention seen in `supabase/migrations/`).

```sql
-- Founder-only admin flag. No client-facing way to set this on your own profile — set manually via
-- Supabase Studio for the 1-2 people who need it. Deliberately not part of the profiles RLS "users
-- manage their own profile" write path (see revoke below): a user must never be able to grant
-- themselves admin by updating their own row.
alter table profiles add column is_admin boolean not null default false;

-- Prevent self-service escalation: the existing "users manage their own profile" policy
-- (`for all using (auth.uid() = id) with check (auth.uid() = id)`) would otherwise let any user set
-- is_admin = true on their own row via a normal client update. Column-privilege lock, same pattern
-- already used for dinners.exact_address (schema.sql:254-265): revoke blanket UPDATE, re-grant only
-- the columns a user should be able to touch on themselves.
revoke update on profiles from authenticated;
grant update (
  phone, email, name, photo_url, age, gender, origin, kosher_level, dietary_prefs, interests,
  fun_fact, is_attendee, is_host, is_sponsor
) on profiles to authenticated;
-- is_admin and verification_tier are intentionally excluded from this grant — verification_tier
-- was already effectively founder-only (nothing in the app writes it today); is_admin now joins it.

-- Admin read access: dinners are already broadly SELECT-able by all authenticated users
-- (schema.sql:245-246), so this isn't a new exposure — it just lets an admin session filter on
-- sponsor_approved/seeking_sponsorship without needing anything additional. Kept as a read-only
-- policy; the actual sponsor_approved flip goes through admin-approve-dinner (service-role), not
-- this policy, so it's additive to the existing "published dinners are viewable" policy, not a
-- write bypass.
create policy "admins can read all dinners" on dinners
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- Admin read access to reports: today only "users can view their own reports" exists
-- (schema.sql:339-340), so nobody but the reporter can see a report at all. This is the one
-- genuinely new read grant in this migration.
create policy "admins can read all reports" on reports
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- Deliberately NO admin UPDATE policy on dinners or reports here. Per RESEARCH.md's
-- recommendation, both writes (sponsor_approved, reports.status/reviewed_by) go through new
-- service-role Edge Functions instead of a client-session RLS bypass, so RLS for UPDATE on these
-- tables stays exactly as tight as it is today for every session, admin or not.
```

Also regenerate (by hand, matching the existing hand-written style) `mobile/types/database.ts`:
add `is_admin: boolean` to `profiles.Row`/`Insert`/`Update`, and add `reviewed_by`/`status` are
already there for `reports` (no change needed there). Add `isAdmin: boolean` to the `Profile`
interface in `mobile/types/index.ts`, and update `fetchProfile()` in `mobile/lib/api.ts` to map
`data.is_admin` → `isAdmin`.

## 2. Edge Functions (service-role writes)

Two new functions under `supabase/functions/`, modeled directly on the existing
`stripe-webhook`/`create-donation-intent` pattern (service-role client, deployed via `supabase
functions deploy`). Both:
- Read the caller's JWT (Supabase passes it through automatically to `Deno.serve` handlers invoked
  via `supabase.functions.invoke`, available as the `Authorization` header).
- Look up the caller's profile with the service-role client and reject with 403 if
  `is_admin` is not `true` — this is the actual authorization check; it does not rely on RLS at all
  since the function itself holds the service-role key.
- Perform a single, narrow, parameterized update — never a generic "update this table with this
  body" passthrough.

**`supabase/functions/admin-approve-dinner/index.ts`**
- Input: `{ dinnerId: string, approved: boolean }`.
- Effect: `update dinners set sponsor_approved = $approved where id = $dinnerId`.

**`supabase/functions/admin-update-report/index.ts`**
- Input: `{ reportId: string, status: "reviewed" | "actioned" }`.
- Effect: `update reports set status = $status, reviewed_by = $callerId where id = $reportId`.

`lib/api.ts` additions (new functions, following the existing `useMockData()` fallback pattern
every other function in that file uses):

```ts
export async function fetchPendingDinners(): Promise<Dinner[]> { /* select dinners where seeking_sponsorship and not sponsor_approved and status = 'published' */ }
export async function fetchOpenReports(): Promise<Report[]> { /* select * from reports where status = 'open', newest first */ }
export async function setDinnerSponsorApproved(dinnerId: string, approved: boolean): Promise<void> {
  /* supabase.functions.invoke("admin-approve-dinner", { body: { dinnerId, approved } }) */
}
export async function updateReportStatus(reportId: string, status: "reviewed" | "actioned"): Promise<void> {
  /* supabase.functions.invoke("admin-update-report", { body: { reportId, status } }) */
}
```

Demo/mock mode (`useMockData()`): these should mutate the in-memory `data/mock.ts` arrays directly
(same convention as other mock-mode branches in `lib/api.ts`), so the admin screens are demoable
without a real Supabase project, consistent with the rest of the app's "works end-to-end on mock
data" design goal.

## 3. Route group and screens

New route group `mobile/app/(admin)/`:

- `_layout.tsx` — gate on `profile?.isAdmin`. Pattern:
  ```tsx
  const { profile, isLoading } = useAuth();
  if (isLoading) return null; // or a loading Screen
  if (!profile?.isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
  ```
  This is the client-side gate (fast, good UX — non-admins never see the screens or flash of
  content). It is **not** the security boundary: the RLS SELECT policies and the Edge Functions'
  own `is_admin` check are what actually enforce it, since a client-side `Redirect` is trivially
  bypassable by anyone editing JS in devtools. Both layers are required; neither alone is
  sufficient (this mirrors how `exact_address` is both hidden client-side and column-revoked
  server-side).
- `index.tsx` — landing/menu: two links, "Pending dinner approvals" and "Reports queue", each with
  a `Badge` (reuse `components/ui/Badge.tsx`) showing the pending count.
- `dinners.tsx` — pending-approval list:
  - `useEffect` calls `fetchPendingDinners()`.
  - Reuse `components/ui/Card.tsx` per row (dinner date/area/host name/budget_needed/
    seeking_sponsorship), `Button` (variant `"primary"` = Approve, variant `"danger"` = Reject —
    "reject" here just means leaving `sponsor_approved` false / explicitly setting it false if it
    had been true, there's no separate rejection state in the schema) wired to
    `setDinnerSponsorApproved(dinner.id, true | false)`.
    `EmptyState` (reuse `components/ui/EmptyState.tsx`) when the list is empty.
  - Optimistic remove-from-list on approve/reject, consistent with how `updateRsvpStatus` call
    sites in the existing host RSVP-management screen behave.
- `reports.tsx` — open reports queue:
  - `fetchOpenReports()` on mount.
  - Each row: `Card` showing `target_type`/`target_id`/`reason`/`created_at`, two `Button`s
    ("Mark reviewed" → `updateReportStatus(id, "reviewed")`, "Mark actioned" →
    `updateReportStatus(id, "actioned")`).
  - `target_id` for a `"profile"` report should link to that profile if a simple admin-safe profile
    view exists; for `"dinner"` it can link to the existing `app/dinner/[id]` detail screen (already
    readable, since dinners are broadly SELECT-able) — no new profile/dinner detail screen is
    needed, this is just a navigation convenience, not required for v1.

Entry point: since this is founder-only and not part of the main tab bar (`(tabs)/_layout.tsx`
stays untouched — no new tab for regular users), reuse the same technique as everywhere else that
needs a role-gated, non-tab route: a plain link. Simplest option — add a conditionally-rendered row
on `(tabs)/profile.tsx` ("Admin" list item, only rendered `if (profile?.isAdmin)`) that routes to
`/(admin)`. This keeps `(tabs)/_layout.tsx`'s tab bar (and its mobile bottom-bar variant) untouched,
since admin is a rare, secondary destination, not a primary nav item.

No `.web.tsx` platform split is needed for the admin screens themselves (unlike Stripe/maps, there's
no native-only dependency involved) — but nothing stops them from rendering on native too. Per
RESEARCH.md, desktop/web is the realistic usage pattern, not a hard technical requirement, so no
`useResponsive()` gating is needed to *block* mobile — it's just unstyled-for-narrow-screens by
default, which is acceptable for internal tooling.

## 4. Verification

1. **Non-admin is denied, client-side.** Log in (or demo-mode `continueAsDemoUser`) as a normal
   profile with `is_admin = false` (the default for every existing row post-migration). Navigate
   directly to `/(admin)` by URL. Confirm the `_layout.tsx` gate redirects home and no admin screen
   ever mounts.
2. **Non-admin is denied at the RLS/function level, independent of the client.** With the same
   non-admin session's JWT, call `supabase.from("reports").select("*")` directly (e.g. via a REPL
   or `curl` against PostgREST with that session's access token) and confirm only that user's own
   reports come back — never another user's. Separately, call the `admin-approve-dinner` and
   `admin-update-report` Edge Functions directly with that JWT and confirm they return 403 rather
   than performing the update. This is the check that actually matters — it proves the client-side
   redirect isn't the only thing stopping abuse.
3. **Admin can read pending dinners and reports.** Set `is_admin = true` on a test profile via
   Supabase Studio. Confirm `(admin)/dinners.tsx` lists dinners where `seeking_sponsorship = true
   and sponsor_approved = false`, and `(admin)/reports.tsx` lists `status = 'open'` reports from
   *any* reporter, not just the admin's own.
4. **Approving a dinner actually flips `sponsor_approved` and surfaces in the sponsor feed.** As
   the admin, approve a seeded dinner via the new UI. Confirm in Supabase Studio (or a direct
   `select`) that `dinners.sponsor_approved` is now `true`. Then, as a sponsor profile, load the
   donor feed (`fetchSponsorFeed` in `(tabs)/sponsor.tsx`) and confirm the dinner now appears (it
   was previously excluded by the `.eq("sponsor_approved", true)` filter in `lib/api.ts`).
5. **Marking a report reviewed/actioned persists and leaves an audit trail.** As the admin, mark an
   open report "reviewed." Confirm `reports.status = 'reviewed'` and `reports.reviewed_by` is set to
   the admin's own `profiles.id` (not null), and that the report drops out of the "open" queue view
   on refresh.
6. **Self-escalation is blocked.** As a non-admin session, attempt
   `supabase.from("profiles").update({ is_admin: true }).eq("id", myId)` directly. Confirm it fails
   (silently no-ops or errors) because of the column-privilege revoke in the migration — `is_admin`
   is not in the granted column list for `authenticated`.

## Explicit tradeoff being recommended

Reads (dinners, reports) go through ordinary RLS policies scoped by `is_admin` and run under the
admin's own session — low risk, since dinners are already broadly readable and reports-reading
isn't itself destructive. Writes (`sponsor_approved`, `reports.status`) go through service-role Edge
Functions that re-check `is_admin` server-side, rather than a client-session RLS UPDATE policy —
this avoids ever granting an admin's own JWT direct UPDATE privileges on tables that have other
sensitive mutable columns, at the cost of two small Edge Functions to write and deploy instead of
"just" two more SQL policies. Given this is founder-only, low-volume tooling, that extra cost is
worth it for the stronger guarantee, and it keeps the codebase's existing pattern (service-role-only
writes for trust/money-sensitive tables, as already true for `sponsor_donations`) consistent rather
than introducing a second, weaker admin-bypass pattern alongside it.
