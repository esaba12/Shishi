import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/ui/Chip";
import { colors, spacing, typography } from "@/constants/theme";
import { upcomingFridays } from "@/lib/fridays";

interface FridayPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  /** How many upcoming Fridays to offer. Defaults to ~4 months out. */
  count?: number;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** Horizontal scroll of upcoming Friday chips — see lib/fridays.ts for why this replaces a general
 *  calendar picker for dinner creation. */
export function FridayPicker({ value, onChange, count = 16 }: FridayPickerProps) {
  const fridays = upcomingFridays(count);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {fridays.map((date) => (
          <Chip
            key={date.toISOString()}
            label={date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            selected={sameDay(date, value)}
            onPress={() => onChange(date)}
          />
        ))}
      </ScrollView>
      <Text style={styles.hint}>
        Selected: {value.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
