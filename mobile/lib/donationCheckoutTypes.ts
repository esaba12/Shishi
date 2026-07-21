// Shared between donationCheckout.ts (native) and donationCheckout.web.tsx — kept in its own module,
// not re-exported from one platform variant to the other, because a cross-import between the two
// (even a type-only one) pulled the native-only lib/donationCheckout.ts — and with it
// @stripe/stripe-react-native — into the web Metro bundle graph.
export interface DonateInput {
  dinnerId: string;
  sponsorId: string;
  amount: number;
  donorLegalName: string;
  donorReceiptEmail: string;
  anonymous: boolean;
  message: string | null;
}

export interface DonateResult {
  ok: boolean;
  error?: string;
  donationId?: string;
}
