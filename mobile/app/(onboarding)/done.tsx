import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";
import { colors, spacing, typography } from "@/constants/theme";
import { useOnboarding } from "@/context/OnboardingContext";
import { useAuth } from "@/context/AuthContext";
import { useReducedMotion } from "@/lib/useReducedMotion";

export default function OnboardingDone() {
  const { draft } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const [status, setStatus] = useState<"saving" | "error" | "done">("saving");
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (status !== "done") return;
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [status, reducedMotion, scale, opacity]);

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        {status === "saving" && (
          <>
            <LogoMark size={56} />
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.text}>Setting your table…</Text>
          </>
        )}
        {status === "error" && (
          <>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.text}>Something went wrong saving your profile.</Text>
            <Button label="Try again" onPress={() => router.replace("/(onboarding)/role-select")} />
          </>
        )}
        {status === "done" && (
          <>
            <Animated.View style={{ opacity, transform: [{ scale }] }}>
              <LogoMark size={72} />
            </Animated.View>
            <Text style={styles.title}>You're in.</Text>
            <Text style={styles.text}>Shabbat shalom — let's find your table.</Text>
            <Button label="Enter Shishi" onPress={() => router.replace("/(tabs)")} size="lg" />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
