// Supabase Edge Function: creates a Stripe PaymentIntent for attendee ticketing.
// Deploy with: supabase functions deploy create-payment-intent
// Requires project secrets: STRIPE_SECRET_KEY (set via `supabase secrets set`).
//
// Sponsor/donor payments are explicitly out of scope here (Bible §5.6/§5.11) \u2014 this
// function only ever charges the attendee for their own seat, in ILS, into the
// platform's Stripe account. Payouts to hosts are handled manually until that's built (V2).

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

    const { dinnerId } = await req.json();
    const { data: dinner, error } = await supabase
      .from("dinners")
      .select("cost_per_head, is_free, capacity, status")
      .eq("id", dinnerId)
      .single();
    if (error || !dinner) return new Response("Dinner not found", { status: 404 });
    if (dinner.is_free) return new Response("This dinner is free \u2014 no payment needed", { status: 400 });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(dinner.cost_per_head) * 100),
      currency: "ils",
      metadata: { dinnerId, attendeeId: user.id },
      automatic_payment_methods: { enabled: true },
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
