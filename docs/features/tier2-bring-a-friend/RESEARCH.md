# Bring-a-Friend — Research

## Goal

Let an attendee who is already confirmed for a dinner invite a friend directly into that same
dinner, without the friend having to discover/browse it independently. This doc grounds the design
in the current RSVP/capacity/approval model and lays out the invite mechanism and its tradeoffs.

## What exists today (grounded in code)

### RSVP model (`supabase/schema.sql`)

- `rsvps` table: `id, dinner_id, attendee_id, status (rsvp_status), payment_status, stripe_payment_id,
  created_at`, with `unique (dinner_id, attendee_id)` — one RSVP row per person per dinner.
- `rsvp_status` enum: `pending | approved | declined | cancelled`.
- `payment_status` enum: `not_required | pending | paid | refunded`.
- RLS on `rsvps`:
  - SELECT: attendee sees their own row; host sees rows for dinners they host.
  - INSERT: `with check (auth.uid() = attendee_id)` — anyone can create their own RSVP row for any
    dinner (no capacity or approval check enforced at insert time today).
  - UPDATE: attendee or host.
  - No DELETE policy (cancellation must go through an UPDATE to `status = 'cancelled'`).
- `dinners.approval_mode`: `auto_accept | host_approves`. Client (`app/dinner/[id]/index.tsx`,
  `handleRsvp`) sets `status: 'approved'` on insert when `auto_accept`, else `'pending'`, and the
  host approves/declines later via `updateRsvpStatus` (`lib/api.ts`).
- **`types/index.ts`'s `Rsvp` interface** is minimal: `{ id, dinnerId, attendeeId, status,
  paymentStatus }`. No notion of "how this RSVP came to exist" (organic vs. invited) — a field to add
  if we want to distinguish invited attendees in host-facing UI later, though not required for v1.

### Capacity — important gap found

- `dinners.capacity` is a real, NOT NULL column (`check (capacity > 0)`).
- **There is no `seats_taken` column on `dinners` in the schema at all.** `lib/api.ts`'s
  `rowToDinner()` does `seatsTaken: row.seats_taken ?? 0` — against real Supabase this **always
  evaluates to 0** (the column doesn't exist to select), so `Dinner.seatsTaken` is only meaningfully
  populated in demo/mock mode (`data/mock`), where `createRsvp()` increments a local mock object
  in-memory (`lib/api.ts:260`).
- Consequently, **capacity is not enforced anywhere against real Supabase today** — not client-side
  (the UI's "Full" button-disable relies on `seatsTaken`, which is always 0 in real mode) and not
  server-side (the `rsvps` INSERT policy has no capacity check).
- This is a pre-existing gap, not something introduced by this feature, but it directly matters here:
  the task calls for the invite-redemption path to "respect capacity," and there's no existing
  primitive to count seats against. This plan needs to introduce one (a `seats_taken` count derived
  from `rsvps` — via view, subquery, or a maintained counter column/trigger similar to
  `update_dinner_amount_funded()`) at least for the redemption path, and ideally suggests fixing the
  general gap too (flagged in PLAN.md as related debt, kept out of this feature's direct scope).

### Approval mode + RSVP creation UI (`app/dinner/[id]/index.tsx`)

- `handleRsvp()`: if the dinner is paid, routes to `/dinner/[id]/checkout` (Stripe flow, separate
  concern); if free, calls `createRsvp(dinner.id, profile.id, { paid: false, autoApprove:
  dinner.approvalMode === 'auto_accept' })`.
- `myRsvp` state (`{ status, paymentStatus }`) drives the `StatusBanner` (`approved` / `pending` /
  `declined`) and gates potluck claiming (`canClaimPotluck = myRsvp?.status === 'approved'`) and
  address reveal (`isRevealedToAttendee = myRsvp?.status === 'approved' && isAddressRevealed(dinner)`).
- The footer CTA (RSVP / Request to Join / Get Ticket / Full) only renders `if (!myRsvp)` — once a
  person has *any* RSVP row (pending, approved, declined, cancelled) the footer disappears and only
  the `StatusBanner` shows. There's currently no other action surface on this screen once RSVP'd.
- No existing "invite a friend" UI, share sheet, or deep-link handling anywhere in `app/dinner/[id]/`.

### Address reveal (`get_dinner_address` RPC)

- Reveals `exact_address` only to the host, or to an attendee whose **own** `rsvps` row has
  `status = 'approved'` AND `now() >= date + start_time - 24h`. This is genuinely per-row: an
  invitee's new RSVP row is a separate grant that must independently reach `approved` status and
  pass the same time gate — inviting a friend must not be a shortcut around this, confirming the
  task's framing.

### Dinner-share-links feature

- `docs/features/tier1-dinner-share-links/` exists but is **empty** (no RESEARCH.md/PLAN.md yet) —
  there is no existing deep-link scheme, route param convention, or share-sheet component to reuse.
  This means bring-a-friend has two options: build its own minimal redemption entry point now (a
  query param on the existing dinner detail route), or block on the share-links feature landing
  first. Recommendation below leans toward the former to avoid a hard dependency on an unstarted
  feature, while keeping the code path narrow enough that share-links can absorb/extend it later
  (e.g. both could eventually resolve through a shared "resolve deep link" utility).

### Payment

- Paid dinners route through a separate Stripe checkout flow (`/dinner/[id]/checkout`), which this
  research did not fully trace, but it's clear RSVP creation for a paid dinner is a different path
  than `createRsvp(..., { paid: false, ... })`. **Decision**: redeeming an invite to a *paid* dinner
  must still route the invitee through the normal checkout flow — an invite grants entry into the
  approval/capacity queue, not a free ride past payment. (This is called out explicitly in PLAN.md's
  scope.)

## Recommended invite design

### `dinner_invites` table

- One row per invite code, generated by an attendee whose **own** RSVP on that dinner is already
  `approved` (enforced via RLS INSERT check — see PLAN.md). This directly satisfies the requirement
  that only people already "in" the dinner can invite others into it — an invite cannot be minted by
  someone with a `pending`/`declined`/`cancelled` RSVP, and non-attendees have no row to reference at
  all.
- Single-use (`used_by` starts null, set on redemption; a redeemed invite cannot be redeemed again).
  Chose single-use over `max_uses` counters for v1 simplicity — an attendee can always generate
  multiple invite rows if they want to invite several friends, which also gives natural per-friend
  traceability (who invited whom) without extra bookkeeping.
- `expires_at` — defaults to the dinner's start time (an invite to a dinner that already happened is
  meaningless); could also add a short default TTL (e.g. 7 days) if hosts want invites to go stale
  faster than "day of," but tying to dinner start is the simplest correct default for v1.

### Approval-mode / capacity tradeoff (explicit product decision)

Two options were considered for what happens when a friend redeems a valid invite:

1. **Auto-approve, bypass `approval_mode`.** Pro: feels like a genuine "plus-one," reduces friction,
   rewards the inviter's vouching. Con: silently overrides the host's chosen approval workflow and
   can overfill a dinner past what the host expected to personally vet — a `host_approves` dinner
   exists specifically because the host wants to review who shows up; an invite mechanism that skips
   that is a meaningful trust/control change the host never opted into.
2. **Respect `approval_mode` and `capacity` exactly like an organic RSVP** (recommended for v1). The
   invitee's new `rsvps` row is created with `status = 'pending'` unless the dinner is
   `auto_accept`, and capacity is checked before the row is allowed to be created (redemption fails
   cleanly with "this dinner is full" if capacity is already reached). The only thing the invite
   *does* provide over a cold RSVP is knowing which dinner to land on and skipping discovery/search —
   it does not skip the host's control surface.

**Recommendation: option 2 for v1.** This preserves the host's existing guarantees (nobody enters a
`host_approves` dinner without the host's say-so, no dinner exceeds its stated capacity) and avoids
a silent behavior change on a system the host already configured per-dinner. That said, this is a
real product tradeoff, not a purely technical one — a future iteration could let the *host* opt in to
a per-dinner "auto-approve invited friends" toggle (a new boolean on `dinners`, checked only when the
new RSVP came from a redeemed invite), for hosts who want vouched-for friends to skip the queue. Flag
this as a v2 toggle idea, not built now.

### Redemption UX

- **Reuse the existing dinner detail route** (`app/dinner/[id]/index.tsx`) with a `?invite=<code>`
  query param, rather than building a new dedicated route or waiting on the (currently empty/unbuilt)
  `tier1-dinner-share-links` feature. Rationale:
  - The detail screen already has everything redemption needs to display (dinner summary, capacity,
    approval mode) and already owns the RSVP-creation call path (`handleRsvp`/`createRsvp`).
  - A query param is a trivially shareable link (`shishi://dinner/<id>?invite=<code>` or the
    equivalent https universal link, whatever scheme share-links eventually standardizes on) without
    inventing new routing.
  - When `tier1-dinner-share-links` is designed, it can standardize the link *format* (short codes,
    branded domain, OG preview, etc.) while still terminating on this same screen/param — this
    feature doesn't need to block on or duplicate that work, just needs to not paint the app into a
    corner. Noting the dependency explicitly: if share-links later introduces its own redirect/resolve
    layer, this invite param should be threaded through it rather than assuming direct deep-link
    delivery.
- On load, if `invite` param is present and the viewer has no existing RSVP for this dinner, show an
  "invited by X" banner and change the primary CTA to "Accept invite" (or fold into the existing RSVP
  CTA with different copy) which calls a new `redeemDinnerInvite(code, profile.id)` API function
  instead of the plain `createRsvp`. If the dinner is paid, this still routes to the checkout flow,
  passing the invite code through so the resulting RSVP row can be linked/validated server-side after
  payment succeeds.
- If the viewer already has an RSVP (e.g. re-opens their own invite link, or already RSVP'd
  independently), the invite param is just ignored and the normal status banner shows.
