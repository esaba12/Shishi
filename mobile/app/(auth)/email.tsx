import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";

// Email magic link for now, not phone — see the comment on AuthContext.requestOtp for why, and for
// why this is a link to click rather than a code to type.
export default function EmailEntry() {
  const { requestOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(email);
      if (isSupabaseConfigured) {
        // Live mode: there's no code to type — clicking the emailed link signs you in directly and
        // lands you back here already authenticated (lib/supabase.ts picks the session up from the
        // URL). Demo mode has no real email to wait for, so it keeps the old code-entry screen,
        // which simulates success with any 6-digit code.
        setSent(true);
      } else {
        router.push({ pathname: "/(auth)/verify", params: { email } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong sending the link.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <Ionicons name="mail-outline" size={40} color={colors.brand} style={styles.icon} />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a sign-in link to {email}. Open it on this device to continue — this tab will pick
          up automatically once you do.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>What's your email?</Text>
      <Text style={styles.subtitle}>We'll email you a link to verify it's you.</Text>
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@example.com"
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send link" onPress={handleContinue} loading={loading} disabled={!email.includes("@")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
});
