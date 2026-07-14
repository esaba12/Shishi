import React from "react";
import { StripeProvider } from "@stripe/stripe-react-native";
import { isStripeConfigured } from "@/lib/env";

// Native payment context (iOS/Android). The web override (PaymentProvider.web.tsx) is a passthrough,
// which keeps @stripe/stripe-react-native out of the web bundle entirely.
export function PaymentProvider({ children }: { children: React.ReactNode }) {
  if (!isStripeConfigured) return <>{children}</>;
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as string}
      merchantIdentifier="merchant.org.shishi"
    >
      <>{children}</>
    </StripeProvider>
  );
}
