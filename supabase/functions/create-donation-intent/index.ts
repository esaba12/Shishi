// Supabase Edge Function: creates a Stripe PaymentIntent for a sponsor donation.
// Deploy with: supabase functions deploy create-donation-intent
// Requires project secrets: STRIPE_SECRET_KEY (shared with create-payment-intent).
//
// This is a DONATION to Shishi's nonprofit entity, earmarked for a specific dinner — not a
// peer-to-peer payment to the host. Same single centralized Stripe account as attendee ticketing, no
// per-host Stripe Connect. The sponsor_donations row this inserts starts `pending`; only the
// stripe-webhook function (using the service-role key) is ever allowed to flip it to `succeeded` —
// this function deliberately does not trust the client's later "it worked" signal for donations the
// way create-payment-intent's caller does for ticket RSVPs, because a donation is receipt-bearing.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { dinnerId, amount, donorLegalName, donorReceiptEmail, anonymous, message } = await req.json();
    if (!amount || Number(amount) <= 0) {
      return new Response("Invalid donation amount", { status: 400 });
    }
    if (!donorLegalName || !donorReceiptEmail) {
      return new Response("Donor name and receipt email are required", { status: 400 });
    }

    const { data: dinner, error: dinnerError } = await supabase
      .from("dinners")
      .select("host_id, seeking_sponsorship, sponsor_approved, status")
      .eq("id", dinnerId)
      .single();
    if (dinnerError || !dinner) return new Response("Dinner not found", { status: 404 });
    if (!dinner.seeking_sponsorship || !dinner.sponsor_approved || dinner.status !== "published") {
      return new Response("This dinner isn't open for sponsorship right now", { status: 400 });
    }

    // Create the PaymentIntent first so its id can be stored on the donation row at insert time —
    // there's deliberately no client-facing UPDATE policy on sponsor_donations (see schema.sql), so
    // this function can't patch the row afterward; only the stripe-webhook function (service role)
    // can. The webhook looks the row up by stripe_payment_id, not by a metadata round-trip.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: "ils",
      metadata: { dinnerId, sponsorId: user.id, hostId: dinner.host_id },
      automatic_payment_methods: { enabled: true },
    });

    // Uses the caller's own JWT-scoped client — RLS's "sponsor creates their own donation" policy
    // (sponsor_id = auth.uid()) is the actual enforcement here, this is just belt-and-suspenders.
    const { data: donation, error: donationError } = await supabase
      .from("sponsor_donations")
      .insert({
        dinner_id: dinnerId,
        host_id: dinner.host_id,
        sponsor_id: user.id,
        donor_legal_name: donorLegalName,
        donor_receipt_email: donorReceiptEmail,
        amount,
        currency: "ils",
        status: "pending",
        stripe_payment_id: paymentIntent.id,
        anonymous: !!anonymous,
        message: message ?? null,
      })
      .select("id")
      .single();
    if (donationError || !donation) {
      // The PaymentIntent already exists but nothing references it — cancel it so it doesn't sit
      // around as an orphaned charge attempt with no matching donation record.
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      return new Response(JSON.stringify({ error: donationError?.message ?? "Could not record donation" }), {
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, donationId: donation.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
