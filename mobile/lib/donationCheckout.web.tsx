import React, { useRef, useState } from "react";
import { createDonationIntent } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import { Modal } from "@/components/ui/Modal";
import { CheckoutForm } from "@/components/CheckoutForm.web";
import type { DonateInput, DonateResult } from "@/lib/donationCheckoutTypes";

export type { DonateInput, DonateResult } from "@/lib/donationCheckoutTypes";

// Web donation checkout — same Stripe.js Payment Element + Modal pattern as lib/payments.web.tsx,
// pointed at create-donation-intent instead of create-payment-intent.
export function useDonationCheckout() {
  const [state, setState] = useState<{ amount: number; clientSecret: string; donationId: string } | null>(null);
  const resolverRef = useRef<((result: DonateResult) => void) | null>(null);

  function settle(result: DonateResult) {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  async function donate(input: DonateInput): Promise<DonateResult> {
    try {
      const { clientSecret, donationId } = await createDonationIntent(
        input.dinnerId,
        input.sponsorId,
        input.amount,
        input.donorLegalName,
        input.donorReceiptEmail,
        { anonymous: input.anonymous, message: input.message }
      );
      if (!isStripeConfigured || clientSecret === "demo_client_secret") {
        return { ok: true, donationId };
      }
      return new Promise<DonateResult>((resolve) => {
        resolverRef.current = resolve;
        setState({ amount: input.amount, clientSecret, donationId });
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Donation failed, please try again." };
    }
  }

  const modal = (
    <Modal visible={!!state} onRequestClose={() => settle({ ok: false })}>
      {state ? (
        <CheckoutForm
          clientSecret={state.clientSecret}
          amountLabel={`₪${state.amount}`}
          payLabel={`Donate ₪${state.amount}`}
          onSuccess={() => settle({ ok: true, donationId: state.donationId })}
          onError={(error: string) => settle({ ok: false, error })}
          onCancel={() => settle({ ok: false })}
        />
      ) : null}
    </Modal>
  );

  return { donate, modal };
}
