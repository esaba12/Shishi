import React from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";

interface HeaderProps {
  title: string;
  onBack?: () => void;
  /** Larger, serif display title for top-level screens. */
  large?: boolean;
}

export function Header({ title, onBack, large }: HeaderProps) {
  // The back chevron must point the way "back" goes, which flips under RTL.
  const backIcon = I18nManager.isRTL ? "chevron-forward" : "chevron-back";
  return (
    <View style={[styles.wrapper, large && styles.wrapperLarge]}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} style={styles.backButton}>
        <Ionicons name={backIcon} size={22} color={colors.textPrimary} />
      </Pressable>
      <Text style={[large ? styles.titleLarge : styles.title]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  wrapperLarge: { marginBottom: spacing.lg },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginEnd: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  titleLarge: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  spacer: { width: 36 },
});
