import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useDemoTheme } from "@/context/DemoThemeContext";

type Tone = "neutral" | "brand" | "success" | "danger" | "accent";

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

/** Small pill for status/metadata (kosher level, price, seats-left urgency). Tokenized replacement
 *  for the inline tag styles that were scattered across DinnerCard. */
export function Badge({ label, tone = "neutral", icon, style }: BadgeProps) {
  const { theme } = useDemoTheme();
  const palette = tone === "accent"
    ? { bg: theme.accentSoft, fg: theme.brand }
    : tone === "brand"
      ? { bg: theme.brandSoft, fg: theme.brandDark }
      : tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.fg} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  brand: { bg: colors.brandSoft, fg: colors.brandDark },
  success: { bg: colors.successBg, fg: colors.success },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  accent: { bg: colors.accentSoft, fg: colors.brand },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  icon: { marginEnd: 4 },
  label: { ...typography.label },
});
