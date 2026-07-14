import React from "react";

// Web has no native Stripe provider; card payments on web go through lib/payments.web.ts.
export function PaymentProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
