import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazy singleton — loadStripe() should only ever be called once per publishable key. Shared by both
 *  the attendee-ticketing checkout and the sponsor-donation checkout on web. */
export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as string;
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
