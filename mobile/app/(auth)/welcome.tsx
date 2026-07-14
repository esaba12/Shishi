import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";

export default function Welcome() {
  const { continueAsDemoUser } = useAuth();

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
        <Button label="Get started" onPress={() => router.push("/(auth)/phone")} />
        {!isSupabaseConfigured && (
          <Button
            label="Continue as demo user"
            variant="ghost"
            onPress={() => {
              continueAsDemoUser();
              router.replace("/(tabs)");
            }}
          />
        )}
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
    color: colors.primary,
    marginBottom: spacing.md,
  },
  tagline: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  actions: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
