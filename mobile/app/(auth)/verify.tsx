import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";

export default function VerifyOtp() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      router.replace("/(onboarding)/role-select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code, try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {email}.</Text>
      {!isSupabaseConfigured && (
        <Text style={styles.hint}>Demo mode: any 6-digit code works (e.g. 123456).</Text>
      )}
      <TextField
        label="Verification code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Verify" onPress={handleVerify} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.brand, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
});
