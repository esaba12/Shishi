import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { colors, radii, spacing, typography } from "@/constants/theme";
const PRODUCT_TEASERS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}[] = [
  { icon: "business-outline", title: "Connect your organization", description: "Bring the planning files your team already uses." },
  { icon: "sparkles-outline", title: "See the signals", description: "Turn dense reports into clear, explainable findings." },
  { icon: "arrow-forward-circle-outline", title: "Act with confidence", description: "Leave every review with practical next steps." },
];

/** Desktop-only entry point (≥900px) — the mobile welcome screen (bare wordmark + two buttons) stays
 *  the fallback below that width. This is the highest-leverage screen for the editorial-warmth
 *  direction: it's the first thing a desktop visitor sees, so it gets the asymmetric hero treatment
 *  the rest of the app's motion language (Reveal/SelectCard) was building toward. No photography is
 *  available yet, so the right column is a generative "candlelight" visual built from the existing
 *  brand system (gradient + soft glow layers + the ש mark) rather than a placeholder image. */
export function DesktopLanding({
  onGetStarted,
  onLogIn,
  onDemo,
  onRequestJoin,
  onDocumentIntake,
}: {
  onGetStarted: () => void;
  onLogIn: () => void;
  onDemo: () => void;
  onRequestJoin: () => void;
  onDocumentIntake: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Reveal style={styles.logoRow}>
          <Logo size={30} />
        </Reveal>
        <Reveal delay={30}>
          <Text style={styles.eyebrow}>PLANNING SIGNALS · BUILT FOR TEAMS</Text>
        </Reveal>
        <Reveal delay={60}>
          <Text style={styles.headline}>Turn planning data into clear next steps.</Text>
        </Reveal>
        <Reveal delay={120}>
          <Text style={styles.subtitle}>
            Shishi helps institutional teams bring their data together, spot what needs attention,
            and move from a complicated review to a confident decision.
          </Text>
        </Reveal>
        <Reveal delay={180}>
          <View style={styles.actions}>
            <Button label="Create an account" onPress={onGetStarted} size="lg" />
            <Button label="Sign in" variant="secondary" size="lg" onPress={onLogIn} />
          </View>
        </Reveal>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>organizations exploring</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>3 min</Text>
            <Text style={styles.statLabel}>to a first review</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>signal types checked</Text>
          </View>
        </View>
        <Text style={styles.statNote}>Illustrative demo metrics</Text>

        <View style={styles.teaserGrid}>
          {PRODUCT_TEASERS.map((teaser, i) => (
            <Reveal key={teaser.title} delay={240 + i * 70} style={styles.teaserWrap}>
              <View style={styles.teaser}>
                <View style={styles.teaserIcon}>
                  <Ionicons name={teaser.icon} size={20} color={colors.brand} />
                </View>
                <Text style={styles.teaserTitle}>{teaser.title}</Text>
                <Text style={styles.teaserDescription}>{teaser.description}</Text>
              </View>
            </Reveal>
          ))}
        </View>

        <View style={styles.secondaryActions}>
          <Pressable onPress={onDemo} style={styles.linkAction}>
            <Ionicons name="flask-outline" size={16} color={colors.brand} />
            <Text style={styles.linkLabel}>Explore the UIUC demo</Text>
          </Pressable>
          <Pressable onPress={onDocumentIntake} style={styles.linkAction}>
            <Ionicons name="document-text-outline" size={16} color={colors.brand} />
            <Text style={styles.linkLabel}>What we need from you</Text>
          </Pressable>
          <Pressable onPress={onRequestJoin} style={styles.linkAction}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.brand} />
            <Text style={styles.linkLabel}>Request to join</Text>
          </Pressable>
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
  logoRow: { marginBottom: spacing.xl },
  eyebrow: { ...typography.label, color: colors.brand, letterSpacing: 1.5, marginBottom: spacing.md },
  headline: { ...typography.display, fontSize: 48, lineHeight: 54, color: colors.textPrimary, marginBottom: spacing.md },
  subtitle: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.textSecondary, marginBottom: spacing.lg, maxWidth: 480 },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xxl, alignItems: "center" },
  statRow: { flexDirection: "row", gap: spacing.xl, marginBottom: spacing.xxl },
  stat: { minWidth: 92 },
  statValue: { ...typography.h2, color: colors.textPrimary, marginBottom: 2 },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statNote: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.xl, marginBottom: spacing.lg },
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
  secondaryActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.xl },
  linkAction: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  linkLabel: { ...typography.caption, color: colors.brand },
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
