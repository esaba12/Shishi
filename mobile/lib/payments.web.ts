import { createPaymentIntent } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import { t } from "@/lib/i18n";
import type { Dinner } from "@/types";

export interface PayResult {
  ok: boolean;
  error?: string;
}

// Web checkout. Demo mode (no Stripe project) simulates success so the flow is fully testable in the
// browser. A configured project falls through to a "coming soon" message rather than a silent success —
// the real Stripe.js card flow is a flagged follow-on (see plan Phase 4 / deferred).
export function useDinnerCheckout() {
  async function pay(dinner: Dinner): Promise<PayResult> {
    try {
      const { clientSecret } = await createPaymentIntent(dinner.id);
      if (!isStripeConfigured || clientSecret === "demo_client_secret") {
        return { ok: true };
      }
      return { ok: false, error: "Card payments on the web are coming soon." };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : t("checkout.failed") };
    }
  }

  return { pay };
}
