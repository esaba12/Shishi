import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radii, spacing, elevation } from "@/constants/theme";

interface CardProps extends ViewProps {
  /** Stronger shadow for hero/floating surfaces. */
  elevated?: boolean;
  padded?: boolean;
}

/** Standard white surface: rounded, hairline border, warm-tinted shadow. Replaces the repeated
 *  surface+border+radius blocks across cards, info panels, and summaries. */
export function Card({ elevated, padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.card, padded && styles.padded, elevated ? elevation.raised : elevation.card, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: { padding: spacing.md },
});
