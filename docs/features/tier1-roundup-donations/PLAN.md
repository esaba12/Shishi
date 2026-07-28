# Round-Up Donations — Plan

Scope: MVP round-up only (option (a) from RESEARCH.md). Round-up is offered only when
`dinner.seeking_sponsorship && dinner.sponsor_approved && dinner.status === 'published'`. General
pool (option (b)) is explicitly out of scope — see RESEARCH.md.

No schema migration is required. No `stripe-webhook` code changes are required. Changes are limited
to `create-payment-intent`, `lib/api.ts`, and `app/dinner/[id]/checkout.tsx` (+ the two
`lib/payments.tsx`/`.web.tsx` platform variants, minimally).

## 1. `supabase/functions/create-payment-intent/index.ts`

Accept an optional `roundupAmount` in the request body. Adjust the PaymentIntent total. If a
roundup is present and the dinner is eligible, pre-insert a `pending` `sponsor_donations` row keyed
by the PaymentIntent id (mirrors exactly what `create-donation-intent` already does).

```ts
const { dinnerId, roundupAmount } = await req.json();
const roundup = Number(roundupAmount) > 0 ? Number(roundupAmount) : 0;

const { data: dinner, error } = await supabase
  .from("dinners")
  .select("cost_per_head, is_free, capacity, status, seeking_sponsorship, sponsor_approved, host_id")
  .eq("id", dinnerId)
  .single();
if (error || !dinner) return new Response("Dinner not found", { status: 404 });
if (dinner.is_free) return new Response("This dinner is free — no payment needed", { status: 400 });

const roundupEligible =
  roundup > 0 &&
  dinner.seeking_sponsorship &&
  dinner.sponsor_approved &&
  dinner.status === "published";
// A roundup amount submitted for an ineligible dinner is silently dropped (charge the ticket only)
// rather than erroring — the eligibility gate can legitimately change between page load and
// checkout (e.g. sponsor_approved flips), and failing the whole ticket purchase over a dropped
// add-on would be the wrong tradeoff.
const effectiveRoundup = roundupEligible ? roundup : 0;

const totalAmount = Number(dinner.cost_per_head) + effectiveRoundup;

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(totalAmount * 100),
  currency: "ils",
  metadata: {
    dinnerId,
    attendeeId: user.id,
    roundupAmount: String(effectiveRoundup), // useful for support/debugging, not read by the webhook
  },
  automatic_payment_methods: { enabled: true },
});

if (effectiveRoundup > 0) {
  // Fetch donor_legal_name/donor_receipt_email from the attendee's own profile — both columns are
  // not-null on sponsor_donations. Fall back to the auth user's email if profile.email is unset
  // (phone-based signup). If neither exists, skip writing the roundup row and just charge the
  // ticket amount only (adjust totalAmount/paymentIntent accordingly) rather than fail the purchase.
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .single();
  const receiptEmail = profile?.email ?? user.email ?? null;

  if (profile?.name && receiptEmail) {
    const { error: donationError } = await supabase.from("sponsor_donations").insert({
      dinner_id: dinnerId,
      host_id: dinner.host_id,
      sponsor_id: user.id,
      donor_legal_name: profile.name,
      donor_receipt_email: receiptEmail,
      amount: effectiveRoundup,
      currency: "ils",
      status: "pending",
      stripe_payment_id: paymentIntent.id,
      anonymous: true,
      message: null,
    });
    // Deliberately do NOT cancel the PaymentIntent if this insert fails, unlike
    // create-donation-intent — the ticket portion of this same PaymentIntent is still valid and the
    // attendee should still be able to pay for their seat. Log/monitor instead; the round-up simply
    // won't have a destination row and its money will sit in the platform Stripe balance
    // unattributed (rare — should alert if it happens).
  }
}

return new Response(
  JSON.stringify({ clientSecret: paymentIntent.client_secret }),
  { headers: { "Content-Type": "application/json" } }
);
```

Notes:
- Re-derive eligibility server-side (don't trust a client-sent boolean) — same pattern
  `create-donation-intent` already uses.
- `metadata.roundupAmount` on the PaymentIntent is for observability only (Stripe dashboard,
  support debugging) — it is not read by the webhook, which continues to match purely on
  `stripe_payment_id`.

## 2. `supabase/functions/stripe-webhook/index.ts`

**No changes.** The existing generic handler:

```ts
const { error } = await supabaseAdmin
  .from("sponsor_donations")
  .update({ status })
  .eq("stripe_payment_id", paymentIntent.id);
```

already updates whatever `sponsor_donations` row matches this PaymentIntent's id — which, after
step 1, includes the pre-inserted roundup row for a combined ticket+roundup charge. On
`payment_intent.succeeded`, this flips the roundup row to `succeeded`, which fires the existing
`update_dinner_amount_funded()` trigger and correctly rolls the roundup into that dinner's
`amount_funded`. On `payment_intent.payment_failed`, it flips to `failed` and the trigger recomputes
`amount_funded` excluding it. Verify this by reading the file again post-change only if a reviewer
wants extra confidence — the logic genuinely requires no edit.

## 3. `mobile/lib/api.ts`

Update `createPaymentIntent` to accept and forward the optional roundup:

```ts
export async function createPaymentIntent(
  dinnerId: string,
  roundupAmount?: number
): Promise<{ clientSecret: string }> {
  if (useMockData()) {
    return { clientSecret: "demo_client_secret" };
  }
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { dinnerId, roundupAmount: roundupAmount ?? 0 },
  });
  if (error) throw error;
  return data;
}
```

No change to `createRsvp` — the ticket-side confirmation flow is untouched (see RESEARCH.md's note
on the pre-existing client-trust asymmetry, which this feature does not change).

## 4. `mobile/lib/payments.tsx` / `mobile/lib/payments.web.tsx`

Both `pay(dinner)` functions need to accept and thread through a roundup amount:

```ts
async function pay(dinner: Dinner, roundupAmount?: number): Promise<PayResult> {
  const { clientSecret } = await createPaymentIntent(dinner.id, roundupAmount);
  // ...unchanged from here
}
```

`useDinnerCheckout()`'s returned `pay` signature changes from `(dinner) => ...` to
`(dinner, roundupAmount?) => ...` in both platform files identically — this is a mechanical,
symmetric change, no platform-specific logic needed since the split only lives in Supabase/Stripe,
not in either client SDK.

## 5. `mobile/app/dinner/[id]/checkout.tsx`

Add a round-up toggle, shown only when the dinner is sponsorship-eligible (same three-condition
check `lib/api.ts` already uses at its donor-feed filter, ~line 613):

```ts
const roundupEligible =
  dinner?.seekingSponsorship && dinner?.sponsorApproved && dinner?.status === "published";
```

UI additions:
- A `Switch` + suggested-amount chips (e.g. ₪5 / ₪10 / ₪20, or "round up to the nearest ₪50" —
  product call; suggest starting with 3 fixed suggested amounts, matching the simplicity of
  `donate.tsx`'s free-text field rather than inventing a slider), shown directly under the existing
  total row, only when `roundupEligible`.
- Update the total row to show ticket price + roundup separately, e.g.:
  ```
  Ticket            ₪120
  Round-up donation  ₪10
  ─────────────────────
  Total             ₪130
  ```
- `handlePay` passes the selected roundup amount (0 if toggle off or not eligible) through to
  `pay(dinner, roundupAmount)`.
- Copy: something like "Add a little extra for [Host]'s dinner — 100% goes to this Shabbat, not
  Shishi" reusing the existing trust/notice-row pattern from `donate.tsx` (`noticeRow`/`noticeText`
  styles) so it visually matches the sponsor flow's existing donation disclosure.
- `confirmRsvp()` is unchanged — it still only creates the `rsvps` row, unaware of the roundup.

State needed: `roundupAmount` (number, default 0), `roundupEnabled` (boolean). Keep it simple —
no new component library needed, reuse `Switch` (already imported in `donate.tsx`) and `Button`-style
chips or a segmented control already present elsewhere in `components/ui/`.

## 6. Verification plan

Using the Stripe test-mode keys already configured per `mobile/README.md`/`.env.example`
(`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` + edge function's `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
secrets):

1. **Seed data**: create a dinner with `seeking_sponsorship = true`, `budget_needed` set, and
   manually flip `sponsor_approved = true` via Supabase Studio (per the existing manual-gate
   workflow). Note starting `amount_funded`.
2. **Happy path — combined charge succeeds**:
   - As an attendee, open checkout for that dinner, enable round-up, pick a suggested amount (e.g.
     ₪10), and pay with a Stripe test card that succeeds (`4242 4242 4242 4242`).
   - Confirm in the Stripe dashboard (test mode) that **one** PaymentIntent was created for
     `cost_per_head + roundup`.
   - Confirm the webhook fired `payment_intent.succeeded` and, in Supabase, a new
     `sponsor_donations` row exists with `amount = roundup` (not the combined total),
     `dinner_id` = the correct dinner, `sponsor_id` = the attendee, `status = 'succeeded'`,
     `stripe_payment_id` = the PaymentIntent id, `anonymous = true`.
   - Confirm `dinners.amount_funded` increased by exactly the roundup amount (not the combined
     total) — this is the key assertion that the split accounting is correct and the trigger picked
     up only the donation row's `amount`, not the ticket price.
   - Confirm the `rsvps` row was created with `payment_status = 'paid'` as before (unchanged path).
3. **Failure path**: repeat with a test card that's declined (`4000 0000 0000 0002`). Confirm no
   `rsvps` row is created (existing `handlePay` behavior — `pay()` returns `ok: false` before
   `confirmRsvp()` runs), and confirm the pre-inserted `sponsor_donations` row is flipped to
   `failed` by the webhook, and `amount_funded` is unaffected.
4. **Ineligible dinner**: repeat checkout against a dinner with `seeking_sponsorship = false` (or
   `sponsor_approved = false`). Confirm the round-up toggle does not render in the UI. As a
   defense-in-depth check, also call `create-payment-intent` directly (e.g. via `curl`/Postman with
   a valid JWT) passing a nonzero `roundupAmount` for this dinner, and confirm the function silently
   drops the roundup (charges ticket price only, inserts no `sponsor_donations` row) rather than
   erroring or accidentally earmarking money to an unapproved dinner.
5. **Missing donor info**: test with a profile that has no `email` set (phone-only signup) and
   confirm the ticket still charges successfully with the roundup silently dropped (per the
   `profile?.name && receiptEmail` guard in step 1's plan) rather than the whole checkout failing.
6. **Regression check**: run a normal ticket purchase with round-up disabled/not offered (e.g. a
   free dinner is out of scope entirely — `is_free` dinners already skip this function per existing
   code — and a paid, non-sponsorship dinner) and confirm behavior is byte-for-byte identical to
   pre-change: same PaymentIntent amount, same `rsvps` insert, no `sponsor_donations` row written.
