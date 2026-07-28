# Round-Up Donations — Research

## What exists today

Two Stripe flows in this codebase, deliberately kept separate:

**Attendee ticketing** (`create-payment-intent/index.ts` + `app/dinner/[id]/checkout.tsx` +
`lib/payments.tsx`/`.web.tsx`):
- `create-payment-intent` charges exactly `dinner.cost_per_head`, in ILS, into the platform's
  single Stripe account. Metadata is `{ dinnerId, attendeeId }`. No DB row is written by this
  function — it's a pure Stripe call.
- After `presentPaymentSheet()` (native) / `confirmPayment()` (web) succeeds, the **client**
  calls `createRsvp(dinnerId, attendeeId, { paid: true, ... })`, which inserts an `rsvps` row with
  `payment_status: 'paid'` directly. This is **client-trusted**, not webhook-verified — the schema
  comment on `create-payment-intent/index.ts` and `stripe-webhook/index.ts` both call this out
  explicitly as "fine for a ticket" (low stakes, no receipt, host isn't relying on this for a tax
  document).
- `stripe-webhook` never touches `rsvps` at all today.

**Sponsor donations** (`create-donation-intent/index.ts` + `app/dinner/[id]/donate.tsx` +
`lib/donationCheckout.tsx`/`.web.tsx`):
- Gated on `dinner.seeking_sponsorship && dinner.sponsor_approved && dinner.status === 'published'`
  (this exact three-condition gate also appears client-side in `lib/api.ts` around line 613 for the
  sponsor donor feed — it's the one canonical "is this dinner allowed to receive donation money"
  check in the codebase).
- `create-donation-intent` creates the Stripe PaymentIntent **first**, then inserts a
  `sponsor_donations` row with `status: 'pending'` and `stripe_payment_id: paymentIntent.id` set
  immediately — before the money has actually moved. If the DB insert fails, it cancels the
  PaymentIntent to avoid an orphaned charge.
- `sponsor_donations` has **no client-facing UPDATE policy** (schema.sql, lines 280-288). The row
  can only move `pending -> succeeded/failed/refunded` via `stripe-webhook`, running with the
  service-role key. This is a deliberate anti-fraud design: real donor money + a future tax receipt
  are on the line, so the client's word that "it worked" is never trusted the way it is for ticket
  RSVPs.
- `stripe-webhook` handles this generically: on `payment_intent.succeeded` /
  `payment_intent.payment_failed`, it does `update sponsor_donations set status = ... where
  stripe_payment_id = paymentIntent.id`. It does **not** branch on payment type — a no-match update
  (0 rows) is treated as expected and not an error, "because attendee ticketing uses this same
  Stripe account." **This means the webhook is already payment-type-agnostic by construction** — it
  will correctly flip *any* `sponsor_donations` row whose `stripe_payment_id` matches the succeeded
  PaymentIntent, regardless of what else that PaymentIntent was for.
- `amount_funded` on `dinners` is maintained by the `update_dinner_amount_funded()` trigger
  (schema.sql lines 168-180), which sums `sponsor_donations.amount` where `status = 'succeeded'` for
  that `dinner_id`, on every insert/update/delete to `sponsor_donations`. It requires no application
  code to stay correct — any new `sponsor_donations` row that transitions to `succeeded` will
  automatically roll into `amount_funded` for its `dinner_id`.

## The schema constraint that makes a "general pool" hard

There is no concept of un-earmarked money anywhere in the schema. `sponsor_donations.dinner_id` is
`not null` and has a hard FK to `dinners`. The sponsor donor feed, the `amount_funded` trigger, and
the manual `sponsor_approved` gate (schema.sql line 79: "a dinner only enters the sponsor donor feed
once this is flipped... toggled via Supabase Studio") all assume every dollar of donation money is
already tied to one specific, human-approved dinner at the moment it's charged.

Product Bible §8 makes this an explicit anti-fraud principle: funds are released against a real,
confirmed dinner, not held in an undifferentiated balance that gets allocated later. A "general
pool" (money collected now, attached to a dinner later) would need:
- A new table (e.g. `general_pool_contributions`) with its own webhook-authoritative lifecycle.
- New allocation logic — some process (manual? automatic on dinner creation? first-come-first-
  served?) that later decides which dinner(s) a pooled dollar goes to.
- A new fraud-review surface, because money would be "released" to a dinner *after* the charge,
  by whatever allocates the pool, rather than at charge time by the sponsor's own choice of dinner —
  this is exactly the kind of after-the-fact discretionary allocation §8's model is designed to
  avoid.
- Reconciliation semantics: what happens to pooled money if it's never allocated? Partial
  allocation across multiple dinners? Refund policy?

None of this exists today, and building it is a genuinely separate, larger feature — not a variant
of round-up, but a prerequisite for a different sponsorship model.

## Design question: where does round-up money go?

**Option (a) — earmark to the same dinner, only when that dinner is already
sponsorship-eligible.** When an attendee pays for a ticket to a dinner that satisfies the *existing*
donation gate (`seeking_sponsorship && sponsor_approved && status === 'published'`), offer a
round-up. The round-up amount is treated as a donation to that same dinner and reuses the entire
existing `sponsor_donations` lifecycle and `amount_funded` trigger untouched. If the dinner does
*not* satisfy that gate, no round-up is offered at all — there's no dinner-shaped destination for
the money to be earmarked to, and (per the previous section) inventing one is out of scope.

**Option (b) — general pool.** Collect round-up money regardless of the dinner's sponsorship state,
and introduce new schema + allocation logic to route it to *some* dinner (this one, another one, or
a rotating set) after the fact.

### Recommendation: (a), scoped even tighter than the original framing

The original framing of (a) was "earmark to the same dinner's `budget_needed` if
`seeking_sponsorship`." Digging into `create-donation-intent` and the donor-feed filter in
`lib/api.ts`, the real, already-encoded eligibility rule is three conditions, not one:
`seeking_sponsorship && sponsor_approved && status === 'published'`. Recommend gating round-up on
exactly this same three-condition check — not just `seeking_sponsorship` — because:

- `sponsor_approved` is the manual anti-fraud/values gate (§8/§10): a dinner a host merely *marked*
  as seeking sponsorship, but that a human hasn't reviewed yet, cannot receive sponsor money through
  the existing donate flow. Letting round-up money flow to an unapproved dinner would open a second,
  unreviewed path into the same table that the approval gate exists specifically to close off, and
  would directly undermine the design intent stated in the schema.
- This makes round-up **strictly additive**: it introduces no new eligibility logic, no new gate,
  and no new fraud surface. It only offers a UI toggle at a moment when the *donate* flow is already
  fully legitimate for this exact dinner.
- It correctly does nothing for dinners not seeking sponsorship — which is a real, accepted MVP
  limitation, not a bug. Flagged explicitly below as the V2 boundary.

**(b) is out of scope for this tier.** It should be explicitly flagged as a bigger, separate V2
decision requiring its own schema design, allocation policy, and fraud review — not something to
half-build alongside round-up.

## Design question: separate `sponsor_donations` row, or a variant?

Recommend a **normal `sponsor_donations` row**, not a new variant/table, attributed to the attendee
themselves as a self-sponsor:
- `sponsor_id`: the attendee's own `profile.id`. There is no "anonymous system sponsor" user in this
  schema, and inventing one would be a bigger, riskier change than reusing the existing FK to a real
  profile the attendee already owns (also means the attendee can see their own past round-up
  donations via the existing "sponsor sees own donations" RLS policy, for free).
- `donor_legal_name` / `donor_receipt_email`: both `not null` on the table. Source from
  `profile.name` (not null on `profiles`) and `profile.email` (nullable — auth may be phone-based).
  If `profile.email` is null, fall back to the Supabase auth user's email if present; if truly
  neither exists, do not offer round-up for that user (rare — email/phone verification is already
  required at tier 1, see `profiles.verification_tier`).
- `anonymous`: default `true` for round-up rows. A round-up is an incidental add-on to a ticket
  purchase, not a deliberate donor gesture the way filling out `app/dinner/[id]/donate.tsx` is —
  defaulting to anonymous avoids implying the attendee "sponsored" the dinner in the host-facing
  view unless they explicitly want credit. (Worth a product call, but this is the safer default.)
- `message`: `null`. No UI surface for a message on a round-up.
- No schema migration needed — every column round-up needs already exists.

A **new table or status variant is not warranted**: the only thing that differs between a round-up
donation and a manual one is *how the sponsor arrived at the amount and the Stripe charge that
funded it* — not its shape, lifecycle, RLS needs, or how it rolls into `amount_funded`. Reusing the
table also means zero changes to `stripe-webhook`'s update logic (see below) and zero changes to any
UI that already reads `sponsor_donations` (host donor list, sponsor's own donation history, the
`amount_funded` trigger).

## Design question: one PaymentIntent or two?

**Recommend one PaymentIntent, amount = `cost_per_head + roundup`, single charge.** Rejected
alternative: two separate PaymentIntents (one for the ticket, one for the round-up) presented in
the same checkout flow — worse UX (two native PaymentSheet/Payment Element confirmations, two
places to fail/retry, doubled Stripe processing fees on a probably-small round-up amount), for no
real benefit; nothing about keeping them separate at the Stripe layer is needed, because the split
only needs to exist in **Supabase's accounting**, not in Stripe's.

This is where the webhook's existing payment-type-agnostic design (see above) becomes load-bearing:
because `create-donation-intent` already writes a `pending` `sponsor_donations` row keyed by
`stripe_payment_id` *before* the charge resolves, and the webhook only ever matches on
`stripe_payment_id`, the exact same pattern works for a combined charge:

1. `create-payment-intent` creates one PaymentIntent for `cost_per_head + roundup`.
2. If `roundup > 0` (and the dinner passed the eligibility gate), `create-payment-intent` also
   inserts a `pending` `sponsor_donations` row with `stripe_payment_id` = that same PaymentIntent's
   id and `amount` = the roundup portion only (not the combined total).
3. When Stripe fires `payment_intent.succeeded`, `stripe-webhook`'s existing, **unmodified**
   `update sponsor_donations set status = 'succeeded' where stripe_payment_id = ...` finds and
   flips that row — because the row already exists with a matching id, exactly like the donate
   flow. **No webhook code changes required.**
4. The ticket portion of the same successful charge continues to be marked via the existing
   client-trusted `createRsvp({ paid: true })` path, unchanged. This preserves the current
   asymmetry (ticket = client-trusted, donation = webhook-authoritative) *for the correct half of
   the same charge* — the round-up money still only becomes real in Supabase's eyes through the
   webhook, even though it shares a PaymentIntent with a client-trusted ticket.
5. On `payment_intent.payment_failed`, the same unmodified webhook logic flips the round-up row to
   `failed`; nothing needs to happen to the `rsvps` row since the client never called `createRsvp`
   if `pay()` returned an error (see `checkout.tsx`'s `handlePay`, which only calls `confirmRsvp()`
   after a truthy `result.ok`).

### Known pre-existing asymmetry (not introduced by this feature, but sharpened by it)

Ticket payment confirmation is client-trusted; round-up donation confirmation is webhook-verified —
and after this change, both can be **the same Stripe charge**. If a bad actor spoofs the client-side
"payment succeeded" call without actually completing payment, they'd get a free RSVP today
regardless of round-up. This is a pre-existing gap (explicitly accepted in the current code's
comments as fine for a zero-receipt ticket) and is out of scope to fix here — noted so it isn't
mistaken for something round-up introduces.

## Summary of recommendation

| Question | Recommendation |
|---|---|
| Earmark to same dinner vs. general pool | Same dinner (a), gated on `seeking_sponsorship && sponsor_approved && published` — general pool (b) explicitly deferred to V2 |
| New table/variant for round-up | No — reuse `sponsor_donations` as-is, attributed to the attendee as self-sponsor, `anonymous: true` by default |
| One PaymentIntent or two | One combined PaymentIntent; split accounting happens only in Supabase via a pre-inserted `pending` `sponsor_donations` row keyed by the shared `stripe_payment_id` |
| Webhook changes | None required — existing `stripe_payment_id`-keyed update already handles this by construction |
