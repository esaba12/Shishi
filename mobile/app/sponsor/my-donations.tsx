import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radii, spacing, typography, elevation } from "@/constants/theme";
import { fetchDinner, fetchMyDonations } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Dinner, SponsorDonation } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const statusTone: Record<SponsorDonation["status"], "success" | "neutral" | "danger"> = {
  succeeded: "success",
  pending: "neutral",
  failed: "danger",
  refunded: "neutral",
};

export default function MyDonations() {
  const { profile } = useAuth();
  const [donations, setDonations] = useState<SponsorDonation[]>([]);
  const [dinners, setDinners] = useState<Record<string, Dinner>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchMyDonations(profile.id);
      setDonations(list);
      const uniqueDinnerIds = [...new Set(list.map((d) => d.dinnerId))];
      const fetched = await Promise.all(uniqueDinnerIds.map((id) => fetchDinner(id)));
      const map: Record<string, Dinner> = {};
      fetched.forEach((d) => {
        if (d) map[d.id] = d;
      });
      setDinners(map);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalGiven = donations.filter((d) => d.status === "succeeded").reduce((sum, d) => sum + d.amount, 0);

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.headerWrap}>
        <Header title="My donations" />
      </View>
      {!loading && donations.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.summaryValue}>₪{totalGiven}</Text>
          <Text style={styles.summaryLabel}>given across {donations.filter((d) => d.status === "succeeded").length} dinners</Text>
        </View>
      ) : null}
      <FlatList
        data={donations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => {
          const dinner = dinners[item.dinnerId];
          return (
            <View style={[styles.row, elevation.card]}>
              <View style={styles.rowMain}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{dinner ? `${dinner.hostName}'s Shabbat` : "Dinner"}</Text>
                  <Text style={styles.rowMeta}>
                    {dinner?.area ?? ""} · {formatDate(item.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>₪{item.amount}</Text>
                  <Badge label={item.status} tone={statusTone[item.status]} />
                </View>
              </View>
              {item.status === "succeeded" ? (
                <Button
                  label="Message host"
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: "/messages/[dinnerId]",
                      params: { dinnerId: item.dinnerId, with: item.hostId },
                    })
                  }
                  style={styles.messageBtn}
                />
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="heart-outline"
              title="No donations yet"
              description="Fund a dinner from the donor feed and it'll show up here."
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  summary: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brandSoft,
    borderRadius: radii.lg,
  },
  summaryValue: { ...typography.h1, color: colors.brandDark },
  summaryLabel: { ...typography.caption, color: colors.brandDark, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { flex: 1, marginEnd: spacing.md },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { ...typography.h3, color: colors.textPrimary },
  messageBtn: { alignSelf: "flex-start", marginTop: spacing.sm },
});
