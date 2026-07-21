import React, { useRef, useState } from "react";
import { createPaymentIntent } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { CheckoutForm } from "@/components/CheckoutForm.web";
import type { Dinner } from "@/types";

export interface PayResult {
  ok: boolean;
  error?: string;
}

// Web checkout: Stripe.js Payment Element, mounted in a Modal so the flow never leaves the SPA.
// Hits the same create-payment-intent Edge Function native already uses — no backend change needed
// for this to work, only a web-capable client. Demo mode (no Stripe project) keeps simulating an
// instant success so the flow stays fully testable without live keys.
export function useDinnerCheckout() {
  const [state, setState] = useState<{ dinner: Dinner; clientSecret: string } | null>(null);
  const resolverRef = useRef<((result: PayResult) => void) | null>(null);

  function settle(result: PayResult) {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  async function pay(dinner: Dinner): Promise<PayResult> {
    try {
      const { clientSecret } = await createPaymentIntent(dinner.id);
      if (!isStripeConfigured || clientSecret === "demo_client_secret") {
        return { ok: true }; // demo mode: simulate a successful charge
      }
      return new Promise<PayResult>((resolve) => {
        resolverRef.current = resolve;
        setState({ dinner, clientSecret });
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : t("checkout.failed") };
    }
  }

  const modal = (
    <Modal visible={!!state} onRequestClose={() => settle({ ok: false })}>
      {state ? (
        <CheckoutForm
          clientSecret={state.clientSecret}
          amountLabel={`₪${state.dinner.costPerHead}`}
          payLabel={t("checkout.pay", { amount: state.dinner.costPerHead })}
          onSuccess={() => settle({ ok: true })}
          onError={(error: string) => settle({ ok: false, error })}
          onCancel={() => settle({ ok: false })}
        />
      ) : null}
    </Modal>
  );

  return { pay, modal };
}
