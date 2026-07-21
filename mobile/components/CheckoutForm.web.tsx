import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { getStripePromise } from "@/lib/stripeWeb";

interface CheckoutFormProps {
  clientSecret: string;
  amountLabel: string;
  payLabel: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

// Stripe Elements' `appearance` API is the web SDK's own theming hook (not our theme.ts tokens
// directly — it's consumed by Stripe's hosted iframe, so values are duplicated here rather than
// imported) — kept close to the brand palette so the card form doesn't look like a foreign widget.
const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: colors.brand,
    colorBackground: colors.surfaceElevated,
    colorText: colors.textPrimary,
    colorDanger: colors.danger,
    fontFamily: "Rubik, system-ui, sans-serif",
    borderRadius: `${radii.md}px`,
  },
};

function InnerForm({ amountLabel, payLabel, onSuccess, onError, onCancel }: Omit<CheckoutFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setSubmitting(false);
    if (error) {
      onError(error.message ?? "Payment failed.");
      return;
    }
    onSuccess();
  }

  return (
    <View>
      <Text style={styles.amount}>{amountLabel}</Text>
      <View style={styles.elementWrap}>
        <PaymentElement />
      </View>
      <Button label={payLabel} onPress={handleConfirm} loading={submitting} size="lg" haptic={false} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} haptic={false} style={styles.cancel} />
    </View>
  );
}

/** Stripe.js Payment Element checkout, mounted in a Modal. Stays entirely inside the SPA (no
 *  redirect-away) via confirmPayment({ redirect: "if_required" }). Re-keyed by clientSecret so a new
 *  intent always gets a fresh Elements instance. */
export function CheckoutForm({ clientSecret, ...rest }: CheckoutFormProps) {
  return (
    <Elements key={clientSecret} stripe={getStripePromise()} options={{ clientSecret, appearance: stripeAppearance }}>
      <InnerForm {...rest} />
    </Elements>
  );
}

const styles = StyleSheet.create({
  amount: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
  elementWrap: { marginBottom: spacing.lg },
  cancel: { marginTop: spacing.sm },
});
