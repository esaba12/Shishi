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

// Mirrors app/(auth)/email.tsx but requests the OTP in "login" mode (shouldCreateUser: false), so
// an email with no account gets a clear error instead of silently spinning up a new one — see
// AuthContext.requestOtp. Same magic-link-on-web / code-on-demo split as signup.
export default function Login() {
  const { requestOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(email, "login");
      if (isSupabaseConfigured) {
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
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Enter the email you signed up with and we'll send you a sign-in link.</Text>
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
      <Button label="New here? Sign up" variant="ghost" onPress={() => router.replace("/(auth)/email")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
});
