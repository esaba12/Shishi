import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card } from "./Card";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** A single pulsing placeholder block. Uses the built-in Animated API (no Reanimated dependency). */
export function Skeleton({ width = "100%", height = 14, radius = radii.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
}

/** Loading placeholder shaped like a DinnerCard, so the Discover list keeps its rhythm while data
 *  loads instead of collapsing to a bare spinner. */
export function DinnerCardSkeleton() {
  return (
    <Card style={styles.card}>
      <Skeleton width={52} height={52} radius={26} />
      <View style={styles.body}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="90%" height={12} style={styles.gap} />
        <Skeleton width="70%" height={12} style={styles.gap} />
        <View style={styles.row}>
          <Skeleton width={64} height={20} radius={radii.pill} />
          <Skeleton width={48} height={20} radius={radii.pill} style={styles.rowGap} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", marginBottom: spacing.md },
  body: { flex: 1, marginStart: spacing.md },
  gap: { marginTop: spacing.sm },
  row: { flexDirection: "row", marginTop: spacing.md },
  rowGap: { marginStart: spacing.sm },
});
