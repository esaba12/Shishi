import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fonts, radii, spacing } from "@/constants/theme";

/** The Shishi mark: a rose-red rounded square holding a serif Hebrew "ש" (shin) — Shishi (שישי,
 *  "Friday", the day Shabbat begins) starts with shin. Built from Views + type so it stays crisp at
 *  any size with no SVG/raster dependency. Reused for the app icon source. */
export function LogoMark({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.3 },
        style,
      ]}
    >
      <Text style={[styles.shin, { fontSize: size * 0.62, lineHeight: size * 0.86 }]}>ש</Text>
    </View>
  );
}

/** Full horizontal lockup: mark + "Shishi" wordmark in the display serif. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.lockup}>
      <LogoMark size={size} />
      <Text style={[styles.wordmark, { fontSize: size * 0.82 }]}>Shishi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  shin: {
    color: colors.onBrand,
    fontFamily: fonts.displayBold,
    textAlign: "center",
  },
  lockup: { flexDirection: "row", alignItems: "center" },
  wordmark: {
    fontFamily: fonts.displayBlack,
    color: colors.brandDark,
    marginStart: spacing.sm,
    letterSpacing: -0.5,
  },
});
