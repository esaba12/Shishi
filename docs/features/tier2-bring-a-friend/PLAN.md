# Bring-a-Friend — Plan

Planning only. Nothing in this doc is implemented yet. See `RESEARCH.md` for the grounding and the
approval-mode/capacity tradeoff discussion this plan encodes.

## 1. Migration: `dinner_invites`

New file: `supabase/migrations/20260728120000_dinner_invites.sql` (next timestamp after the existing
`20260721200000_seed_host_listings_and_expiry.sql`).

```sql
-- Bring-a-friend: an attendee whose own RSVP is already approved can generate a single-use invite
-- code scoped to that dinner. Redeeming it creates a brand-new rsvps row for the invitee — it is a
-- genuinely separate grant that still earns approval/capacity/address-reveal on its own terms (see
-- docs/features/tier2-bring-a-friend/RESEARCH.md); it is not a bypass of the host's approval_mode.

create table dinner_invites (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  inviter_rsvp_id uuid not null references rsvps (id) on delete cascade,
  -- Short, URL-safe, human-shareable code. Collisions are astronomically unlikely at this length,
  -- but the unique constraint is the actual guarantee; retry-on-insert-conflict client-side if ever hit.
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  used_by uuid references profiles (id),
  used_rsvp_id uuid references rsvps (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index dinner_invites_dinner_id_idx on dinner_invites (dinner_id);
create index dinner_invites_inviter_rsvp_id_idx on dinner_invites (inviter_rsvp_id);

alter table dinner_invites enable row level security;

-- Only the inviter can see/list their own invites (e.g. to show "1 invite sent, unused" in the UI).
-- Hosts are deliberately not granted blanket read here for v1 — nothing in the product spec requires
-- a host-facing invite audit trail yet; add a host-sees-invites-to-their-dinner policy later if needed.
create policy "attendees see their own invites" on dinner_invites
  for select using (
    auth.uid() = (select attendee_id from rsvps where rsvps.id = dinner_invites.inviter_rsvp_id)
  );

-- Core gate: you can only mint an invite for a dinner if the referenced rsvp is (a) yours and
-- (b) already approved for that same dinner. This is what prevents anyone from inviting people into
-- a dinner they aren't actually confirmed for.
create policy "approved attendees create invites for their own rsvp" on dinner_invites
  for insert with check (
    exists (
      select 1 from rsvps
      where rsvps.id = dinner_invites.inviter_rsvp_id
        and rsvps.dinner_id = dinner_invites.dinner_id
        and rsvps.attendee_id = auth.uid()
        and rsvps.status = 'approved'
    )
  );

-- No update/delete policy for authenticated users: redemption (setting used_by/used_rsvp_id) happens
-- only through redeem_dinner_invite() below, a security-definer function — the same pattern as
-- get_dinner_address(), so a client can never forge "this invite was used" or steal someone else's
-- invite row directly via a table update.

-- Redemption RPC. Validates the code, checks it hasn't been used or expired, checks the dinner still
-- has room, creates a new rsvps row for the *caller* (auth.uid()) honoring the dinner's approval_mode
-- exactly like an organic RSVP would, then marks the invite consumed. p_paid mirrors the existing
-- client contract in lib/api.ts's createRsvp(dinnerId, attendeeId, { paid, autoApprove }) — the
-- checkout screen passes paid=true only after Stripe payment has already succeeded, same as today.
create or replace function redeem_dinner_invite(p_code text, p_paid boolean default false)
returns rsvps
language plpgsql security definer set search_path = public as $$
declare
  v_invite dinner_invites;
  v_dinner dinners;
  v_seats_taken integer;
  v_status rsvp_status;
  v_payment_status payment_status;
  v_new_rsvp rsvps;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite from dinner_invites where code = p_code for update;
  if v_invite is null then
    raise exception 'invalid_invite_code';
  end if;
  if v_invite.used_by is not null then
    raise exception 'invite_already_used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  select * into v_dinner from dinners where id = v_invite.dinner_id for update;
  if v_dinner is null or v_dinner.status <> 'published' then
    raise exception 'dinner_not_available';
  end if;

  if exists (select 1 from rsvps where dinner_id = v_dinner.id and attendee_id = auth.uid()) then
    raise exception 'already_rsvpd';
  end if;

  -- Seats "taken" = pending + approved, matching the reserve-a-spot-while-awaiting-approval semantics
  -- already used in demo mode (lib/api.ts's mock createRsvp increments seatsTaken unconditionally,
  -- not just on auto-approve). This is also the first place real capacity enforcement exists at all
  -- for real Supabase — see RESEARCH.md's "Capacity — important gap found."
  select count(*) into v_seats_taken from rsvps
    where dinner_id = v_dinner.id and status in ('pending', 'approved');
  if v_seats_taken >= v_dinner.capacity then
    raise exception 'dinner_full';
  end if;

  v_status := case when v_dinner.approval_mode = 'auto_accept' then 'approved'::rsvp_status else 'pending'::rsvp_status end;
  v_payment_status := case
    when p_paid then 'paid'::payment_status
    when v_dinner.is_free then 'not_required'::payment_status
    else 'pending'::payment_status
  end;

  insert into rsvps (dinner_id, attendee_id, status, payment_status)
  values (v_dinner.id, auth.uid(), v_status, v_payment_status)
  returning * into v_new_rsvp;

  update dinner_invites set used_by = auth.uid(), used_rsvp_id = v_new_rsvp.id where id = v_invite.id;

  return v_new_rsvp;
end; $$;

grant execute on function redeem_dinner_invite(text, boolean) to authenticated;
```

Notes on the SQL:

- `redeem_dinner_invite` is the *only* write path for redemption — mirrors the `get_dinner_address`
  pattern (security-definer function is the sole gate). This is what lets it enforce capacity and
  approval_mode even though the plain `rsvps` INSERT policy has none of that logic (and this plan
  intentionally does not touch the plain RSVP insert path — that pre-existing gap is out of scope
  here; see RESEARCH.md).
- `for update` row locks on the invite and dinner rows inside the function serialize concurrent
  redemption attempts against the same invite/dinner, so two friends racing to redeem the same code,
  or two invitees racing for the last seat, can't both succeed.
- `already_rsvpd` guard exists mainly for a clean error message; the `rsvps` table's
  `unique (dinner_id, attendee_id)` constraint would also catch it.

## 2. `lib/api.ts` additions

```ts
export interface DinnerInvite {
  id: string;
  code: string;
  expiresAt: string;
  usedBy: string | null;
}

// Generate an invite. Caller must already hold an approved rsvp id for this dinner (fetched via
// fetchMyRsvpForDinner or similar — the RLS insert policy re-validates this server-side regardless).
export async function createDinnerInvite(dinnerId: string, inviterRsvpId: string): Promise<DinnerInvite> {
  if (useMockData()) {
    return { id: `mock-invite-${Date.now()}`, code: "DEMO1234", expiresAt: new Date().toISOString(), usedBy: null };
  }
  const { data, error } = await supabase
    .from("dinner_invites")
    .insert({ dinner_id: dinnerId, inviter_rsvp_id: inviterRsvpId, expires_at: /* dinner's start time, fetched by caller */ })
    .select("id, code, expires_at, used_by")
    .single();
  if (error) throw error;
  return { id: data.id, code: data.code, expiresAt: data.expires_at, usedBy: data.used_by };
}

export async function redeemDinnerInvite(code: string, opts: { paid: boolean }): Promise<void> {
  if (useMockData()) return; // demo mode: no-op, treat as a normal RSVP in the calling screen
  const { error } = await supabase.rpc("redeem_dinner_invite", { p_code: code, p_paid: opts.paid });
  if (error) throw error;
}
```

(Exact shape TBD at implementation time — this is the contract, not final code.)

## 3. UI changes

### `app/dinner/[id]/index.tsx` — inviter side

- Once `myRsvp?.status === "approved"`, render a new "Invite a friend" button (near the existing
  potluck section or as a row in the info card) — e.g. `canClaimPotluck`-style gate:
  `canInvite = myRsvp?.status === "approved"`.
- Tapping it calls `createDinnerInvite(dinner.id, myRsvpId)` — note the current `myRsvp` state
  shape (`{ status, paymentStatus }` from `fetchMyRsvpForDinner`) doesn't include the RSVP's own
  `id`; that fetch needs to also select `id` so the client has `inviter_rsvp_id` to pass. Small
  addition to `fetchMyRsvpForDinner`'s select list and return type.
- On success, open the platform share sheet (React Native `Share.share`) with a link of the form
  `<app base url>/dinner/${dinner.id}?invite=${code}` (or the `shishi://` scheme equivalent) — see
  RESEARCH.md for why this reuses the existing route rather than a new one.

### `app/dinner/[id]/index.tsx` — invitee side

- Read `invite` from `useLocalSearchParams` alongside `id`.
- If `invite` is present and `myRsvp` is null (viewer hasn't RSVP'd yet), show an "You've been
  invited" banner above the normal content, and change `handleRsvp` to call the invite path instead
  of the plain path:
  - Free dinner: `await redeemDinnerInvite(invite, { paid: false })`, same success/error toast
    handling as today, `await load()` after.
  - Paid dinner: instead of `router.push('/dinner/${id}/checkout')`, push
    `/dinner/${id}/checkout?invite=${invite}`.
- If `invite` is present but the viewer already has an RSVP (e.g. reopening their own sent link, or a
  dinner they already joined organically), ignore the param entirely — falls through to today's
  behavior.

### `app/dinner/[id]/checkout.tsx` — paid redemption

- Read `invite` from `useLocalSearchParams`.
- In `confirmRsvp()`, branch: if `invite` present, call `redeemDinnerInvite(invite, { paid: true })`
  instead of `createRsvp(dinner.id, profile.id, { paid: true, autoApprove: ... })`. Everything else
  (payment call via `useDinnerCheckout`, navigation back to the dinner) stays the same.

### Copy / i18n

- New strings needed: invite CTA label ("Invite a friend"), invited-banner text ("You've been invited
  by a friend"), and redemption error toasts for `dinner_full`, `invite_already_used`,
  `invite_expired`, `already_rsvpd` (map Postgres error codes/messages to friendly toast copy, same
  pattern as the existing generic "Couldn't complete your RSVP" catch blocks).

## 4. Out of scope / explicitly deferred

- Host-facing view of who-invited-whom (would need `dinner_invites` SELECT policy for hosts, or a
  `invited_by_rsvp_id` denormalized column on `rsvps` itself — reasonable v2 addition, not required
  for the core loop).
- The "host opts into auto-approving invited friends" toggle discussed in RESEARCH.md — real product
  decision, not built now.
- Fixing the general (pre-existing) lack of server-side capacity enforcement on the plain
  `rsvps` INSERT path used by organic RSVPs / `createRsvp`. This plan only adds enforcement inside
  `redeem_dinner_invite`. Worth a follow-up ticket since it's a real gap independent of this feature.
- Standardizing the deep-link format/branded domain — depends on `tier1-dinner-share-links`, which is
  currently an empty stub with no RESEARCH.md/PLAN.md yet.

## 5. Verification

Manual, against a real (non-demo) Supabase project with two test accounts (A = inviter, B = invitee):

1. **Setup**: A creates or RSVPs to a `host_approves`, non-free-irrelevant (test both a free and a
   paid dinner across two runs) dinner with `capacity = 2`. Host (or A if host) approves A's RSVP so
   `rsvps.status = 'approved'` for A.
2. **Generate**: As A, tap "Invite a friend" on the dinner detail screen. Confirm a `dinner_invites`
   row is created in Supabase with `inviter_rsvp_id` = A's rsvp id, `used_by is null`, `expires_at`
   set. Confirm the share sheet opens with a link containing `?invite=<code>`.
3. **Negative — unapproved inviter**: with a third account C whose RSVP on the same dinner is still
   `pending`, attempt to call `createDinnerInvite` directly (e.g. via the Supabase client in a debug
   console) — confirm the RLS INSERT policy rejects it (no invite row created) because C's rsvp isn't
   `approved`.
4. **Redeem — happy path**: As B (no prior RSVP on this dinner), open the invite link. Confirm the
   "invited" banner shows and the CTA reflects the invite flow. Accept it. Confirm:
   - A new `rsvps` row exists for B on this dinner (`dinner_id`/`attendee_id` correct).
   - `status` matches `approval_mode` (pending if `host_approves`, approved if `auto_accept`) — i.e.
     redemption did **not** silently auto-approve past the host's setting.
   - `dinner_invites.used_by = B` and `used_rsvp_id` = B's new rsvp id.
   - If the dinner was paid: B was routed through checkout and `payment_status = 'paid'` only after
     the Stripe payment step succeeded, not before.
5. **Capacity**: fill the dinner to `capacity` via other approved/pending RSVPs, then attempt
   redemption as a new account D. Confirm `redeem_dinner_invite` raises `dinner_full` and no `rsvps`
   row is created for D.
6. **Single-use**: after step 4's successful redemption, attempt to redeem the same code again (as a
   different account E, or B again). Confirm it fails with `invite_already_used` and no second `rsvps`
   row / no change to the already-consumed invite row.
7. **Expiry**: manually set an invite's `expires_at` to the past (via Studio) and attempt redemption;
   confirm `invite_expired` is raised.
8. **Address reveal still independent**: after B's RSVP reaches `approved` and the reveal window
   opens, confirm `get_dinner_address` returns the real address to B based on B's *own* rsvp row —
   not merely because A (the inviter) can already see it. This confirms the invite didn't create any
   shortcut around the existing per-row reveal gate.
