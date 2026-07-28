import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { usePressScale } from "@/lib/usePressScale";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { Dinner } from "@/types";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Donor-feed card — modeled on DinnerCard's layout/motion, but leads with the funding ask instead
 *  of seats-left, since a sponsor's decision is "how much of this budget do I want to cover," not
 *  "is there room for me." */
export function SponsorDinnerCard({ dinner, onPress }: { dinner: Dinner; onPress: () => void }) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const reducedMotion = useReducedMotion();

  const budget = dinner.budgetNeeded ?? 0;
  const progress = budget > 0 ? Math.min(1, dinner.amountFunded / budget) : 0;
  const remaining = Math.max(0, budget - dinner.amountFunded);

  // Fills in from 0 on mount/update rather than rendering at final width, so a sponsor sees how much
  // of a dinner's budget their contribution (or others') actually moved the needle.
  const fill = useSharedValue(reducedMotion ? progress : 0);
  useEffect(() => {
    fill.value = reducedMotion ? progress : withTiming(progress, { duration: 600 });
  }, [progress, reducedMotion, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, elevation.card]}
      >
        <View style={styles.headerRow}>
          <Avatar uri={dinner.hostPhotoUrl} name={dinner.hostName} size={52} />
          <View style={styles.headerText}>
            <Text style={styles.host} numberOfLines={1}>
              {dinner.hostName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDate(dinner.date)} · {dinner.area}
            </Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {dinner.description}
        </Text>

        {dinner.dinnerTypeTags.length > 0 && (
          <View style={styles.tagRow}>
            {dinner.dinnerTypeTags.slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} tone="neutral" style={styles.tagGap} />
            ))}
          </View>
        )}

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, fillStyle]} />
        </View>
        <View style={styles.fundingRow}>
          <Text style={styles.fundingRaised}>
            ₪{dinner.amountFunded} <Text style={styles.fundingOf}>raised of ₪{budget}</Text>
          </Text>
          <View style={styles.remainingBadge}>
            <Ionicons name="heart" size={12} color={colors.brand} />
            <Text style={styles.remainingText}>₪{remaining} to go</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, marginStart: spacing.md },
  host: { ...typography.h3, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  description: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm },
  tagGap: { marginEnd: spacing.xs, marginBottom: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.brand },
  fundingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  fundingRaised: { ...typography.bodyBold, color: colors.textPrimary },
  fundingOf: { ...typography.caption, color: colors.textSecondary, fontFamily: typography.caption.fontFamily },
  remainingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  remainingText: { ...typography.label, color: colors.brand },
});
