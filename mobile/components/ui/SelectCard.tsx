import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { usePressScale } from "@/lib/usePressScale";
import { Badge } from "./Badge";

interface SelectCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  badge?: string;
  style?: ViewStyle;
}

// Multi-select option card (checkbox semantics — "pick as many as apply", not a radio group).
// Selecting a card lights it: a soft warm glow blooms behind it and the trailing checkbox fills in,
// echoing the brand's candlelight motif rather than a generic tick.
export function SelectCard({ title, description, icon, selected, onPress, badge, style }: SelectCardProps) {
  const reducedMotion = useReducedMotion();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const glow = useSharedValue(selected ? 1 : 0);
  const check = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      glow.value = selected ? 1 : 0;
      check.value = selected ? 1 : 0;
      return;
    }
    glow.value = withTiming(selected ? 1 : 0, { duration: 280 });
    // Bounces in on select, settles cleanly on deselect — mirrors the original
    // `bounciness: selected ? 10 : 0` asymmetry, translated to Reanimated's damping/stiffness model.
    check.value = withSpring(
      selected ? 1 : 0,
      selected ? { damping: 10, stiffness: 200 } : { damping: 26, stiffness: 220 }
    );
  }, [selected, glow, check, reducedMotion]);

  function handlePress() {
    haptics.impact();
    onPress();
  }

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.94, 1]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: check.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, pressStyle, style]}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, selected && styles.cardSelected]}
      >
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons name={icon} size={20} color={selected ? colors.onBrand : colors.brand} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {badge ? <Badge label={badge} tone="accent" /> : null}
          </View>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          <Animated.View style={checkStyle}>
            <Ionicons name="checkmark" size={14} color={colors.onBrand} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  glow: {
    position: "absolute",
    top: -6,
    start: -6,
    end: -6,
    bottom: -6,
    borderRadius: radii.xl,
    backgroundColor: colors.brandSoft,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardSelected: {
    borderColor: colors.brand,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing.md,
  },
  iconWrapSelected: {
    backgroundColor: colors.brand,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
  title: { ...typography.h3, color: colors.textPrimary },
  description: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginStart: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
});
