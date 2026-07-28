# Plan: soft-archive past dinners instead of hard-deleting them

## Context

See `RESEARCH.md`. The 30-day hard-delete cascades away donation history today and would cascade away
rating/completion history the moment `tier2-post-dinner-ratings` ships. This plan replaces the delete with
a soft-archive that still scrubs the sensitive field the original window was presumably protecting.

## Migration

New file: `supabase/migrations/<timestamp>_soft_archive_past_dinners.sql`

```sql
alter table dinners add column archived_at timestamptz;

create or replace function archive_expired_dinners() returns void as $$
begin
  update dinners
  set archived_at = now(),
      exact_address = null
  where status = 'past'
    and archived_at is null
    and updated_at < now() - interval '30 days'; -- adjust to whatever column actually tracks
                                                    -- when a dinner went 'past'; confirm exact
                                                    -- column during implementation (see note below)
end;
$$ language plpgsql security definer;

-- Replace the old hard-delete job with the new archive job (cron.schedule upserts by name).
select cron.unschedule('delete-expired-dinners-daily');
select cron.schedule('archive-expired-dinners-daily', '15 3 * * *', $$select archive_expired_dinners()$$);

-- Drop the old function only after confirming nothing else references it.
drop function if exists delete_expired_dinners();
```

**Implementation note:** the original `delete_expired_dinners()` presumably tracked "30 days past-due"
using some timestamp — confirm the exact column it reads (`updated_at`, or a computed `date + interval
'30 days'` off the dinner's own `date` field) by reading the actual function body in
`supabase/migrations/20260721200000_seed_host_listings_and_expiry.sql` before writing this migration, and
reuse the same logic so the archive threshold matches the old delete threshold exactly.

## RLS check (must verify before shipping, not assume)

Read every existing `select` policy on `dinners`, `sponsor_donations`, `rsvps`, `messages`,
`potluck_items` and confirm none of them implicitly assume "if you can query it, it must be recent" in a
way that would need updating — they're keyed on `host_id = auth.uid()` / RSVP-approval /
sponsor-of-record, not on any time-based condition, so archived rows should already be readable by the
same people as before. Add an explicit test for this rather than trusting the read-through.

## Application code changes

- None required to existing screens (`app/sponsor/my-donations.tsx`, discover/sponsor feeds) since
  archived dinners already wouldn't appear in "upcoming"/"open for sponsorship" listings — those already
  filter on `status = 'published'`, not on row-existence. Confirm this filter is present everywhere a
  feed excludes past dinners, so an archived row doesn't accidentally resurface.
- If any screen currently assumes an old dinner "disappears" as a matter of course (e.g. relies on it not
  existing rather than filtering on `status`), that assumption needs fixing as part of this change —
  search for `.eq("status"` / `status !==` usage across `mobile/lib/api.ts` to confirm.

## Verification

1. Manually invoke `archive_expired_dinners()` against a test dinner whose `status = 'past'` and is
   >30 days old. Confirm: the row still exists, `archived_at` is set, `exact_address` is null.
2. Confirm the dinner's associated `sponsor_donations` row is still present and still shows correctly in
   `app/sponsor/my-donations.tsx`'s history for that sponsor.
3. Confirm the dinner does not reappear in the active discover feed or sponsor donor feed.
4. Confirm a host/past-attendee/sponsor who could read the dinner before archiving can still read it
   after, and that an unrelated user still cannot (no RLS regression).
5. Confirm the `pg_cron` job actually fires unattended (check `cron.job_run_details` after the scheduled
   time, same verification technique used in the push-notifications plan for its own cron job).
