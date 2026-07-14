import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { useOnboarding } from "@/context/OnboardingContext";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingDone() {
  const { draft } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const [status, setStatus] = useState<"saving" | "error" | "done">("saving");

  useEffect(() => {
    completeOnboarding({
      profile: { name: draft.profile.name ?? "You", ...draft.profile },
      roles: draft.roles,
      hostDetails: draft.hostDetails,
      sponsorDetails: draft.sponsorDetails,
    })
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        {status === "saving" && (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.text}>Setting your table...</Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={styles.text}>Something went wrong saving your profile.</Text>
            <Button label="Try again" onPress={() => router.replace("/(onboarding)/role-select")} />
          </>
        )}
        {status === "done" && (
          <>
            <Text style={styles.title}>You're in.</Text>
            <Text style={styles.text}>Shabbat shalom \u2014 let's find your table.</Text>
            <Button label="Enter Shishi" onPress={() => router.replace("/(tabs)")} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  title: { ...typography.h1, color: colors.text },
  text: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});
