import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { DesktopLanding } from "@/components/landing/DesktopLanding";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";
import { useResponsive } from "@/lib/responsive";

export default function Welcome() {
  const { continueAsDemoUser } = useAuth();
  const { isDesktop } = useResponsive();

  function getStarted() {
    router.push("/(auth)/phone");
  }
  function demo() {
    continueAsDemoUser();
    router.replace("/(tabs)");
  }

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} fullBleed>
        <DesktopLanding onGetStarted={getStarted} onDemo={!isSupabaseConfigured ? demo : undefined} />
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
