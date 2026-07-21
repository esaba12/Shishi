import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/brand/Logo";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { Role } from "@/types";

const ROLE_TEASERS: {
  role: Role;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}[] = [
  { role: "attendee", icon: "restaurant-outline", title: "Find a table", description: "Discover a warm Shabbat dinner near you and RSVP in minutes." },
  { role: "host", icon: "home-outline", title: "Open your home", description: "Host a dinner, set your own budget, and let us handle the rest." },
  { role: "sponsor", icon: "heart-outline", title: "Fund a dinner", description: "Cover a host's budget directly and see the table it makes possible." },
];

/** Desktop-only entry point (≥900px) — the mobile welcome screen (bare wordmark + two buttons) stays
 *  the fallback below that width. This is the highest-leverage screen for the editorial-warmth
 *  direction: it's the first thing a desktop visitor sees, so it gets the asymmetric hero treatment
 *  the rest of the app's motion language (Reveal/SelectCard) was building toward. No photography is
 *  available yet, so the right column is a generative "candlelight" visual built from the existing
 *  brand system (gradient + soft glow layers + the ש mark) rather than a placeholder image. */
export function DesktopLanding({
  onGetStarted,
  onDemo,
}: {
  onGetStarted: (role?: Role) => void;
  onDemo?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Reveal>
          <Text style={styles.eyebrow}>SHABBAT DINNERS · TEL AVIV</Text>
        </Reveal>
        <Reveal delay={60}>
          <Text style={styles.headline}>A seat at the table for every Jew who wants one.</Text>
        </Reveal>
        <Reveal delay={120}>
          <Text style={styles.subtitle}>
            Shishi connects sponsors who fund Friday-night dinners, hosts who open their homes, and
            people looking for a warm table to belong to — in Tel Aviv, starting now.
          </Text>
        </Reveal>
        <Reveal delay={180}>
          <View style={styles.actions}>
            <Button label="Get started" onPress={onGetStarted} size="lg" />
            {onDemo ? <Button label="Continue as demo user" variant="ghost" onPress={onDemo} /> : null}
          </View>
        </Reveal>

        <View style={styles.teaserGrid}>
          {ROLE_TEASERS.map((role, i) => (
            <Reveal key={role.title} delay={240 + i * 70} style={styles.teaserWrap}>
              <Pressable style={styles.teaser} onPress={() => onGetStarted(role.role)}>
                <View style={styles.teaserIcon}>
                  <Ionicons name={role.icon} size={20} color={colors.brand} />
                </View>
                <Text style={styles.teaserTitle}>{role.title}</Text>
                <Text style={styles.teaserDescription}>{role.description}</Text>
              </Pressable>
            </Reveal>
          ))}
        </View>
      </View>

      <View style={styles.right}>
        <LinearGradient colors={[colors.brandDark, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.glow, styles.glowOne]} />
        <View style={[styles.glow, styles.glowTwo]} />
        <View style={[styles.glow, styles.glowThree]} />
        <LogoMark size={72} style={styles.watermark} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  left: {
    flex: 1,
    maxWidth: 620,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  eyebrow: { ...typography.label, color: colors.brand, letterSpacing: 1.5, marginBottom: spacing.md },
  headline: { ...typography.display, fontSize: 48, lineHeight: 54, color: colors.textPrimary, marginBottom: spacing.md },
  subtitle: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.textSecondary, marginBottom: spacing.lg, maxWidth: 480 },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xxl, alignItems: "center" },
  teaserGrid: { flexDirection: "row", gap: spacing.md },
  teaserWrap: { flex: 1 },
  teaser: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    height: "100%",
  },
  teaserIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  teaserTitle: { ...typography.h3, fontSize: 16, color: colors.textPrimary, marginBottom: 4 },
  teaserDescription: { ...typography.caption, color: colors.textSecondary },
  right: {
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  glowOne: { width: 420, height: 420, top: -120, start: -80 },
  glowTwo: { width: 280, height: 280, bottom: -60, end: -40, backgroundColor: "rgba(255,255,255,0.1)" },
  glowThree: { width: 180, height: 180, top: "38%", start: "55%", backgroundColor: "rgba(255,255,255,0.12)" },
  watermark: { opacity: 0.9 },
});
