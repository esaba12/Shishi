# Tier-1 Admin View — Research

## Current state (grounded in code, 2026-07-28)

There is **zero** admin code anywhere in the repo (`mobile/app`, `mobile/lib`, `mobile/context`,
`supabase/functions` all confirmed clean of any admin/moderation surface). Per
`mobile/README.md`'s "Known gaps" section:

> No admin UI — dinner/report moderation, and flipping `dinners.sponsor_approved` to let a dinner
> into the donor feed, are manual via Supabase Studio for now.

This matches `docs/PRODUCT_BIBLE.md` §5.10 ("Admin / Moderation / Ops"), which lists as `MVP`:
"Admin dashboard: users, dinners, sponsorships, flags" and "Dinner approval workflow before a
dinner can receive sponsorship (fraud + values check)." Today both are done by a human opening
Supabase Studio's table editor and hand-editing rows.

### The two concrete manual-ops pain points

1. **`dinners.sponsor_approved`** (`supabase/schema.sql:79`) — boolean, defaults `false`. A dinner
   only appears in the sponsor donor feed once this is `true` (enforced in
   `mobile/lib/api.ts`'s `fetchSponsorFeed`, which filters `.eq("sponsor_approved", true)` — see
   lines ~611-634). Today a founder must open Supabase Studio, find the row, and flip the checkbox
   by hand. No list of "dinners awaiting approval" exists anywhere — you'd have to write raw SQL
   (`where seeking_sponsorship and not sponsor_approved`) to even find candidates.
2. **`reports`** table (`supabase/schema.sql:153-162`) — `report_status` enum
   `'open' | 'reviewed' | 'actioned'`, `reviewed_by uuid references profiles(id)`. Users can already
   file reports today via `mobile/app/report.tsx` → `createReport()` in `lib/api.ts` (line 556),
   which inserts `{ reporter_id, target_type, target_id, reason }` with `status` defaulting to
   `'open'`. But there is **no read path for anyone but the reporter** — the only `reports` SELECT
   policy is `"users can view their own reports"` (`auth.uid() = reporter_id`,
   `schema.sql:339-340`). Reports currently vanish into the table with nobody able to triage them
   except via Supabase Studio's SQL editor.

### What currently blocks any of this from being a client-side feature

- **No admin identity.** `Profile` (`mobile/types/index.ts:16-29`) has `roles: Role[]` where
  `Role = "attendee" | "host" | "sponsor"` (`types/index.ts:14`) and a `verificationTier: number`.
  Nothing resembling `isAdmin`. `profiles` table (`schema.sql:20-38`) has `is_attendee`, `is_host`,
  `is_sponsor` booleans but no `is_admin`. `AuthContext` (`mobile/context/AuthContext.tsx`) loads
  `profile`/`hostDetails`/`sponsorDetails` off these flags; there's no equivalent admin-details
  loading path.
- **RLS is entirely role-scoped to the row owner**, with zero admin bypass anywhere. Every policy in
  `schema.sql` (profiles, dinners, rsvps, sponsor_donations, potluck_items/claims, messages,
  reports) is some variant of `auth.uid() = <owner column>`. There is no `exists(select 1 from
  profiles where id = auth.uid() and <admin-ish flag>)` policy anywhere to model a new one on — this
  would be a wholly new pattern for the schema, not an extension of an existing one.
- One partial precedent for "server-role-only mutation, RLS locked for everyone" already exists:
  `sponsor_donations` has **no client-facing UPDATE policy at all** (`schema.sql:284-287`) —
  status transitions to `succeeded/failed/refunded` happen *only* via the `stripe-webhook` Edge
  Function using the service-role key (`supabase/functions/stripe-webhook/index.ts`), which
  explicitly bypasses RLS. This is the closest existing analog to "write path gated to a
  non-client-session actor," and the codebase comment on that table is explicit that this asymmetry
  is intentional ("Stricter than rsvps.payment_status... since real donor money... is on the line").

## Access-control approaches considered

### Option A — New `is_admin` boolean column + `auth.uid()`-scoped RLS policy (session-token bypass)

Add `profiles.is_admin boolean not null default false`, set manually for 1-2 founders via Supabase
Studio (never a self-service signup path — no UI anywhere lets a user set their own `is_admin`).
Add RLS policies like:

```sql
create policy "admins update sponsor_approved" on dinners
  for update using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
```

**Tradeoff:** This runs the update using the *admin's own logged-in session JWT* — RLS evaluates
`auth.uid()` against the live session, so it's exactly as strong as the admin's own auth (email/OTP
session, same as everyone else). If an admin's session/device is compromised, the attacker inherits
full read/write on whatever the admin policy covers. The blast radius is bounded by how narrowly the
policy is scoped (see below), but the policy runs on every request with no additional server-side
choke point — no logging, no extra validation step, nothing stopping a stray client-side bug from
firing a bad update.

Because a `for update using (...)` policy on `dinners` with no column-level restriction would let an
admin session update *any* column on *any* dinner (not just `sponsor_approved`), the safe version of
this must either (a) go through Postgres column-privilege revokes analogous to the existing
`exact_address` pattern (`schema.sql:254-265`) restricting the update policy's effective surface, or
(b) accept the coarser blast radius and rely on the app only ever sending `.update({
sponsor_approved })` / `.update({ status })` — but RLS can't enforce "only this column" via `USING`
alone; that requires either a trigger or restricting the grant. This is worth flagging explicitly:
**a naive USING-only admin policy is a bypass of RLS's row-level promise, not column-level, so it
is wider than it looks at first glance.**

### Option B — Route all admin writes through new service-role Edge Functions, RLS stays closed

Keep `dinners`/`reports` RLS exactly as-is for UPDATE (no admin policy added at all — closed to
everyone but the resource owner, same as `sponsor_donations` today). Add two new Edge Functions
(`admin-approve-dinner`, `admin-update-report`) that:
1. Verify the caller's JWT belongs to a profile with `is_admin = true` (an explicit check inside the
   function, using the caller's JWT to look up their profile — Supabase Edge Functions get the
   caller's JWT for free via the `Authorization` header when invoked with `supabase.functions.invoke`).
2. Only then use the **service-role key** to perform the specific, single-column update
   (`update dinners set sponsor_approved = $1 where id = $2` / `update reports set status = $1,
   reviewed_by = $2 where id = $3`).

**Tradeoff:** Strictly safer — RLS for `dinners`/`reports` stays exactly as tight as it is today for
every non-admin session, and the admin-check + the actual privileged mutation are both inside
server code you control and can log/rate-limit/audit later, mirroring the existing
`stripe-webhook`/`sponsor_donations` precedent almost exactly. Costs: two new Edge Functions to
write, deploy, and maintain (vs. "just a SQL policy"), and the admin UI needs a thin
`supabase.functions.invoke(...)` wrapper in `lib/api.ts` instead of a plain `.update()` call. Also
still needs a **read** path — Edge Functions don't help you *list* pending dinners/reports, so you
still need a SELECT-side RLS policy (Option A's `exists(...)` pattern) for reads, just not for
writes.

### Recommendation

**Use both, split by risk:** a narrow admin **SELECT** RLS policy (low risk — reads don't mutate
state, and the objects in question, `dinners` and `reports`, aren't secret to begin with; `dinners`
is already broadly SELECT-able by all authenticated users per `schema.sql:245-246`, so an admin
reading all `reports` rows is the only genuinely new grant), plus **service-role Edge Functions for
the two writes** (`sponsor_approved` flip, `reports.status`/`reviewed_by` update) rather than a
client-session RLS UPDATE policy. This avoids ever having to reason about column-level RLS bypass
risk on `dinners` (which has other mutable columns a looser admin UPDATE policy would incidentally
expose), keeps the existing "money/trust-sensitive tables are service-role-only for writes" pattern
consistent with `sponsor_donations`, and keeps the new attack surface to two small, auditable
functions instead of a standing policy that runs on every request forever.

Given this is founder-only tooling (1-2 people) and low request volume, the extra Edge Function
maintenance cost is small and worth it for the stronger guarantee. If time pressure forced a
cheaper MVP, Option A scoped tightly (a `dinners`-specific policy that, combined with a `before
update` trigger rejecting changes to any column other than `sponsor_approved`, or simply accepting
the wider blast radius as a known tradeoff for a 2-person admin team) would still be materially
better than the status quo (raw Supabase Studio access, which is already the actual current blast
radius today — an admin already has full table access via Studio, so Option A's session-scoped risk
is not strictly worse than what exists now, just formalized into the app).

## UI placement

`mobile/app/(tabs)/_layout.tsx` shows the existing desktop-vs-mobile pattern: `useResponsive()`
(`mobile/lib/responsive.ts`, `isDesktop = width >= 900`) switches the tab bar between a left rail
(`tabBarPosition: "left"`, desktop) and bottom tabs (mobile/web narrow). Admin tooling is
realistically desktop/web-only (founders triaging from a laptop), so a new `app/(admin)/` route
group, gated behind `profile.roles`/a new admin check, doesn't need to worry about a mobile bottom-
tab treatment at all — it can render as a simple desktop-width list-based screen and not be linked
from the main tab bar for non-admins.

`components/ui/` (`Screen`, `Header`, `Button`, `Card`, `TextField`, `EmptyState`, `Badge`) already
covers everything a pending-approvals list and a reports queue need — no new primitives required.
`app/report.tsx` is a good structural template for a simple list-and-act screen (`Screen` + `Header`
+ inline actions), though the admin queue screens are lists rather than single-object forms.

## Summary of concrete gaps this closes

| Gap | Today | Recommended fix |
|---|---|---|
| No admin identity | Nothing on `profiles` | `profiles.is_admin boolean not null default false`, hand-set via Studio |
| No way to list dinners awaiting sponsor approval | Manual SQL/Studio browse | New admin SELECT RLS policy on `dinners` (already broadly readable) + a "seeking, not yet approved" filtered query in a new admin screen |
| No way to flip `sponsor_approved` outside Studio | Manual Studio edit | New `admin-approve-dinner` Edge Function (service-role, checks `is_admin` first) |
| No way to read/triage `reports` beyond the reporter | RLS blocks all non-reporter reads | New admin SELECT RLS policy on `reports` |
| No way to update `reports.status`/`reviewed_by` | No UPDATE policy exists at all | New `admin-update-report` Edge Function (service-role, checks `is_admin` first) |
