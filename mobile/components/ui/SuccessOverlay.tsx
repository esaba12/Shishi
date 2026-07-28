import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { BlurBackdrop } from "./BlurBackdrop";
import { SuccessBurst } from "./SuccessBurst";

interface SuccessOverlayProps {
  visible: boolean;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onHide: () => void;
  duration?: number;
}

// Brief full-screen celebration for the app's most significant moments — RSVP confirmed, donation
// sent, payment complete — replacing a plain toast with the bouncy-glow language already used for
// onboarding completion (see SuccessBurst). This is the one place in the app with a frosted-glass
// backdrop: a warm glow behind glass reads as literal candlelight, so it's kept to this one moment
// rather than applied throughout the UI.
export function SuccessOverlay({ visible, message, icon = "checkmark-circle", onHide, duration = 1100 }: SuccessOverlayProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: 220 });
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, animatedStyle]}>
      <BlurBackdrop />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <SuccessBurst style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={32} color={colors.onBrand} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </SuccessBurst>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  scrim: { backgroundColor: "rgba(225,29,72,0.14)" },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    maxWidth: 320,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  message: { ...typography.h3, color: colors.textPrimary, textAlign: "center" },
});
