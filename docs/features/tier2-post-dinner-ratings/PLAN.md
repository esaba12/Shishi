# Plan: Post-Dinner Completion, Ratings & Sponsor Impact Tally

Status: **planning only** — nothing in this document has been implemented. See `RESEARCH.md` in this
same directory for the grounding (current-state confirmation + schema rationale) this plan builds on.

Scope: product bible §5.8 (two-way ratings, sponsor aggregate impact) + §8 anti-fraud "post-dinner
confirmation." Explicitly **not** in scope: "stay in touch" opt-in contact sharing, matching-algorithm
feedback loop, host funding caps, photo storage infra (no upload pattern exists anywhere in the app
today — this plan treats `photo_url` as an optional external URL, same as `profiles.photo_url`).

---

## 1. Migration

New file: `supabase/migrations/<timestamp>_dinner_completions_and_ratings.sql`

```sql
-- Tier 2: post-dinner completion (anti-fraud gate + sponsor-impact trigger, product bible §8) and
-- two-way host<->attendee ratings (product bible §5.8). Both gated on a dinner having actually been
-- confirmed by its host, not merely on dinners.status flipping to 'past' via the blind daily cron
-- (expire_past_dinners() in 20260721200000_seed_host_listings_and_expiry.sql only checks the date).

create type rating_direction as enum ('host_to_attendee', 'attendee_to_host');

-- One row per dinner: the host's one-shot "this happened" confirmation. Not updatable/deletable by
-- design (see RLS) -- both the sponsor impact tally and dinners_hosted_count key off its existence.
create table dinner_completions (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null unique references dinners (id) on delete cascade,
  confirmed_by uuid not null references profiles (id) on delete cascade,
  headcount integer not null check (headcount >= 0),
  photo_url text,
  notes text,
  confirmed_at timestamptz not null default now()
);

-- Two-way rating, one row per (dinner, rater, ratee) pair. No update/delete policy -> immutable once
-- submitted (a bad-faith party can't quietly erase a low score; disputes go through `reports`).
create table ratings (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  rater_id uuid not null references profiles (id) on delete cascade,
  ratee_id uuid not null references profiles (id) on delete cascade,
  direction rating_direction not null,
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (dinner_id, rater_id, ratee_id)
);

-- Aggregate columns, maintained by trigger below -- never client-writable directly (see column
-- privilege revoke further down, same pattern as dinners.exact_address).
alter table host_details
  add column avg_rating numeric,
  add column ratings_count integer not null default 0;

alter table profiles
  add column attendee_avg_rating numeric,
  add column attendee_ratings_count integer not null default 0;

-- === Functions & triggers ===

-- Fires once per confirmed dinner: bumps the host's real "dinners hosted" counter. Confirmed by
-- research that nothing in the codebase currently increments host_details.dinners_hosted_count --
-- it has only ever been read (profile.tsx, DinnerCard) or hardcoded via seed data. This finally wires
-- it to something real: "dinners this host confirmed actually happened."
create or replace function increment_dinners_hosted_count() returns trigger
language plpgsql security definer as $$
begin
  update host_details set dinners_hosted_count = dinners_hosted_count + 1
  where profile_id = (select host_id from dinners where id = new.dinner_id);
  return null;
end; $$;

create trigger dinner_completions_increment_hosted_count
after insert on dinner_completions
for each row execute function increment_dinners_hosted_count();

-- Recomputes the relevant aggregate (host's avg_rating or attendee's attendee_avg_rating) whenever a
-- new rating lands. Ratings are immutable (no update/delete policy) so INSERT-only is sufficient.
create or replace function update_rating_aggregate() returns trigger
language plpgsql security definer as $$
begin
  if new.direction = 'attendee_to_host' then
    update host_details set
      ratings_count = ratings_count + 1,
      avg_rating = (
        select avg(score) from ratings
        where ratee_id = new.ratee_id and direction = 'attendee_to_host'
      )
    where profile_id = new.ratee_id;
  else
    update profiles set
      attendee_ratings_count = attendee_ratings_count + 1,
      attendee_avg_rating = (
        select avg(score) from ratings
        where ratee_id = new.ratee_id and direction = 'host_to_attendee'
      )
    where id = new.ratee_id;
  end if;
  return null;
end; $$;

create trigger ratings_update_aggregate
after insert on ratings
for each row execute function update_rating_aggregate();

-- === Row Level Security ===
alter table dinner_completions enable row level security;
alter table ratings enable row level security;

-- Only the dinner's own host can confirm, only after the dinner's date has actually passed (status
-- = 'past'), and only once (unique(dinner_id) plus no update/delete policy enforces the one-shot
-- part). Mirrors the "hosts manage their own dinners" insert-check pattern already used for `dinners`.
create policy "host confirms their own past dinner" on dinner_completions
  for insert with check (
    auth.uid() = confirmed_by
    and auth.uid() in (select host_id from dinners where dinners.id = dinner_completions.dinner_id)
    and (select status from dinners where dinners.id = dinner_completions.dinner_id) = 'past'
  );

-- Visible to: the confirming host, any sponsor who funded that dinner (so the impact tally / "your
-- $ helped feed N people" detail can render), and approved attendees (dinner-detail "8 people came").
create policy "completion visible to host, funding sponsors, and approved attendees" on dinner_completions
  for select using (
    auth.uid() = confirmed_by
    or auth.uid() in (
      select sponsor_id from sponsor_donations where sponsor_donations.dinner_id = dinner_completions.dinner_id
    )
    or auth.uid() in (
      select attendee_id from rsvps
      where rsvps.dinner_id = dinner_completions.dinner_id and rsvps.status = 'approved'
    )
  );
-- Deliberately no update/delete policy: a confirmation is a one-way door once submitted.

-- attendee_to_host: rater must hold an approved rsvp for the dinner, and must be rating that dinner's
-- actual host. host_to_attendee: rater must be the dinner's host, rating one of its approved
-- attendees. Both directions additionally require the dinner to be confirmed-complete, so ratings
-- can't be pre-gamed before the dinner has even happened.
create policy "eligible approved parties can rate each other post-completion" on ratings
  for insert with check (
    auth.uid() = rater_id
    and exists (select 1 from dinner_completions where dinner_completions.dinner_id = ratings.dinner_id)
    and (
      (
        direction = 'attendee_to_host'
        and ratee_id = (select host_id from dinners where dinners.id = ratings.dinner_id)
        and exists (
          select 1 from rsvps
          where rsvps.dinner_id = ratings.dinner_id and rsvps.attendee_id = auth.uid() and rsvps.status = 'approved'
        )
      )
      or (
        direction = 'host_to_attendee'
        and auth.uid() = (select host_id from dinners where dinners.id = ratings.dinner_id)
        and exists (
          select 1 from rsvps
          where rsvps.dinner_id = ratings.dinner_id and rsvps.attendee_id = ratings.ratee_id and rsvps.status = 'approved'
        )
      )
    )
  );

-- Rater and ratee can each see a rating they gave or received; not publicly browsable row-by-row
-- (aggregates on host_details/profiles are the public-facing surface -- same visibility tier as
-- dinners_hosted_count today).
create policy "rater and ratee can view a rating" on ratings
  for select using (auth.uid() = rater_id or auth.uid() = ratee_id);
-- No update/delete policy: immutable once submitted, per the "not publicly re-editable" requirement.

-- Column-privilege lock on the two aggregate columns, same precedent as the exact_address revoke
-- above dinners: host_details and profiles both use broad "for all" self-service policies, which
-- would otherwise let a user directly UPDATE their own avg_rating. Revoke blanket UPDATE and re-grant
-- everything except the aggregate columns; only the security-definer triggers above can write them.
revoke update on host_details from authenticated;
grant update (bio, home_vibe) on host_details to authenticated;

revoke update on profiles from authenticated;
grant update (
  phone, email, name, photo_url, age, gender, origin, kosher_level, dietary_prefs, interests,
  fun_fact, is_attendee, is_host, is_sponsor
) on profiles to authenticated;
```

**Note on the two `revoke update` blocks:** these narrow existing wide-open `for all` policies down to
an explicit column allowlist. Before merging, diff the allowlists above against the *actual* current
set of client-writable columns on `profiles`/`host_details` (this plan's list is reconstructed from
`types/database.ts` and may drift if those tables gain columns before this ships) — an incomplete
allowlist would silently break existing onboarding/profile-edit flows.

---

## 2. `types/database.ts` additions

Add to the `Database["public"]["Tables"]` map: `dinner_completions` and `ratings` Row/Insert/Update
shapes (snake_case, mirroring existing tables), plus a `RatingDirection` type export. Extend
`host_details.Row` with `avg_rating: number | null` and `ratings_count: number`; extend `profiles.Row`
with `attendee_avg_rating: number | null` and `attendee_ratings_count: number`.

## 3. `types/index.ts` additions

```ts
export type RatingDirection = "host_to_attendee" | "attendee_to_host";

export interface DinnerCompletion {
  id: string;
  dinnerId: string;
  confirmedBy: string;
  headcount: number;
  photoUrl: string | null;
  notes: string | null;
  confirmedAt: string;
}

export interface Rating {
  id: string;
  dinnerId: string;
  raterId: string;
  rateeId: string;
  direction: RatingDirection;
  score: number;
  comment: string | null;
  createdAt: string;
}
```

Extend `HostDetails` with `avgRating: number | null` and `ratingsCount: number`. Extend `Profile` (or
add an optional field, since this is attendee-facing and every profile has it) with
`attendeeAvgRating: number | null` / `attendeeRatingsCount: number`.

## 4. `lib/api.ts` additions

- `fetchPendingCompletions(hostId)` — dinners where `host_id = hostId`, `status = 'past'`, and no
  matching `dinner_completions` row (left join / `not exists`). Powers the host-side prompt.
- `confirmDinnerCompletion(input: { dinnerId, headcount, photoUrl?, notes? })` — inserts into
  `dinner_completions` with `confirmed_by` set to the current user.
- `fetchPendingRatings(profileId)` — dinners the user attended (approved rsvp) or hosted, where a
  `dinner_completions` row exists, and the user hasn't yet submitted their half of the rating for the
  relevant counterpart(s). For a host this can be multiple prompts (one per approved attendee).
- `submitRating(input: { dinnerId, rateeId, direction, score, comment? })` — inserts into `ratings`.
- `fetchSponsorImpact(sponsorId)` — the aggregate query from `RESEARCH.md` §3e:
  ```ts
  export interface SponsorImpact {
    dinnersFunded: number;
    seatsFunded: number; // sum of dinner_completions.headcount for confirmed dinners only
  }
  export async function fetchSponsorImpact(sponsorId: string): Promise<SponsorImpact> {
    // select distinct sponsor_donations.dinner_id, dinner_completions.headcount
    // from sponsor_donations
    // join dinner_completions on dinner_completions.dinner_id = sponsor_donations.dinner_id
    // where sponsor_donations.sponsor_id = :sponsorId and sponsor_donations.status = 'succeeded'
    // then dinnersFunded = distinct dinner_id count, seatsFunded = sum(headcount) over those distinct dinners
  }
  ```
  Implement as a single Supabase `.select()` with an inner join (Supabase JS supports
  `sponsor_donations!inner(...)`-style embeds, or a Postgres `rpc()` wrapping the SQL above if the
  dedup-by-dinner-id logic is awkward client-side) — mirrors the existing join style already used in
  `DINNER_SELECT` (`lib/api.ts:49`).

## 5. New UI

### 5a. Host completion prompt

- Add a banner/card at the top of the "Hosting" tab in `app/(tabs)/my-dinners.tsx` when
  `fetchPendingCompletions` returns any dinners: *"You hosted at [area] on [date] — confirm it
  happened"* with a CTA into a new screen `app/dinner/[id]/confirm.tsx`.
- `confirm.tsx`: simple form — headcount (number input, defaults to `seatsTaken`/approved-RSVP count
  as a starting guess, editable), optional photo URL field (no upload widget yet, consistent with the
  rest of the app never having built photo upload — text input is an acceptable MVP stopgap; flag as
  a follow-up), optional notes, submit button calling `confirmDinnerCompletion`. On success, navigate
  back and (optionally) chain into "rate your attendees" (5b).
- Also surface the "past, not yet confirmed" state as a distinct visual treatment on
  `app/dinner/[id]/manage.tsx` (the host's per-dinner management screen) so a host who navigates
  directly to a specific dinner also sees the prompt, not only the list view.

### 5b. Rating prompts (both directions)

- New screen `app/dinner/[id]/rate.tsx`, reached from: (a) the my-dinners "Attending" tab, once a
  dinner the user attended has a `dinner_completions` row and no existing rating from that user for
  that dinner/host pair; (b) chained from the host completion flow (5a) for host→attendee ratings,
  looping over each approved attendee.
- UI: 1–5 star/score selector + optional comment textarea, submit calls `submitRating`. Once
  submitted, the prompt should not reappear (query already excludes dinners with an existing rating
  from this rater) — reinforces the "not re-editable" rule at the UX layer, not just RLS.
- Surface `host_details.avgRating` / `ratingsCount` on `app/(tabs)/profile.tsx` next to the existing
  `"Hosted {dinnersHostedCount} Shabbats"` line, e.g. `"4.8 ★ (12 ratings)"`, and on `DinnerCard` /
  dinner detail screens next to `hostDinnersHostedCount` so attendees can see it before RSVPing.

### 5c. Sponsor impact tally

- Update `app/sponsor/my-donations.tsx`: replace/augment the existing raw `totalGiven` summary block
  (lines 58, 66-69 today) with a call to `fetchSponsorImpact(profile.id)`, rendering something like:
  ```
  ₪{totalGiven} given
  {dinnersFunded} dinners funded · {seatsFunded} seats filled
  ```
  Keep the existing ₪ total as-is (it's a legitimate "money given" figure); add the new confirmed-only
  counts alongside it rather than replacing, since donors may also want to see money in-flight to
  not-yet-confirmed dinners. Also worth a per-row indicator (e.g. a small "confirmed" checkmark badge
  distinct from the existing `status` badge) on individual donation rows once that dinner has a
  `dinner_completions` row, so the distinction between "paid" and "confirmed-happened" is visible at
  the row level, not just in the aggregate.
- Same `fetchSponsorImpact` summary line could be echoed in `app/(tabs)/my-dinners.tsx`'s "Donations"
  tab (currently just the raw total, line 101-104) for consistency.

---

## 6. Verification plan

Since nothing is implemented yet, this section defines what "done" looks like once a future
implementation phase executes this plan — to be run against a seeded local/staging Supabase instance.

1. **Seed a past dinner.**
   - Insert (or reuse the existing seed migration's pattern) a dinner with `date` in the past and
     `status` manually set to `'past'` (or wait for `expire_past_dinners()` to run against a
     yesterday-dated seed row), with one `sponsor_donations` row (`status = 'succeeded'`) and one
     `rsvps` row (`status = 'approved'`) attached.
   - Expect: `fetchPendingCompletions(hostId)` returns this dinner; `fetchSponsorImpact(sponsorId)`
     returns `dinnersFunded: 0` (not yet confirmed).

2. **Host completion flow.**
   - As the host, call `confirmDinnerCompletion({ dinnerId, headcount: 6 })`.
   - Expect: row appears in `dinner_completions`; `host_details.dinners_hosted_count` for that host
     incremented by exactly 1 (verify pre/post value); `fetchPendingCompletions` no longer returns
     this dinner.
   - Attempt the same insert as a *different* user (not the host) → expect RLS rejection.
   - Attempt to confirm a dinner still `status = 'published'` (not yet past) → expect RLS rejection
     (the `and (select status ...) = 'past'` clause).
   - Attempt a second `confirmDinnerCompletion` for the same dinner (even as the correct host) →
     expect a unique-constraint violation (one-shot enforcement).

3. **Ratings — eligibility enforcement.**
   - As the approved attendee, submit `attendee_to_host` rating for the dinner's host → expect
     success; `host_details.avg_rating`/`ratings_count` updated.
   - As a *different*, non-RSVP'd user, attempt the same rating → expect RLS rejection.
   - As the host, submit `host_to_attendee` for the approved attendee → expect success;
     `profiles.attendee_avg_rating` updated for that attendee.
   - As the host, attempt to rate a user who never RSVP'd (or whose RSVP is `pending`/`declined`) to
     this dinner → expect RLS rejection.
   - Attempt any rating on a dinner with no `dinner_completions` row yet → expect RLS rejection (the
     `exists (select 1 from dinner_completions ...)` clause).
   - Re-submit an identical rating a second time → expect unique-constraint violation; attempt an
     `UPDATE` on an existing rating row directly → expect rejection (no update policy exists).

4. **Sponsor impact tally — confirmed-only counting.**
   - Re-run `fetchSponsorImpact(sponsorId)` after step 2's confirmation → expect `dinnersFunded: 1`,
     `seatsFunded: 6` (matching the `headcount` submitted).
   - Add a second `sponsor_donations` row for a *different*, still-unconfirmed past dinner from the
     same sponsor → expect `fetchSponsorImpact` unchanged (still `dinnersFunded: 1`) until that second
     dinner also gets a `dinner_completions` row, confirming the inner-join gate holds.
   - Add a `pending`/`failed` donation to an already-confirmed dinner → expect no change to the tally
     (donation-status filter still applies alongside the completion-status filter).

5. **UI smoke check** (once implemented): load `app/(tabs)/my-dinners.tsx` as the seeded host and
   confirm the pending-completion banner renders for the unconfirmed dinner and disappears after
   confirming; load `app/sponsor/my-donations.tsx` as the seeded sponsor and confirm the new
   dinners-funded/seats-filled line matches the values asserted in step 4.
