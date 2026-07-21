import React, { useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { DINNER_TYPE_TAGS, KOSHER_LEVELS } from "@/constants/options";
import { createDinner } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { ApprovalMode, KosherLevel } from "@/types/database";

function nextFriday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function CreateDinner() {
  const { profile } = useAuth();
  const [date, setDate] = useState(nextFriday());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startTime, setStartTime] = useState("19:30");
  const [capacity, setCapacity] = useState("6");
  const [area, setArea] = useState("");
  const [exactAddress, setExactAddress] = useState("");
  const [kosherLevel, setKosherLevel] = useState<KosherLevel | null>(null);
  const [isFree, setIsFree] = useState(true);
  const [costPerHead, setCostPerHead] = useState("");
  const [description, setDescription] = useState("");
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("host_approves");
  const [seekingSponsorship, setSeekingSponsorship] = useState(false);
  const [budgetNeeded, setBudgetNeeded] = useState("");
  const [dinnerTypeTags, setDinnerTypeTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    area.trim().length > 0 &&
    exactAddress.trim().length > 0 &&
    kosherLevel !== null &&
    description.trim().length > 0 &&
    Number(capacity) > 0 &&
    (isFree || Number(costPerHead) > 0) &&
    (!seekingSponsorship || Number(budgetNeeded) > 0);

  function toggleTag(tag: string) {
    setDinnerTypeTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (!profile || !kosherLevel) return;
    setSubmitting(true);
    try {
      await createDinner({
        hostId: profile.id,
        date: date.toISOString().slice(0, 10),
        startTime,
        capacity: Number(capacity),
        area,
        exactAddress,
        kosherLevel,
        costPerHead: isFree ? 0 : Number(costPerHead),
        isFree,
        description,
        approvalMode,
        budgetNeeded: seekingSponsorship ? Number(budgetNeeded) : null,
        seekingSponsorship,
        dinnerTypeTags,
      });
      router.replace("/(tabs)/my-dinners");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Header title="Host a Shabbat" />

      <Text style={styles.label}>Date</Text>
      <Button
        label={date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        variant="secondary"
        onPress={() => setShowDatePicker(true)}
      />
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selected) setDate(selected);
          }}
        />
      )}

      <View style={{ marginTop: spacing.md }}>
        <TextField label="Start time" value={startTime} onChangeText={setStartTime} placeholder="19:30" />
        <TextField label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
        <TextField label="Neighborhood / area" value={area} onChangeText={setArea} placeholder="Florentin, Tel Aviv" />
        <TextField
          label="Exact address"
          value={exactAddress}
          onChangeText={setExactAddress}
          placeholder="12 Herzl St, Apt 4"
          helperText="Only shown to confirmed guests, and only starting 24h before the dinner."
        />
      </View>

      <Text style={styles.label}>Kosher level</Text>
      <View style={styles.chipRow}>
        {KOSHER_LEVELS.map((k) => (
          <Chip key={k.value} label={k.label} selected={kosherLevel === k.value} onPress={() => setKosherLevel(k.value)} />
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Free for guests</Text>
        <Switch value={isFree} onValueChange={setIsFree} trackColor={{ true: colors.brand }} />
      </View>
      {!isFree && (
        <TextField
          label="Cost per head (₪)"
          value={costPerHead}
          onChangeText={setCostPerHead}
          keyboardType="number-pad"
          placeholder="60"
        />
      )}

      <TextField
        label="Describe the vibe"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ minHeight: 90, textAlignVertical: "top" }}
        placeholder="Laid-back Shabbat with homemade challah..."
      />

      <Text style={styles.label}>How should RSVPs work?</Text>
      <View style={styles.chipRow}>
        <Chip label="Auto-accept" selected={approvalMode === "auto_accept"} onPress={() => setApprovalMode("auto_accept")} />
        <Chip label="I'll approve each guest" selected={approvalMode === "host_approves"} onPress={() => setApprovalMode("host_approves")} />
      </View>

      <Text style={styles.label}>What kind of table is this?</Text>
      <View style={styles.chipRow}>
        {DINNER_TYPE_TAGS.map((tag) => (
          <Chip key={tag} label={tag} selected={dinnerTypeTags.includes(tag)} onPress={() => toggleTag(tag)} />
        ))}
      </View>

      <View style={styles.sponsorBlock}>
        <View style={styles.row}>
          <Text style={styles.label}>Seeking sponsorship?</Text>
          <Switch
            value={seekingSponsorship}
            onValueChange={setSeekingSponsorship}
            trackColor={{ true: colors.brand }}
          />
        </View>
        <Text style={styles.sponsorHelp}>
          Fund this dinner's budget with a donation from a sponsor. A dinner enters the donor feed
          once it's reviewed and approved.
        </Text>
        {seekingSponsorship ? (
          <Reveal>
            <TextField
              label="Budget needed (₪)"
              value={budgetNeeded}
              onChangeText={setBudgetNeeded}
              keyboardType="number-pad"
              placeholder="450"
              style={{ marginTop: spacing.sm }}
            />
          </Reveal>
        ) : null}
      </View>

      <Button label="Publish dinner" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  sponsorBlock: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sponsorHelp: { ...typography.caption, color: colors.textSecondary },
});
