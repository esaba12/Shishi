import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { fetchDinner } from "@/lib/api";
import { useDonationCheckout } from "@/lib/donationCheckout";
import { haptics } from "@/lib/haptics";
import { useAuth } from "@/context/AuthContext";
import type { Dinner } from "@/types";

export default function Donate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { show } = useToast();
  const { donate, modal } = useDonationCheckout();
  const [dinner, setDinner] = useState<Dinner | null>(null);
  const [amount, setAmount] = useState("");
  const [donorLegalName, setDonorLegalName] = useState("");
  const [donorReceiptEmail, setDonorReceiptEmail] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDinner(id).then((d) => {
      setDinner(d);
      const remaining = d && d.budgetNeeded != null ? Math.max(0, d.budgetNeeded - d.amountFunded) : 0;
      if (remaining > 0) setAmount(String(remaining));
    });
  }, [id]);

  useEffect(() => {
    if (profile?.name) setDonorLegalName(profile.name);
  }, [profile?.name]);

  const canSubmit =
    !!dinner && Number(amount) > 0 && donorLegalName.trim().length > 0 && donorReceiptEmail.includes("@");

  async function handleDonate() {
    if (!dinner || !profile || !canSubmit) return;
    setSubmitting(true);
    try {
      const result = await donate({
        dinnerId: dinner.id,
        sponsorId: profile.id,
        amount: Number(amount),
        donorLegalName: donorLegalName.trim(),
        donorReceiptEmail: donorReceiptEmail.trim(),
        anonymous,
        message: message.trim() || null,
      });
      if (!result.ok) {
        show(result.error ?? "Donation failed, please try again.", "error");
        return;
      }
      haptics.success();
      show("Thank you — your donation is on its way to this dinner.", "success");
      router.replace(`/dinner/${dinner.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!dinner) return null;

  const budget = dinner.budgetNeeded ?? 0;
  const remaining = Math.max(0, budget - dinner.amountFunded);

  return (
    <Screen>
      <Header title="Fund this dinner" />

      <Card style={styles.summary} padded={false}>
        <View style={styles.summaryHeader}>
          <Avatar uri={dinner.hostPhotoUrl} name={dinner.hostName} size={44} />
          <View style={styles.summaryHeaderText}>
            <Text style={styles.host}>{dinner.hostName}'s Shabbat</Text>
            <Text style={styles.line}>{dinner.area}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Still needed</Text>
          <Text style={styles.totalValue}>{`₪${remaining} of ₪${budget}`}</Text>
        </View>
      </Card>

      <View style={styles.noticeRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.brandDark} />
        <Text style={styles.noticeText}>
          This is a donation to Shishi, earmarked for this dinner — not a direct payment to the host.
          {/* TODO: once Shishi's nonprofit entity (501(c)(3)/"American Friends of") is formed, surface
              a tax-deductibility disclosure here alongside the receipt email. */}
        </Text>
      </View>

      <TextField
        label="Donation amount (₪)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="150"
      />
      <TextField
        label="Your name (for the donation record)"
        value={donorLegalName}
        onChangeText={setDonorLegalName}
        placeholder="Full name"
      />
      <TextField
        label="Receipt email"
        value={donorReceiptEmail}
        onChangeText={setDonorReceiptEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextField
        label="A note for the host (optional)"
        value={message}
        onChangeText={setMessage}
        placeholder="So glad this exists — enjoy Shabbat!"
        multiline
        numberOfLines={2}
        style={{ minHeight: 60, textAlignVertical: "top" }}
      />

      <View style={styles.anonRow}>
        <View style={styles.anonText}>
          <Text style={styles.anonLabel}>Donate anonymously</Text>
          <Text style={styles.anonHelp}>Hides your name from the host — your donation record stays the same.</Text>
        </View>
        <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.brand }} />
      </View>

      <Button label={`Donate ₪${amount || 0}`} onPress={handleDonate} disabled={!canSubmit} loading={submitting} size="lg" />
      {modal}
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
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md },
  totalLabel: { ...typography.bodyBold, color: colors.textPrimary },
  totalValue: { ...typography.h3, color: colors.brand },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: { ...typography.caption, color: colors.brandDark, flex: 1 },
  anonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  anonText: { flex: 1 },
  anonLabel: { ...typography.bodyBold, color: colors.textPrimary },
  anonHelp: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
