import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { createPaymentIntent, createRsvp, fetchDinner } from "@/lib/api";
import { isStripeConfigured } from "@/lib/env";
import { useAuth } from "@/context/AuthContext";
import type { Dinner } from "@/types";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { show } = useToast();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [dinner, setDinner] = useState<Dinner | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDinner(id).then(setDinner).catch(() => show("Couldn't load this dinner.", "error"));
  }, [id, show]);

  async function confirmRsvp() {
    if (!dinner || !profile) return;
    await createRsvp(dinner.id, profile.id, {
      paid: true,
      autoApprove: dinner.approvalMode === "auto_accept",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/dinner/${dinner.id}`);
  }

  async function handlePay() {
    if (!dinner) return;
    setLoading(true);
    try {
      const { clientSecret } = await createPaymentIntent(dinner.id);
      if (!isStripeConfigured || clientSecret === "demo_client_secret") {
        // No live Stripe key yet — simulate success so the rest of the flow is testable.
        await confirmRsvp();
        return;
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Shishi",
        paymentIntentClientSecret: clientSecret,
      });
      if (initError) throw new Error(initError.message);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) throw new Error(presentError.message);
      await confirmRsvp();
    } catch (e) {
      show(e instanceof Error ? e.message : t("checkout.failed"), "error");
    } finally {
      setLoading(false);
    }
  }

  if (!dinner) return null;

  return (
    <Screen>
      <Header title={t("checkout.title")} />

      <Card style={styles.summary} padded={false}>
        <View style={styles.summaryHeader}>
          <Avatar uri={dinner.hostPhotoUrl} name={dinner.hostName} size={44} />
          <View style={styles.summaryHeaderText}>
            <Text style={styles.host}>{t("checkout.hostShabbat", { host: dinner.hostName })}</Text>
            <Text style={styles.line}>
              {formatDate(dinner.date)} · {dinner.area}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("checkout.total")}</Text>
          <Text style={styles.totalValue}>{`₪${dinner.costPerHead}`}</Text>
        </View>
      </Card>

      <View style={styles.trustRow}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
        <Text style={styles.trustText}>{t("checkout.chargeNotice")}</Text>
      </View>

      {!isStripeConfigured ? (
        <View style={styles.demoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.brandDark} />
          <Text style={styles.demoText}>{t("checkout.demoNotice")}</Text>
        </View>
      ) : null}

      <Button label={t("checkout.pay", { amount: dinner.costPerHead })} onPress={handlePay} loading={loading} size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: spacing.md },
  summaryHeader: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  summaryHeaderText: { marginStart: spacing.md, flex: 1 },
  host: { ...typography.h3, color: colors.textPrimary },
  line: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  totalLabel: { ...typography.bodyBold, color: colors.textPrimary },
  totalValue: { ...typography.h2, color: colors.brand },
  trustRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  trustText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  demoText: { ...typography.caption, color: colors.brandDark, flex: 1 },
});
