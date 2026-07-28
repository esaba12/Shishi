# Fix: dinner capacity is not enforced against real Supabase

## Current state (confirmed against the actual code)

- `supabase/schema.sql`'s `dinners` table has **no `seats_taken` column at all** — confirmed by grep across
  `supabase/schema.sql` and every file in `supabase/migrations/`.
- `mobile/lib/api.ts`'s `DINNER_COLUMNS` (line 45-48), the exact column list selected from Supabase, does
  not include `seats_taken` either.
- `rowToDinner()` (`mobile/lib/api.ts:63`) does `seatsTaken: row.seats_taken ?? 0` — against a real
  Supabase project `row.seats_taken` is always `undefined`, so **every real dinner reports 0 seats taken,
  always**, regardless of how many attendees actually have RSVPs.
- The only place `seatsTaken` is ever incremented is the **mock-data path**: `createRsvp()`'s demo-mode
  branch does `dinner.seatsTaken += 1` (api.ts:260) directly on the in-memory mock object. This never
  touches Supabase, so it only "works" in demo mode.
- Enforcement today: `rsvps` has `unique(dinner_id, attendee_id)` — this stops one person RSVPing twice,
  **not** a dinner from exceeding its `capacity`. There is no trigger, check constraint, or edge-function
  check anywhere that rejects an RSVP once a dinner is full.

## Why this matters

- The seats-left/progress-bar UI (`components/DinnerCard.tsx`, discover screen) is silently wrong for
  every real (non-demo) dinner — it always shows the dinner as empty.
- A dinner can be RSVP'd past its stated `capacity` with nothing stopping it — a host who set `capacity: 8`
  could end up with 20 approved attendees.
- This blocks correct behavior for anything that needs to know real capacity: the bring-a-friend invite
  plan (`docs/features/tier2-bring-a-friend/`) has to work around it by doing its own live
  `count(*) from rsvps where status in ('pending','approved')` inside its redemption RPC rather than
  trusting `dinners.seats_taken` — the underlying display bug still needs fixing independent of whether
  that feature ships.

## Recommendation

Maintain `seats_taken` as a real, trigger-updated column rather than a live subquery on every read — this
repo already has exactly this pattern for `dinners.amount_funded`, which is kept in sync by a trigger
(`update_dinner_amount_funded()`, referenced around `supabase/schema.sql:173`) whenever `sponsor_donations`
changes. Mirror that pattern for `rsvps` → `dinners.seats_taken`.

Also add a hard reject at the database layer when an RSVP would exceed capacity — a client-side "this
dinner is full" UI check alone is trivially bypassable (any direct `.insert()` call skips it), and the
existing RLS/trigger conventions in this schema consistently push integrity checks server-side rather than
trusting the client (see the `exact_address` reveal gate and the donation status webhook-only write).

**Open product question to confirm before implementing:** for `approval_mode = 'approve'` dinners, should
a pending (not-yet-approved) RSVP count against capacity? Recommend yes — count `pending` + `approved`
together against `capacity`, since otherwise a host could accumulate unbounded pending requests with no
signal of how oversubscribed the dinner is, and a host can always decline pending RSVPs manually if
genuinely full. This mirrors how `seatsTaken` is already used in the demo/mock data (incremented on any
RSVP, not just approved ones).
