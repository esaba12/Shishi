import type React from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { createDonationIntent } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import type { DonateInput, DonateResult } from "@/lib/donationCheckoutTypes";

export type { DonateInput, DonateResult } from "@/lib/donationCheckoutTypes";

// Native donation checkout: same PaymentSheet pattern as lib/payments.ts, pointed at
// create-donation-intent instead of create-payment-intent. Shares the { pay, modal } shape (here
// `donate`/`modal`) with the ticketing checkout so app/dinner/[id]/donate.tsx and checkout.tsx can be
// structured identically.
export function useDonationCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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
        return { ok: true, donationId }; // demo mode: simulate a successful donation
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Shishi",
        paymentIntentClientSecret: clientSecret,
      });
      if (initError) return { ok: false, error: initError.message };
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) return { ok: false, error: presentError.message };
      return { ok: true, donationId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : undefined };
    }
  }

  return { donate, modal: null as React.ReactNode };
}
