import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/constants/theme";

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
          <View key={i} style={[styles.segment, i < step && styles.segmentFilled]} />
        ))}
      </View>
      <Text style={styles.label}>{label ?? `Step ${step} of ${total}`}</Text>
    </View>
  );
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
  segmentFilled: {
    backgroundColor: colors.brand,
  },
  label: { ...typography.label, color: colors.textSecondary, textTransform: "uppercase" },
});
