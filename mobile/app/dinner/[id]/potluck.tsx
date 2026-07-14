import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { POTLUCK_CATEGORIES } from "@/constants/options";
import { claimedQuantity, pledgedAmount } from "@/lib/potluck";
import { createPotluckItem, deletePotluckItem, fetchPotluckItems } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import type { PotluckCategory } from "@/types/database";
import type { PotluckItem } from "@/types";

const CATEGORY_ICON: Record<PotluckCategory, keyof typeof Ionicons.glyphMap> = {
  food: "restaurant-outline",
  drink: "wine-outline",
  supplies: "basket-outline",
  money: "cash-outline",
  other: "ellipsis-horizontal-circle-outline",
};

/** Host-only screen: manage the potluck checklist for a dinner (add/remove items, see who has
 *  claimed what). Kept separate from the attendee-facing view in dinner/[id]/index.tsx — hosts
 *  edit the list, attendees only ever sign up against it. */
export default function PotluckManage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { show } = useToast();
  const [items, setItems] = useState<PotluckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PotluckCategory>("food");
  const [quantityNeeded, setQuantityNeeded] = useState("1");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPotluckItems(id));
    } catch {
      show("Couldn't load the checklist.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, show]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setName("");
    setCategory("food");
    setQuantityNeeded("1");
    setMoneyAmount("");
    setNotes("");
    setAdding(false);
  }

  const isMoney = category === "money";
  const canSubmit = name.trim().length > 0 && (isMoney ? Number(moneyAmount) > 0 : Number(quantityNeeded) > 0);

  async function handleAdd() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createPotluckItem({
        dinnerId: id,
        name: name.trim(),
        category,
        quantityNeeded: isMoney ? 1 : Number(quantityNeeded),
        isMoneyRequest: isMoney,
        moneyAmount: isMoney ? Number(moneyAmount) : null,
        notes: notes.trim() || null,
      });
      resetForm();
      await load();
      show("Added to the checklist.", "success");
    } catch {
      show("Couldn't add that item. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(itemId: string) {
    try {
      await deletePotluckItem(itemId, id);
      await load();
    } catch {
      show("Couldn't remove that item.", "error");
    }
  }

  return (
    <Screen>
      <Header title="Potluck checklist" />

      {!isSupabaseConfigured && (
        <Text style={styles.hint}>
          Demo mode: this checklist lives in memory only until this dinner is connected to a real
          Supabase project.
        </Text>
      )}

      <Text style={styles.intro}>
        List what this dinner still needs — food, drinks, supplies — or ask guests to chip in cash
        instead of bringing something. Guests can sign up once you approve their seat.
      </Text>

      {adding ? (
        <Card style={styles.formCard}>
          <TextField
            label="What do you need?"
            value={name}
            onChangeText={setName}
            placeholder={isMoney ? "Flowers & candles" : "Bottles of wine"}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {POTLUCK_CATEGORIES.map((c) => (
              <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
            ))}
          </View>

          {isMoney ? (
            <TextField
              label="Suggested amount (₪)"
              value={moneyAmount}
              onChangeText={setMoneyAmount}
              keyboardType="number-pad"
              placeholder="80"
              helperText="Guests can pledge any amount toward this — there's no cap."
            />
          ) : (
            <TextField
              label="How many do you need?"
              value={quantityNeeded}
              onChangeText={setQuantityNeeded}
              keyboardType="number-pad"
              placeholder="2"
            />
          )}

          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Red or white, whatever you like"
          />

          <View style={styles.formActions}>
            <Button label="Cancel" variant="secondary" onPress={resetForm} style={styles.formBtn} />
            <Button label="Add to checklist" onPress={handleAdd} disabled={!canSubmit} loading={submitting} style={styles.formBtn} />
          </View>
        </Card>
      ) : (
        <Button label="+ Add an item" variant="secondary" onPress={() => setAdding(true)} style={styles.addBtn} />
      )}

      <Text style={styles.sectionTitle}>Checklist ({items.length})</Text>
      {!loading && items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="Nothing on the list yet"
          description="Add the first thing you need for this Shabbat."
        />
      ) : (
        items.map((item) => <ItemRow key={item.id} item={item} onDelete={() => handleDelete(item.id)} />)
      )}
    </Screen>
  );
}

function ItemRow({ item, onDelete }: { item: PotluckItem; onDelete: () => void }) {
  const claimed = claimedQuantity(item);
  const pledged = pledgedAmount(item);
  const progress = item.isMoneyRequest
    ? `₪${pledged} pledged so far${item.moneyAmount ? ` · suggested ₪${item.moneyAmount}` : ""}`
    : `${claimed} of ${item.quantityNeeded} claimed`;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemIcon}>
          <Ionicons name={CATEGORY_ICON[item.category]} size={16} color={colors.brand} />
        </View>
        <View style={styles.itemHeaderText}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemProgress}>{progress}</Text>
        </View>
        <Badge
          label={item.isMoneyRequest ? "Money" : claimed >= item.quantityNeeded ? "Covered" : "Needed"}
          tone={item.isMoneyRequest ? "accent" : claimed >= item.quantityNeeded ? "success" : "brand"}
          style={styles.badge}
        />
        <Pressable onPress={onDelete} hitSlop={10} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}

      {item.claims.length === 0 ? (
        <Text style={styles.noClaims}>No one has signed up yet.</Text>
      ) : (
        item.claims.map((claim) => (
          <View key={claim.id} style={styles.claimRow}>
            <Text style={styles.claimName}>{claim.attendeeName}</Text>
            <Text style={styles.claimAmount}>
              {item.isMoneyRequest ? `₪${claim.contributionAmount ?? 0}` : `x${claim.quantity}`}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.accent, marginBottom: spacing.md },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  addBtn: { marginBottom: spacing.lg },
  formCard: { marginBottom: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  formBtn: { flex: 1 },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  itemCard: { marginBottom: spacing.sm },
  itemHeader: { flexDirection: "row", alignItems: "center" },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing.sm,
  },
  itemHeaderText: { flex: 1 },
  itemName: { ...typography.bodyBold, color: colors.textPrimary },
  itemProgress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badge: { marginEnd: spacing.sm },
  deleteBtn: { padding: spacing.xs },
  itemNotes: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  noClaims: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  claimRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  claimName: { ...typography.body, color: colors.textPrimary },
  claimAmount: { ...typography.bodyBold, color: colors.brand },
});
