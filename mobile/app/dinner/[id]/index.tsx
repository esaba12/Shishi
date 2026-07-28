import React, { useCallback, useEffect, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "@/lib/haptics";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TextField } from "@/components/ui/TextField";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SuccessOverlay } from "@/components/ui/SuccessOverlay";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";
import { KOSHER_LEVELS } from "@/constants/options";
import { t } from "@/lib/i18n";
import { useResponsive } from "@/lib/responsive";
import { isSupabaseConfigured } from "@/lib/env";
import {
  cancelPotluckClaim,
  claimPotluckItem,
  createRsvp,
  fetchDinner,
  fetchDinnerAddress,
  fetchMyRsvpForDinner,
  fetchPotluckItems,
  isAddressRevealed,
} from "@/lib/api";
import { claimedQuantity, findMyClaim, isItemFulfilled, pledgedAmount } from "@/lib/potluck";
import { useAuth } from "@/context/AuthContext";
import type { Dinner, PotluckItem } from "@/types";

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
  const { contentMaxWidth } = useResponsive();
  const centered = { width: "100%" as const, maxWidth: contentMaxWidth, alignSelf: "center" as const };
  const [dinner, setDinner] = useState<Dinner | null>(null);
  const [myRsvp, setMyRsvp] = useState<{ status: string; paymentStatus: string } | null>(null);
  const [potluckItems, setPotluckItems] = useState<PotluckItem[]>([]);
  const [revealedAddress, setRevealedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, rsvp, potluck] = await Promise.all([
        fetchDinner(id),
        profile ? fetchMyRsvpForDinner(id, profile.id) : Promise.resolve(null),
        fetchPotluckItems(id),
      ]);
      setDinner(d);
      setMyRsvp(rsvp);
      setPotluckItems(potluck);
    } catch {
      show("Couldn't load this dinner.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, profile, show]);

  useEffect(() => {
    load();
  }, [load]);

  // exact_address isn't included in the dinner queries anymore (see DINNER_COLUMNS in lib/api.ts —
  // the DB revokes wildcard column access to it), so the real address — for the host, or an approved
  // attendee past the reveal window — has to come from the get_dinner_address RPC. Demo mode has no
  // RLS to work around, so dinner.exactAddress (seeded directly on the mock object) stays authoritative there.
  useEffect(() => {
    if (!isSupabaseConfigured || !dinner || !profile) return;
    const isHost = dinner.hostId === profile.id;
    const isRevealedToAttendee = myRsvp?.status === "approved" && isAddressRevealed(dinner);
    if (!isHost && !isRevealedToAttendee) {
      setRevealedAddress(null);
      return;
    }
    fetchDinnerAddress(dinner.id).then(setRevealedAddress).catch(() => setRevealedAddress(null));
  }, [dinner, myRsvp, profile]);

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
      haptics.success();
      setSuccessMessage(
        dinner.approvalMode === "auto_accept" ? "You're in — see you Friday!" : "Request sent to the host."
      );
      await load();
    } catch {
      show("Couldn't complete your RSVP. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const canClaimPotluck = myRsvp?.status === "approved";

  async function handleClaim(item: PotluckItem, quantity: number, amount: number | null, note: string) {
    if (!profile) return;
    try {
      await claimPotluckItem({
        itemId: item.id,
        dinnerId: item.dinnerId,
        attendeeId: profile.id,
        attendeeName: profile.name,
        quantity,
        contributionAmount: amount,
        note: note.trim() || null,
      });
      await load();
      haptics.success();
      show(item.isMoneyRequest ? "Thanks for chipping in!" : "You're on the list — thank you!", "success");
    } catch {
      show("Couldn't save that. Please try again.", "error");
    }
  }

  async function handleCancelClaim(item: PotluckItem) {
    const claim = findMyClaim(item, profile?.id);
    if (!profile || !claim) return;
    try {
      await cancelPotluckClaim(claim.id, item.dinnerId, item.id, profile.id);
      await load();
    } catch {
      show("Couldn't cancel that. Please try again.", "error");
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
  const isHost = profile?.id === dinner.hostId;
  const address = isSupabaseConfigured ? revealedAddress : dinner.exactAddress;
  const addressVisible = isHost || (myRsvp?.status === "approved" && isAddressRevealed(dinner) && !!address);

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
      <View style={[styles.headerWrap, centered]}>
        <Header title={t("dinner.title")} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, centered, { paddingBottom: myRsvp ? spacing.xl : 128 }]}
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
            value={addressVisible ? address ?? dinner.area : t("dinner.addressHidden", { area: dinner.area })}
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

        {potluckItems.length > 0 && (
          <PotluckSection
            items={potluckItems}
            myProfileId={profile?.id}
            canClaim={canClaimPotluck}
            onClaim={handleClaim}
            onCancel={handleCancelClaim}
          />
        )}

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
          <View style={[styles.footerInner, centered]}>
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
        </View>
      ) : null}
      <SuccessOverlay
        visible={!!successMessage}
        message={successMessage ?? ""}
        onHide={() => setSuccessMessage(null)}
      />
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

function PotluckSection({
  items,
  myProfileId,
  canClaim,
  onClaim,
  onCancel,
}: {
  items: PotluckItem[];
  myProfileId: string | undefined;
  canClaim: boolean;
  onClaim: (item: PotluckItem, quantity: number, amount: number | null, note: string) => Promise<void>;
  onCancel: (item: PotluckItem) => Promise<void>;
}) {
  return (
    <View style={styles.potluckSection}>
      <Text style={styles.potluckTitle}>{t("dinner.potluck.title")}</Text>
      <Text style={styles.potluckIntro}>{t("dinner.potluck.intro")}</Text>
      <Card style={styles.potluckCard} padded={false}>
        {items.map((item, i) => (
          <View key={item.id}>
            {i > 0 ? <Divider /> : null}
            <PotluckItemRow item={item} myProfileId={myProfileId} canClaim={canClaim} onClaim={onClaim} onCancel={onCancel} />
          </View>
        ))}
      </Card>
      <Text style={styles.potluckNoPressure}>{t("dinner.potluck.noPressure")}</Text>
    </View>
  );
}

function PotluckItemRow({
  item,
  myProfileId,
  canClaim,
  onClaim,
  onCancel,
}: {
  item: PotluckItem;
  myProfileId: string | undefined;
  canClaim: boolean;
  onClaim: (item: PotluckItem, quantity: number, amount: number | null, note: string) => Promise<void>;
  onCancel: (item: PotluckItem) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState(item.moneyAmount ? String(item.moneyAmount) : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const myClaim = findMyClaim(item, myProfileId);
  const fulfilled = isItemFulfilled(item);
  const progress = item.isMoneyRequest
    ? t("dinner.potluck.pledged", { amount: pledgedAmount(item) })
    : t("dinner.potluck.claimedOf", { claimed: claimedQuantity(item), needed: item.quantityNeeded });

  async function submit() {
    setSubmitting(true);
    try {
      await onClaim(item, item.isMoneyRequest ? 1 : Math.max(1, Number(quantity) || 1), item.isMoneyRequest ? Number(amount) || 0 : null, note);
      setExpanded(false);
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.potluckRow}>
      <View style={styles.potluckRowHeader}>
        <View style={styles.potluckRowText}>
          <Text style={styles.potluckItemName}>{item.name}</Text>
          <Text style={styles.potluckItemProgress}>{progress}</Text>
          {item.notes ? <Text style={styles.potluckItemNotes}>{item.notes}</Text> : null}
        </View>
        {!item.isMoneyRequest && fulfilled && !myClaim ? (
          <Badge label={t("dinner.potluck.covered")} tone="success" />
        ) : null}
      </View>

      {myClaim ? (
        <View style={styles.potluckClaimedRow}>
          <Text style={styles.potluckClaimedText}>
            {item.isMoneyRequest
              ? t("dinner.potluck.youreChippingIn", { amount: myClaim.contributionAmount ?? 0 })
              : t("dinner.potluck.youreBringing", { qty: myClaim.quantity })}
          </Text>
          <Button
            label={t("dinner.potluck.cancelClaim")}
            variant="ghost"
            size="sm"
            haptic={false}
            onPress={() => onCancel(item)}
          />
        </View>
      ) : canClaim && !expanded ? (
        <Button
          label={item.isMoneyRequest ? t("dinner.potluck.chipIn") : t("dinner.potluck.bring")}
          variant="secondary"
          size="sm"
          onPress={() => setExpanded(true)}
          style={styles.potluckClaimBtn}
        />
      ) : canClaim && expanded ? (
        <View style={styles.potluckForm}>
          {item.isMoneyRequest ? (
            <TextField
              label={t("dinner.potluck.amountLabel")}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
            />
          ) : (
            <TextField
              label={t("dinner.potluck.quantityLabel")}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
          )}
          <TextField label={t("dinner.potluck.noteLabel")} value={note} onChangeText={setNote} />
          <View style={styles.potluckFormActions}>
            <Button
              label={t("dinner.potluck.cancelClaim")}
              variant="secondary"
              size="sm"
              onPress={() => setExpanded(false)}
              style={styles.potluckFormBtn}
            />
            <Button
              label={t("dinner.potluck.confirm")}
              size="sm"
              onPress={submit}
              loading={submitting}
              style={styles.potluckFormBtn}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.potluckNeedsApproval}>{t("dinner.potluck.needsApproval")}</Text>
      )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInner: { flexDirection: "row", alignItems: "center" },
  footerPrice: { marginEnd: spacing.md },
  footerPriceValue: { ...typography.h3, color: colors.textPrimary },
  footerPriceUnit: { ...typography.caption, color: colors.textSecondary },
  footerCta: { flex: 1 },
  potluckSection: { marginBottom: spacing.md },
  potluckTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  potluckIntro: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  potluckCard: { paddingVertical: spacing.xs },
  potluckRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  potluckRowHeader: { flexDirection: "row", alignItems: "flex-start" },
  potluckRowText: { flex: 1 },
  potluckItemName: { ...typography.bodyBold, color: colors.textPrimary },
  potluckItemProgress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  potluckItemNotes: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontStyle: "italic" },
  potluckClaimedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  potluckClaimedText: { ...typography.bodyBold, color: colors.success, flex: 1 },
  potluckClaimBtn: { alignSelf: "flex-start", marginTop: spacing.sm },
  potluckForm: { marginTop: spacing.sm },
  potluckFormActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  potluckFormBtn: { flex: 1 },
  potluckNeedsApproval: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  potluckNoPressure: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" },
});
