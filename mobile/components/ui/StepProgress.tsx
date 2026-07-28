import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface StepProgressProps {
  step: number; // 1-indexed
  total: number;
  label?: string;
}

// Slim segmented progress bar for the multi-step onboarding flow. Segments render in source order;
// React Native mirrors flexDirection: "row" automatically under RTL, so no direction branching
// is needed here for the fill to read correctly in Hebrew.
export function StepProgress({ step, total, label }: StepProgressProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <Segment key={i} filled={i < step} index={i} />
        ))}
      </View>
      <Text style={styles.label}>{label ?? `Step ${step} of ${total}`}</Text>
    </View>
  );
}

// Each segment animates its own fill, staggered by index, so advancing a step reads as a wave
// filling in left-to-right rather than an instant flip.
function Segment({ filled, index }: { filled: boolean; index: number }) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      fill.value = filled ? 1 : 0;
      return;
    }
    fill.value = withDelay(index * 40, withTiming(filled ? 1 : 0, { duration: 250 }));
  }, [filled, index, reducedMotion, fill]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.brandSoft, colors.brand]),
  }));

  return <Animated.View style={[styles.segment, animatedStyle]} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  track: { flexDirection: "row", gap: 6, marginBottom: spacing.xs },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
  },
  label: { ...typography.label, color: colors.textSecondary, textTransform: "uppercase" },
});
