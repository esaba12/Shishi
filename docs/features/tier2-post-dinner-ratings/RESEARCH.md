# Research: Post-Dinner Completion, Ratings & Sponsor Impact Tally

Status: planning only. No application code changed as part of this document.

## 1. What the product bible actually asks for

- **§5.8 Reputation, Reviews & Feedback** (all `V2`):
  - Post-dinner two-way ratings (host ↔ attendee), Airbnb-style.
  - Post-dinner feedback feeding the matching algorithm (out of scope here — no matching algorithm exists yet either).
  - "Stay in touch" mutual opt-in contact sharing (out of scope here).
  - **Sponsor sees aggregate impact** ("you've funded 12 dinners / 140 seats").
- **§8 Trust, Safety & Verification, "Anti-fraud (protecting sponsors' money)"**:
  - Dinners must be reviewed/approved before they can receive sponsorship (already built: `dinners.sponsor_approved`, toggled manually per the schema comment).
  - **"Post-dinner confirmation (headcount / photo) before or as a condition of releasing funds."** This does not exist yet.
  - Caps on cumulative host funding (explicitly out of scope for this feature — separate V2 item).
- **§10 Suggested MVP Cut** explicitly defers "ratings/reviews" to V2, confirming this whole feature is intentionally not yet built and is fair game for a scoped "tier 2" pass.

## 2. Confirmed current state (grep + file reads)

- **No ratings/reviews mechanism anywhere.** The only "review"/"rating" string hits in the codebase are unrelated copy — the profile screen's static disclaimer text ("Verified via phone + email. Government-ID verification is coming in a later update... Report a concern") and message-preview styling. There is no `ratings` table, no rating UI, no rating API function.
- **No post-dinner completion/confirmation mechanism.** `dinners.status` (`supabase/schema.sql:7`) is `'published' | 'cancelled' | 'past'` — a plain three-state enum with **no fraud-facing "did this actually happen" gate**. The transition to `'past'` is fully automatic and content-blind:
  - `supabase/migrations/20260721200000_seed_host_listings_and_expiry.sql` installs `expire_past_dinners()`, a `pg_cron` job (`'0 3 * * *'`) that does exactly:
    ```sql
    update dinners set status = 'past' where status = 'published' and date < current_date;
    ```
  - This means a dinner flips to `'past'` purely because the calendar date passed — regardless of whether the host confirms anyone actually showed up, whether the host even opened the app, or whether the dinner was real at all. This is precisely the gap §8 calls out: no headcount/photo confirmation gates anything.
  - A second cron job, `delete_expired_dinners()`, hard-deletes rows 30 days after `'past'` — so any new completion data needs to be captured well inside that 30-day window or it's gone (`sponsor_donations` rows would cascade-delete too via `on delete cascade` on `dinner_id`, so this affects future audit/impact queries as well).
- **Sponsors get zero post-donation feedback loop.** `app/sponsor/my-donations.tsx` (mobile) is the only donation-history screen. It shows, per donation: dinner host name, area, date, amount, `SponsorDonation.status` badge (`succeeded`/`pending`/`failed`/`refunded`), and a "Message host" button gated on `status === 'succeeded'`. It also renders one aggregate line — `₪{totalGiven} given across {N} dinners` — but this is a **raw sum of all `succeeded` donations**, not gated on whether the dinner actually happened. There is no "seats funded" or "impact" concept, no per-dinner confirmation state surfaced, nothing distinguishing "I funded a dinner that happened" from "I funded a dinner that's still 3 weeks out" or even one that got cancelled after the money cleared (cancellation doesn't reverse `succeeded` donations in the current schema/trigger).
  - `types/index.ts`'s `SponsorDonation` has no photo/headcount/completion field at all (`id, dinnerId, hostId, sponsorId, donorLegalName, donorReceiptEmail, amount, currency, status, message, anonymous, createdAt`).
  - The `update_dinner_amount_funded()` trigger (`schema.sql:168-180`) keeps `dinners.amount_funded` as a live sum of `succeeded` donations — this is the closest thing to an "impact" number today, and it's dinner-scoped, not sponsor-scoped, and again unconditional on completion.
- **`hostDetails.dinnersHostedCount` is a bare counter with no rating attached.**
  - Defined in `types/index.ts` (`HostDetails.dinnersHostedCount: number`), backed by `host_details.dinners_hosted_count` (`schema.sql:41-46`, default `0`).
  - Displayed in `app/(tabs)/profile.tsx` (`"Hosted {hostDetails.dinnersHostedCount} Shabbats"`) and denormalized onto `Dinner.hostDinnersHostedCount` for display on dinner cards (`lib/api.ts:49-59`, joined via `host_details(dinners_hosted_count)`).
  - **Nothing increments this column anywhere in the codebase.** There is no trigger, no RPC, no app-side call that mutates `dinners_hosted_count` — grep across `mobile/lib/api.ts` and `supabase/*.sql` finds it only ever read, never written except the seed migration's hardcoded seed values (12, 50, 8, 30). It is dead/aspirational data today: a host could create zero dinners and the seed number would still show, or a host could complete 20 real dinners and the number would never move. This confirms the UI already implies a reputation system that was never wired up.

## 3. Recommended schema design

### 3a. `dinner_completions` — the anti-fraud gate + impact trigger

One row per dinner, written once by the host after the dinner's date has passed. Serves two purposes simultaneously: (1) the §8 anti-fraud "did this really happen" gate, and (2) the trigger condition for sponsor impact and for incrementing `dinners_hosted_count`.

```sql
create table dinner_completions (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null unique references dinners (id) on delete cascade,
  confirmed_by uuid not null references profiles (id) on delete cascade, -- must equal dinners.host_id
  headcount integer not null check (headcount >= 0),
  photo_url text,
  notes text,
  confirmed_at timestamptz not null default now()
);
```

Design notes:
- `unique (dinner_id)` — one confirmation per dinner, not editable into multiple rows. Combined with no UPDATE/DELETE policy for the host (see RLS below), this makes confirmation a one-shot, append-only action — consistent with "not publicly re-editable after submission" and preventing a host from quietly walking back a completion after sponsor impact was already counted.
- `confirmed_by` is denormalized (rather than trusting `dinners.host_id` alone at read time) so RLS's `with check` can pin the writer to themselves without an extra join, mirroring the existing `sponsor_donations.host_id` denormalization pattern already used in this schema for the same reason (see `schema.sql:105` comment).
- `photo_url` is nullable — don't hard-block a host who forgot their phone from confirming; headcount alone is enough to satisfy "post-dinner confirmation" per §8's phrasing ("headcount / photo", read as either, not both required). Product can decide later whether photo becomes mandatory before sponsor payout release; nullable keeps this migration additive and non-blocking today.
- No `status` enum (e.g. no "disputed" state) — out of scope for this pass. If a report is later filed disputing a completion, that flows through the existing generic `reports` table (`target_type = 'dinner'`), not a new state machine here.
- Deliberately **not** reusing `dinners.status = 'past'` as the completion signal, because (as confirmed above) that transition is a blind cron job with zero human confirmation — conflating "calendar date passed" with "someone confirmed this happened" is exactly the bug §8 is warning against.

### 3b. `ratings` — two-way host ↔ attendee ratings

```sql
create type rating_direction as enum ('host_to_attendee', 'attendee_to_host');

create table ratings (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  rater_id uuid not null references profiles (id) on delete cascade,
  ratee_id uuid not null references profiles (id) on delete cascade,
  direction rating_direction not null,
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (dinner_id, rater_id, ratee_id) -- one rating per pair per dinner, not re-editable via new rows
);
```

Design notes:
- `direction` is technically derivable from whether `rater_id = dinners.host_id`, but storing it explicitly makes the RLS policies and any future read-side aggregation (e.g. "average score received as a host" vs "as an attendee") a flat filter instead of a join — cheap, and self-documenting for anyone reading the table without loading `dinners`.
- `unique (dinner_id, rater_id, ratee_id)` is the "not publicly re-editable after submission" mechanism: no UPDATE policy is granted (see RLS below), so once inserted a rating is immutable; the unique constraint additionally blocks a rater from just inserting a second, contradictory row for the same person/dinner.
- Attendee-to-host is one row per dinner (host is singular). Host-to-attendee needs one row *per attendee* the host wants to rate — the schema supports this naturally since `ratee_id` varies; no special-casing needed.
- No `is_public`/visibility column: ratings roll up into aggregates only (see aggregate field below), individual comments are host/ratee-private in this pass. If public review text becomes a requirement later, that's an additive column + RLS policy, not a redesign.

### 3c. Aggregate rating field(s)

Two additive columns, maintained by trigger (mirroring the existing `update_dinner_amount_funded()` pattern):

```sql
alter table host_details add column avg_rating numeric, add column ratings_count integer not null default 0;
alter table profiles add column attendee_avg_rating numeric, add column attendee_ratings_count integer not null default 0;
```

`host_details` gets the host-facing aggregate (shown next to `dinners_hosted_count`); a lighter attendee-facing aggregate lives on `profiles` since attendees don't have their own details table. A single trigger function on `ratings` AFTER INSERT recomputes both, branching on `direction`.

### 3d. Wiring `dinners_hosted_count` to actually increment

Since research confirmed nothing currently writes this column, the natural fix bundled into this same migration: an AFTER INSERT trigger on `dinner_completions` that does
```sql
update host_details set dinners_hosted_count = dinners_hosted_count + 1
where profile_id = (select host_id from dinners where id = NEW.dinner_id);
```
This makes `dinners_hosted_count` finally mean something — "dinners this host has confirmed actually happened" — rather than dead seed data, and ties the profile-page stat to the same anti-fraud gate instead of just "dinners created."

### 3e. Sponsor impact tally

No new column needed — computed as a query, joining the three tables already involved:

```sql
select
  count(distinct sd.dinner_id)               as dinners_funded,
  coalesce(sum(d.capacity), 0)               as seats_funded  -- or dc.headcount for actual attendance
from sponsor_donations sd
join dinners d on d.id = sd.dinner_id
join dinner_completions dc on dc.dinner_id = sd.dinner_id   -- inner join: only counts CONFIRMED dinners
where sd.sponsor_id = :sponsor_id
  and sd.status = 'succeeded';
```

Key design choice: **inner join to `dinner_completions`**, not a left join with a null-check. This is what makes "only counts confirmed-complete dinners" structural rather than a client-side filter that could be bypassed or forgotten in a future query. Whether "seats" means `dinners.capacity` (funded capacity) or `dinner_completions.headcount` (actual attendance) is a product call — `headcount` is more honest ("you funded a dinner that fed 9 people") and is recommended, since it's the number the anti-fraud confirmation itself produced.

This can ship as a plain query inside `fetchMyDonations`-adjacent API code (a new `fetchSponsorImpact(sponsorId)` in `lib/api.ts`) rather than a materialized view or new table — low enough cardinality (one sponsor's donations) that no caching/materialization is needed at MVP scale.

## 4. RLS considerations

- **`dinner_completions`**
  - INSERT: `with check (auth.uid() = confirmed_by and auth.uid() in (select host_id from dinners where id = dinner_id))` — only the dinner's own host can confirm, mirroring the existing `"hosts manage their own dinners"` pattern (`schema.sql:247-248`).
  - No UPDATE or DELETE policy granted to `authenticated` at all (same "deliberately no update/delete" pattern already used for `sponsor_donations`, `schema.sql:284-287) — a confirmation is a one-way door once submitted. If a correction is ever needed, that's an admin/service-role action, not a client one.
  - SELECT: the confirming host, any sponsor who donated to that dinner (`auth.uid() in (select sponsor_id from sponsor_donations where dinner_id = dinner_completions.dinner_id)`), and probably any approved attendee too (so the dinner detail screen can show "hosted, 8 people came" — low sensitivity, no PII beyond a headcount/photo the host chose to submit).
  - Should also enforce **the dinner must already be `'past'`** before a completion can be inserted — add `and (select status from dinners where id = dinner_id) = 'past'` to the INSERT check, so a host can't "confirm" a dinner that hasn't happened yet (defeating the whole point of a post-dinner gate).

- **`ratings`**
  - INSERT `with check`: `auth.uid() = rater_id`, plus an eligibility check depending on `direction`:
    - `attendee_to_host`: rater must have an `rsvps` row for that dinner with `status = 'approved'`, and `ratee_id` must equal `dinners.host_id`.
    - `host_to_attendee`: rater must equal `dinners.host_id`, and `ratee_id` must have an approved `rsvps` row for that dinner.
  - Both directions should also require the dinner to be `'past'` (or, more precisely, that a `dinner_completions` row exists) — rating before the dinner happened doesn't make sense and would let people pre-game aggregates.
  - No UPDATE policy (immutable after submission, per the ask). No DELETE policy either for the same reason — a bad-faith host/attendee shouldn't be able to erase a low rating; disputes go through `reports`.
  - SELECT: rater and ratee can each see ratings they gave/received; whether an attendee can see a *host's* full incoming rating history (to inform an RSVP decision) is a product call — recommended: yes for aggregates (`host_details.avg_rating`, already publicly selectable like `dinners_hosted_count` today) but no for individual `ratings` rows/comments (keep those rater/ratee-only, consistent with messages-style privacy elsewhere in this schema).

- **Aggregate columns** (`host_details.avg_rating`, `profiles.attendee_avg_rating`) — written only by the trigger (`security definer`), never directly by client `UPDATE`; existing `"hosts manage their own host details"` / `"users manage their own profile"` `for all` policies would otherwise let a user hand-edit their own rating, so those two columns need either a trigger-only write path (current plan) or a column-privilege revoke identical to the `exact_address` pattern already in this schema (`schema.sql:254-265`) if `for all` policies can't be split. Recommend following the `exact_address` precedent: revoke blanket UPDATE on `avg_rating`/`ratings_count` columns specifically, since `host_details`/`profiles` already use broad `for all` policies.

## 5. Open questions / product calls to flag in the plan

- Does a sponsor's impact tally count `capacity` (funded) or `headcount` (actual attendance)? Recommended: `headcount`, more defensible and honest.
- Is `photo_url` on `dinner_completions` ever mandatory, or always optional? Recommended: optional at MVP, revisit once photo storage/upload UI exists (none exists in the codebase today — no `supabase.storage` or `ImagePicker` usage found anywhere in `mobile/`).
- Should a cancelled dinner's already-`succeeded` donations be refunded? Out of scope for this feature (existing gap, not introduced by this design) — flagged, not solved, in the plan.
