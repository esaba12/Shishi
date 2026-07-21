import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/useReducedMotion";
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
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      glow.setValue(selected ? 1 : 0);
      check.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(glow, { toValue: selected ? 1 : 0, duration: 280, useNativeDriver: true }).start();
    Animated.spring(check, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: selected ? 10 : 0,
    }).start();
  }, [selected, glow, check, reducedMotion]);

  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  function handlePress() {
    haptics.impact();
    onPress();
  }

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          },
        ]}
      />
      <Pressable
        onPress={handlePress}
        onPressIn={() => spring(0.98)}
        onPressOut={() => spring(1)}
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
          <Animated.View style={{ opacity: check, transform: [{ scale: check }] }}>
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
