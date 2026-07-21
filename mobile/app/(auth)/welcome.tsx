import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { DesktopLanding } from "@/components/landing/DesktopLanding";
import { colors, spacing, typography } from "@/constants/theme";
import { isSupabaseConfigured } from "@/lib/env";
import { useResponsive } from "@/lib/responsive";
import type { Role } from "@/types";

export default function Welcome() {
  const { isDesktop } = useResponsive();

  function getStarted(role?: Role) {
    router.push(role ? { pathname: "/(auth)/email", params: { role } } : "/(auth)/email");
  }
  function logIn() {
    router.push("/(auth)/login");
  }
  function demo() {
    router.push("/(auth)/demo-role");
  }

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} fullBleed>
        <DesktopLanding
          onGetStarted={getStarted}
          onLogIn={isSupabaseConfigured ? logIn : undefined}
          onDemo={!isSupabaseConfigured ? demo : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>Shishi</Text>
        <Text style={styles.tagline}>A seat at the table for every Jew who wants one.</Text>
        <Text style={styles.subtitle}>
          Find a Shabbat table to join, or open your home to someone who needs one.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Get started" onPress={getStarted} />
        {isSupabaseConfigured && <Button label="Log in" variant="secondary" onPress={logIn} />}
        {!isSupabaseConfigured && <Button label="Continue as demo user" variant="ghost" onPress={demo} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
  },
  wordmark: {
    ...typography.h1,
    fontSize: 40,
    color: colors.brand,
    marginBottom: spacing.md,
  },
  tagline: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
