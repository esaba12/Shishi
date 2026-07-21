// Supabase Edge Function: Stripe webhook receiver. The ONLY writer of sponsor_donations.status.
// Deploy with: supabase functions deploy stripe-webhook
// Requires project secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// After deploying, register the endpoint URL in the Stripe dashboard for
// payment_intent.succeeded / payment_intent.payment_failed, then set STRIPE_WEBHOOK_SECRET to the
// signing secret Stripe gives you for that endpoint.
//
// Donations are receipt-bearing platform-nonprofit money, unlike attendee ticket RSVPs (which the
// client marks paid directly after presentPaymentSheet()/confirmPayment() succeeds — fine for a
// ticket). sponsor_donations has no client-facing UPDATE policy at all (see schema.sql): this
// function, authenticating with the service-role key, is the only path that can ever move a
// donation out of `pending`. Don't "fix" that asymmetry to match the ticketing flow.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Service-role client: bypasses RLS entirely, which is exactly why this function (not the app) is
// the only thing allowed to hold this key.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? "", webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const status = event.type === "payment_intent.succeeded" ? "succeeded" : "failed";

    const { error } = await supabaseAdmin
      .from("sponsor_donations")
      .update({ status })
      .eq("stripe_payment_id", paymentIntent.id);

    // Not every PaymentIntent is a donation (attendee ticketing uses this same Stripe account) — a
    // no-match update is expected and not an error; only a real DB error should fail the webhook.
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
