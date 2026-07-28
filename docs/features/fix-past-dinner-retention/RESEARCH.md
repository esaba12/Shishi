# Fix: past dinners are hard-deleted 30 days later, cascading away donation/reputation history

## Current state (confirmed against the actual code)

`supabase/migrations/20260721200000_seed_host_listings_and_expiry.sql`:

- `expire_past_dinners()` flips `dinners.status` to `'past'` once `date < current_date`, run daily via
  `pg_cron` at 03:00 (`cron.schedule('expire-past-dinners-daily', '0 3 * * *', ...)`).
- `delete_expired_dinners()` **hard-deletes** `dinners` rows 30 days after they went `'past'`, run daily at
  03:15. The migration's own comment calls this "a safety window rather than immediately" — i.e. it reads
  as a PII-retention decision (don't keep exact addresses/host-location data forever), not a decision to
  discard financial or reputation history.
- Confirmed via `grep -n "on delete" supabase/schema.sql`: `sponsor_donations.dinner_id`,
  `rsvps.dinner_id`, `potluck_items.dinner_id`, `messages.dinner_id` all reference `dinners(id) on delete
  cascade`. So the hard delete takes every donation, RSVP, potluck item, and message tied to that dinner
  down with it.

## Why this matters, independent of any new feature

This is already a live problem today: `app/sponsor/my-donations.tsx`'s donation-history list silently
loses any donation whose dinner is more than ~30 days past, with no indication to the sponsor that
history is being discarded — a sponsor checking "what have I funded this year" gets an incomplete answer
after the first month.

It becomes a harder blocker the moment the `tier2-post-dinner-ratings` feature ships: that plan's own
research (`docs/features/tier2-post-dinner-ratings/RESEARCH.md`) explicitly flags that its new
`dinner_completions` and `ratings` tables (both `references dinners(id) on delete cascade`) would lose
data on the same 30-day cycle — meaning a host's long-term rating average and a sponsor's cumulative
"dinners funded" impact tally would both be structurally incapable of covering more than a rolling month,
no matter how those aggregates are computed.

## Recommendation

Don't touch the RLS/security posture, and don't extend the window indefinitely (there was presumably a
real reason — likely `exact_address` retention — for a bounded window). Instead, change what "expire"
means: stop hard-deleting the `dinners` row, and instead scrub only the sensitive field and mark it
archived.

Recommend **soft-archive**: add `dinners.archived_at timestamptz`, and have the 30-day job null out
`exact_address` and set `archived_at` instead of deleting the row. This:

- Preserves every cascaded child row (`sponsor_donations`, future `dinner_completions`/`ratings`, `rsvps`,
  `messages`) indefinitely, so donation history, rating averages, and impact tallies stay correct forever.
- Still achieves whatever the original PII-retention goal was (no exact home address sitting around
  indefinitely) by explicitly nulling that one column.
- Is a smaller change than introducing a parallel summary/archive table, and doesn't require every
  aggregate query to `union` across a live table and an archive table.

Existing SELECT policies on `dinners`/`sponsor_donations`/etc. are keyed off `status`/ownership, not off
row-existence, so archived rows should continue to be readable by exactly the same people who could read
them before (host, past attendees, sponsor) — this needs a direct check during implementation, not an
assumption.
