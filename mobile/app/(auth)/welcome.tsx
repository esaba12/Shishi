import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { DesktopLanding } from "@/components/landing/DesktopLanding";
import { colors, spacing, typography } from "@/constants/theme";
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
    router.push("/(auth)/organization-select");
  }
  function requestJoin() {
    router.push("/(auth)/request-join");
  }
  function documentIntake() {
    router.push("/(auth)/document-intake");
  }

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} fullBleed>
        <DesktopLanding
          onGetStarted={() => getStarted()}
          onLogIn={logIn}
          onDemo={demo}
          onRequestJoin={requestJoin}
          onDocumentIntake={documentIntake}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Logo size={40} />
        </View>
        <Text style={styles.tagline}>Turn planning data into clear next steps.</Text>
        <Text style={styles.subtitle}>
          Bring your organization&apos;s files together, surface what needs attention, and leave every
          review with practical next steps.
        </Text>
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>organizations exploring</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>3 min</Text><Text style={styles.statLabel}>to a first review</Text></View>
        </View>
        <Text style={styles.statNote}>Illustrative demo metrics</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Create an account" onPress={getStarted} />
        <Button label="Sign in" variant="secondary" onPress={logIn} />
        <Button label="Explore the UIUC demo" variant="ghost" onPress={demo} />
        <Button label="What we need from you" variant="ghost" onPress={documentIntake} />
        <Button label="Request to join" variant="ghost" onPress={requestJoin} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
  },
  logoWrap: {
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
  statRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.lg },
  stat: { flex: 1 },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statNote: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.lg },
  actions: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
