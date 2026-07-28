import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { haptics } from "@/lib/haptics";
import { usePressScale } from "@/lib/usePressScale";
import { colors, radii, spacing, typography } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  /** Light haptic tick on press. On by default; disable for high-frequency/secondary actions. */
  haptic?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  haptic = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(0.97);

  function handlePress() {
    if (haptic) haptics.impact();
    onPress();
  }

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => !isDisabled && onPressIn()}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[styles.base, sizeStyles[size], variantStyles[variant], isDisabled && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.onBrand : colors.brand} />
        ) : (
          <Text style={[styles.label, sizeTextStyles[size], textVariantStyles[variant]]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  disabled: { opacity: 0.45 },
  label: { ...typography.bodyBold },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  lg: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
};

const sizeTextStyles: Record<Size, { fontSize: number }> = {
  sm: { fontSize: 14 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
};

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.onBrand },
  secondary: { color: colors.textPrimary },
  ghost: { color: colors.brand },
  danger: { color: colors.onBrand },
};
