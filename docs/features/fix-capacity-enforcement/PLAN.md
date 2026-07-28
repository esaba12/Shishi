# Plan: enforce dinner capacity server-side

## Context

Real dinners always report `seatsTaken: 0` because the column doesn't exist in Supabase and nothing
enforces `capacity` at all. See `RESEARCH.md` for the full grounding. This plan adds a real,
trigger-maintained `seats_taken` column plus a hard server-side cap, mirroring the existing
`amount_funded` trigger pattern already in this schema.

## New migration

New file: `supabase/migrations/<timestamp>_dinner_seats_taken.sql`

```sql
alter table dinners add column seats_taken integer not null default 0;

-- Backfill from existing rsvps (pending + approved count as holding a seat).
update dinners d
set seats_taken = (
  select count(*) from rsvps r
  where r.dinner_id = d.id and r.status in ('pending', 'approved')
);

create or replace function update_dinner_seats_taken() returns trigger as $$
begin
  update dinners
  set seats_taken = (
    select count(*) from rsvps
    where dinner_id = coalesce(new.dinner_id, old.dinner_id)
      and status in ('pending', 'approved')
  )
  where id = coalesce(new.dinner_id, old.dinner_id);
  return null;
end;
$$ language plpgsql security definer;

create trigger rsvps_update_seats_taken
  after insert or update or delete on rsvps
  for each row execute function update_dinner_seats_taken();

-- Hard reject an insert that would exceed capacity. Runs before the count-refresh trigger above
-- so it sees the pre-insert seats_taken value.
create or replace function check_dinner_capacity() returns trigger as $$
declare
  v_capacity integer;
  v_seats_taken integer;
begin
  select capacity, seats_taken into v_capacity, v_seats_taken
  from dinners where id = new.dinner_id;

  if new.status in ('pending', 'approved') and v_seats_taken >= v_capacity then
    raise exception 'This dinner is full.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger rsvps_check_capacity
  before insert on rsvps
  for each row execute function check_dinner_capacity();
```

Note: `check_dinner_capacity()` only guards `insert` — an `update` that flips a `'declined'` RSVP back to
`'pending'` isn't expected in this app's flows (declines are terminal in the UI), but if that ever becomes
possible, extend the trigger to `before insert or update`.

## Client changes

- `mobile/lib/api.ts`: add `seats_taken` to `DINNER_COLUMNS` (line 45-48).
- `rowToDinner()` (api.ts:63): drop the `?? 0` fallback comment/reliance — the column is now always
  populated by the trigger, so a real `undefined` would indicate a select-list bug, not a legitimate zero.
- `createRsvp()`'s mock-mode branch (api.ts:260, `dinner.seatsTaken += 1`) stays as-is — demo mode has no
  database triggers to rely on, so keep incrementing the in-memory mock object directly.
- Handle the new `"This dinner is full."` Postgres exception surfaced through the Supabase client's error
  response in whichever screen calls `createRsvp` (`app/dinner/[id]/index.tsx`, `app/dinner/[id]/checkout.tsx`)
  — show it as a normal toast error rather than a generic failure message.

## Verification

1. Apply the migration against a local/staging Supabase instance; confirm existing dinners get a correct
   backfilled `seats_taken` matching their current pending+approved RSVP count.
2. RSVP to a dinner up to its `capacity`; confirm `seatsTaken` in the UI updates correctly after each RSVP.
3. Attempt one more RSVP past capacity directly via the Supabase client (bypassing any UI graying-out) and
   confirm the insert is rejected with the capacity error.
4. Cancel an approved RSVP; confirm `seats_taken` decrements and a new RSVP can now succeed.
5. Confirm demo mode (`isSupabaseConfigured === false`) still works unchanged, since it never touches these
   triggers.
