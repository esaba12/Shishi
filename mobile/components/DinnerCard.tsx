import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";
import { KOSHER_LEVELS } from "@/constants/options";
import { t } from "@/lib/i18n";
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

export function DinnerCard({ dinner, onPress }: { dinner: Dinner; onPress: () => void }) {
  const kosherLabel = KOSHER_LEVELS.find((k) => k.value === dinner.kosherLevel)?.label ?? "";
  const seatsLeft = dinner.capacity - dinner.seatsTaken;
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);

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
            <View style={styles.trustRow}>
              <Ionicons name="sparkles" size={12} color={colors.brand} />
              <Text style={styles.trust}>
                {t("dinner.hostedShabbats", { count: dinner.hostDinnersHostedCount })}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {dinner.description}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.meta}>
            {formatDate(dinner.date)} · {dinner.startTime}
          </Text>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} style={styles.metaIcon} />
          <Text style={styles.meta} numberOfLines={1}>
            {dinner.area}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={kosherLabel} tone="neutral" />
          <Badge
            label={dinner.isFree ? t("common.free") : `₪${dinner.costPerHead}`}
            tone="brand"
            style={styles.badgeGap}
          />
          <Badge
            label={seatsLeft > 0 ? t("common.seatsLeft", { count: seatsLeft }) : t("common.full")}
            tone={seatsLeft <= 0 ? "danger" : seatsLeft <= 2 ? "accent" : "success"}
            icon={seatsLeft <= 0 ? "close-circle" : "people-outline"}
            style={styles.badgeGap}
          />
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
  trustRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  trust: { ...typography.caption, color: colors.brand, marginStart: 4 },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginStart: 4,
    flexShrink: 1,
  },
  metaIcon: { marginStart: spacing.md },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: spacing.md,
  },
  badgeGap: { marginStart: spacing.xs },
});
