import React, { useCallback, useEffect, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";
import { KOSHER_LEVELS } from "@/constants/options";
import { t } from "@/lib/i18n";
import { createRsvp, fetchDinner, fetchMyRsvpForDinner, isAddressRevealed } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Dinner } from "@/types";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function DinnerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [dinner, setDinner] = useState<Dinner | null>(null);
  const [myRsvp, setMyRsvp] = useState<{ status: string; paymentStatus: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, rsvp] = await Promise.all([
        fetchDinner(id),
        profile ? fetchMyRsvpForDinner(id, profile.id) : Promise.resolve(null),
      ]);
      setDinner(d);
      setMyRsvp(rsvp);
    } catch {
      show("Couldn't load this dinner.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, profile, show]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRsvp() {
    if (!dinner || !profile) return;
    if (!dinner.isFree) {
      router.push(`/dinner/${dinner.id}/checkout`);
      return;
    }
    setSubmitting(true);
    try {
      await createRsvp(dinner.id, profile.id, {
        paid: false,
        autoApprove: dinner.approvalMode === "auto_accept",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      show(
        dinner.approvalMode === "auto_accept" ? "You're in — see you Friday!" : "Request sent to the host.",
        "success"
      );
      await load();
    } catch {
      show("Couldn't complete your RSVP. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !dinner) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.headerWrap}>
          <Header title={t("dinner.title")} />
        </View>
        <View style={styles.scroll}>
          <Skeleton width={56} height={56} radius={28} />
          <Skeleton width="60%" height={18} style={{ marginTop: spacing.md }} />
          <Skeleton width="100%" height={64} radius={radii.md} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={200} radius={radii.lg} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const kosherLabel = KOSHER_LEVELS.find((k) => k.value === dinner.kosherLevel)?.label ?? "";
  const seatsLeft = dinner.capacity - dinner.seatsTaken;
  const addressVisible = myRsvp?.status === "approved" && isAddressRevealed(dinner);

  const ctaLabel =
    seatsLeft <= 0
      ? t("common.full")
      : dinner.approvalMode === "auto_accept"
      ? dinner.isFree
        ? t("dinner.rsvp")
        : t("dinner.getTicket")
      : t("dinner.requestToJoin");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerWrap}>
        <Header title={t("dinner.title")} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: myRsvp ? spacing.xl : 128 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hostRow}>
          <Avatar uri={dinner.hostPhotoUrl} name={dinner.hostName} size={60} />
          <View style={styles.hostText}>
            <Text style={styles.hostName}>{dinner.hostName}</Text>
            <View style={styles.trustRow}>
              <Ionicons name="sparkles" size={13} color={colors.brand} />
              <Text style={styles.hostMeta}>
                {t("dinner.hostedShabbats", { count: dinner.hostDinnersHostedCount })}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.description}>{dinner.description}</Text>

        <Card style={styles.infoCard} padded={false}>
          <InfoRow icon="calendar-outline" label={t("dinner.when")} value={`${formatDate(dinner.date)} · ${dinner.startTime}`} />
          <Divider />
          <InfoRow
            icon={addressVisible ? "location-outline" : "lock-closed-outline"}
            label={t("dinner.where")}
            value={addressVisible ? dinner.exactAddress ?? dinner.area : t("dinner.addressHidden", { area: dinner.area })}
            muted={!addressVisible}
          />
          <Divider />
          <InfoRow icon="restaurant-outline" label={t("dinner.kosher")} value={kosherLabel} />
          <Divider />
          <InfoRow
            icon="pricetag-outline"
            label={t("dinner.cost")}
            value={dinner.isFree ? t("common.free") : t("dinner.costPerPerson", { amount: dinner.costPerHead })}
          />
          <Divider />
          <InfoRow
            icon="people-outline"
            label={t("dinner.seats")}
            value={seatsLeft > 0 ? t("dinner.seatsValue", { left: seatsLeft, total: dinner.capacity }) : t("common.full")}
          />
        </Card>

        {myRsvp ? (
          <StatusBanner status={myRsvp.status} />
        ) : null}

        <Button
          label={t("dinner.reportDinner")}
          variant="ghost"
          size="sm"
          haptic={false}
          onPress={() =>
            router.push({
              pathname: "/report",
              params: { targetType: "dinner", targetId: dinner.id, label: "dinner" },
            })
          }
          style={styles.report}
        />
      </ScrollView>

      {!myRsvp ? (
        <View style={[styles.footer, elevation.overlay, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.footerPrice}>
            <Text style={styles.footerPriceValue}>
              {dinner.isFree ? t("common.free") : `₪${dinner.costPerHead}`}
            </Text>
            {!dinner.isFree ? <Text style={styles.footerPriceUnit}>{t("discover.perPerson")}</Text> : null}
          </View>
          <Button
            label={ctaLabel}
            onPress={handleRsvp}
            disabled={seatsLeft <= 0}
            loading={submitting}
            size="lg"
            style={styles.footerCta}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { textAlign: I18nManager.isRTL ? "left" : "right" }, muted && styles.infoValueMuted]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatusBanner({ status }: { status: string }) {
  const map: Record<string, { tone: "success" | "info" | "danger"; icon: keyof typeof Ionicons.glyphMap; text: string }> = {
    approved: { tone: "success", icon: "checkmark-circle", text: t("dinner.confirmed") },
    pending: { tone: "info", icon: "time", text: t("dinner.pending") },
    declined: { tone: "danger", icon: "close-circle", text: t("dinner.declined") },
  };
  const cfg = map[status];
  if (!cfg) return null;
  const palette = {
    success: { bg: colors.successBg, fg: colors.success },
    info: { bg: colors.infoBg, fg: colors.brandDark },
    danger: { bg: colors.dangerBg, fg: colors.danger },
  }[cfg.tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Ionicons name={cfg.icon} size={18} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{cfg.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scroll: { paddingHorizontal: spacing.lg },
  hostRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  hostText: { marginStart: spacing.md, flex: 1 },
  hostName: { ...typography.h2, color: colors.textPrimary },
  trustRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  hostMeta: { ...typography.caption, color: colors.brand, marginStart: 4 },
  description: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.lg },
  infoCard: { marginBottom: spacing.lg, paddingVertical: spacing.xs },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing.sm,
  },
  infoLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.bodyBold, color: colors.textPrimary, flex: 2 },
  infoValueMuted: { ...typography.caption, color: colors.textSecondary, fontFamily: typography.caption.fontFamily },
  divider: { height: 1, backgroundColor: colors.border, marginStart: spacing.md + 34 + spacing.sm },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.bodyBold, flex: 1 },
  report: { alignSelf: "center", marginTop: spacing.xs },
  footer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPrice: { marginEnd: spacing.md },
  footerPriceValue: { ...typography.h3, color: colors.textPrimary },
  footerPriceUnit: { ...typography.caption, color: colors.textSecondary },
  footerCta: { flex: 1 },
});
