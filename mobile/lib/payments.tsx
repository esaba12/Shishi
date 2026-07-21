import type React from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { createPaymentIntent } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import type { Dinner } from "@/types";

export interface PayResult {
  ok: boolean;
  error?: string;
}

// Native checkout: Stripe PaymentSheet. Preserves the demo/`demo_client_secret` branch so the flow
// is testable without a live Stripe key. RSVP creation + navigation stay in the checkout screen.
export function useDinnerCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  async function pay(dinner: Dinner): Promise<PayResult> {
    try {
      const { clientSecret } = await createPaymentIntent(dinner.id);
      if (!isStripeConfigured || clientSecret === "demo_client_secret") {
        return { ok: true }; // demo mode: simulate a successful charge
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Shishi",
        paymentIntentClientSecret: clientSecret,
      });
      if (initError) return { ok: false, error: initError.message };
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) return { ok: false, error: presentError.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : undefined };
    }
  }

  // Native has no in-flow modal — PaymentSheet is itself a native overlay, presented imperatively
  // above. `modal` exists only so callers share one `{ pay, modal }` contract across platforms
  // (web needs somewhere to mount its Stripe Elements form).
  return { pay, modal: null as React.ReactNode };
}
