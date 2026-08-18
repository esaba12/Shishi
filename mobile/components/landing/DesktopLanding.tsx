import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { GrainOverlay } from "@/components/landing/GrainOverlay";
import { colors, fonts, spacing, typography } from "@/constants/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { Role } from "@/types";

const FLOW: {
  role: Role;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}[] = [
  { role: "sponsor", icon: "heart-outline", title: "Sponsor", description: "Commits the budget a dinner needs." },
  { role: "host", icon: "home-outline", title: "Host", description: "Opens their table for six." },
  { role: "attendee", icon: "restaurant-outline", title: "Attendee", description: "Takes the last seat." },
];

// Encodes the actual money/action sequence from the product bible (§4) — not decorative.
const CONNECTORS = ["commits ₪300", "seats six strangers"];

const MISSION =
  "Shabbat used to be the thing that pulled people together. For a transplant eating alone in Tel " +
  "Aviv on a Friday night, it's often the thing that reminds them they're not. Shishi exists to flip " +
  "that back — one table at a time.";

/** Desktop-only entry point (≥900px) — the mobile welcome screen (bare wordmark + two buttons) stays
 *  the fallback below that width. A full scrolling page rather than a single fixed hero: the hero
 *  makes the first impression with the candlelight gradient panel, then the page earns the "fund
 *  this" pitch with the actual three-sided flow, the OneTable precedent, and the mission, before
 *  closing on a second CTA. */
export function DesktopLanding({
  onGetStarted,
  onLogIn,
  onDemo,
}: {
  onGetStarted: (role?: Role) => void;
  onLogIn?: () => void;
  onDemo?: () => void;
}) {
  return (
    <View style={styles.page}>
      <View style={styles.heroRow}>
        <View style={styles.left}>
          <Reveal style={styles.logoRow}>
            <Logo size={30} />
          </Reveal>
          <Reveal delay={30}>
            <Text style={styles.eyebrow}>FRIDAY NIGHT, TEL AVIV · שישי</Text>
          </Reveal>
          <Reveal delay={60}>
            <Text style={styles.headline}>A seat at the table for every Jew who wants one.</Text>
          </Reveal>
          <Reveal delay={120}>
            <Text style={styles.subtitle}>
              Shishi funds and fills Friday-night dinners across Tel Aviv — sponsors cover the cost,
              hosts open their homes, and anyone looking for a table finds one.
            </Text>
          </Reveal>
          <Reveal delay={180}>
            <View style={styles.actions}>
              <Button label="Get started" onPress={() => onGetStarted()} size="lg" />
              {onLogIn ? <Button label="Log in" variant="secondary" size="lg" onPress={onLogIn} /> : null}
              {onDemo ? <Button label="Continue as demo user" variant="ghost" onPress={onDemo} /> : null}
            </View>
          </Reveal>
        </View>

        <View style={styles.right}>
          <LinearGradient colors={[colors.brandDark, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <GrainOverlay style={StyleSheet.absoluteFill} />
          <Glow style={[styles.glow, styles.glowOne]} driftX={14} driftY={-10} driftScale={1.05} duration={8000} />
          <Glow style={[styles.glow, styles.glowTwo]} driftX={-10} driftY={12} driftScale={1.06} duration={6500} delay={200} />
          <Glow style={[styles.glow, styles.glowThree]} driftX={8} driftY={8} driftScale={1.08} duration={9000} delay={400} />
          <LogoMark size={72} style={styles.watermark} />
        </View>
      </View>

      <Section bg={colors.bg}>
        <Text style={styles.sectionEyebrow}>HOW IT WORKS</Text>
        <Text style={styles.sectionTitle}>Three roles, one table.</Text>
        <View style={styles.flowRow}>
          {FLOW.map((stop, i) => (
            <React.Fragment key={stop.role}>
              <Pressable style={styles.flowStop} onPress={() => onGetStarted(stop.role)}>
                <View style={styles.flowMedallion}>
                  <Ionicons name={stop.icon} size={22} color={colors.brand} />
                </View>
                <Text style={styles.flowTitle}>{stop.title}</Text>
                <Text style={styles.flowDescription}>{stop.description}</Text>
              </Pressable>
              {i < FLOW.length - 1 ? (
                <View style={styles.flowConnector}>
                  <Text style={styles.flowConnectorLabel}>{CONNECTORS[i]}</Text>
                  <View style={styles.flowLineRow}>
                    <View style={styles.flowLine} />
                    <Ionicons name="chevron-forward" size={14} color={colors.brand} />
                    <View style={styles.flowLine} />
                  </View>
                </View>
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </Section>

      <Section bg={colors.surfaceElevated} bordered>
        <View style={styles.proofRow}>
          <View style={styles.proofCol}>
            <Text style={styles.sectionEyebrow}>THE PRECEDENT</Text>
            <Text style={styles.proofText}>
              OneTable has spent a decade proving this model in the U.S. and Toronto — subsidizing
              young-adult Shabbat dinners with per-guest host stipends. It has never operated in
              Israel.
            </Text>
          </View>
          <View style={styles.proofDivider} />
          <View style={styles.proofCol}>
            <Text style={[styles.sectionEyebrow, styles.sectionEyebrowBrand]}>WHAT SHISHI ADDS</Text>
            <Text style={styles.proofText}>
              A donor-facing feed where sponsors pick the exact dinner, host, and Friday they're
              funding — built Tel-Aviv-native from day one.
            </Text>
          </View>
        </View>
      </Section>

      <View style={styles.missionBand}>
        <View style={styles.missionIcon}>
          <Ionicons name="flame" size={20} color={colors.brand} />
        </View>
        <Text style={styles.missionEyebrow}>WHY WE EXIST</Text>
        <Text style={styles.missionQuote}>{MISSION}</Text>
      </View>

      <Section bg={colors.bg}>
        <View style={styles.ctaWrap}>
          <Text style={styles.ctaTitle}>Open a seat this Friday.</Text>
          <View style={styles.actions}>
            <Button label="Get started" onPress={() => onGetStarted()} size="lg" />
            {onLogIn ? <Button label="Log in" variant="secondary" size="lg" onPress={onLogIn} /> : null}
          </View>
        </View>
      </Section>

      <View style={styles.footer}>
        <LogoMark size={22} />
        <Text style={styles.footerText}>Shishi — שישי, Hebrew for Friday, the night it all begins.</Text>
      </View>
    </View>
  );
}

function Section({
  children,
  bg,
  bordered,
}: {
  children: React.ReactNode;
  bg: string;
  bordered?: boolean;
}) {
  return (
    <View style={[styles.section, { backgroundColor: bg }, bordered && styles.sectionBordered]}>
      <View style={styles.sectionInner}>{children}</View>
    </View>
  );
}

// Ambient drift for the hero's "candlelight" glow circles — a slow, looping translate+scale
// oscillation, staggered per-glow (different durations/delays) so they don't move in lockstep.
// Reduced motion keeps the fade-in entrance but skips the loop entirely (static glow).
function Glow({
  style,
  driftX,
  driftY,
  driftScale,
  duration,
  delay = 0,
}: {
  style: StyleProp<ViewStyle>;
  driftX: number;
  driftY: number;
  driftScale: number;
  duration: number;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <MotiView
        pointerEvents="none"
        style={style}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 300 }}
      />
    );
  }

  return (
    <MotiView
      pointerEvents="none"
      style={style}
      from={{ opacity: 0, translateX: 0, translateY: 0, scale: 1 }}
      animate={{ opacity: 1, translateX: driftX, translateY: driftY, scale: driftScale }}
      transition={{
        opacity: { type: "timing", duration: 500, delay },
        translateX: { type: "timing", duration, delay: 500 + delay, loop: true },
        translateY: { type: "timing", duration: duration * 0.9, delay: 500 + delay, loop: true },
        scale: { type: "timing", duration: duration * 1.1, delay: 500 + delay, loop: true },
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { width: "100%" },

  // --- Hero ------------------------------------------------------------------
  heroRow: { flexDirection: "row", width: "100%", minHeight: 560 },
  left: {
    flex: 1,
    maxWidth: 620,
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  logoRow: { marginBottom: spacing.xl },
  eyebrow: { ...typography.label, color: colors.brand, letterSpacing: 1.5, marginBottom: spacing.md },
  headline: {
    fontFamily: fonts.displayBlack,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.textSecondary, marginBottom: spacing.lg, maxWidth: 480 },
  actions: { flexDirection: "row", gap: spacing.md, alignItems: "center", flexWrap: "wrap" },

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

  // --- Sections ----------------------------------------------------------------
  section: { width: "100%", paddingVertical: spacing.xxl },
  sectionBordered: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  sectionInner: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: spacing.xl },
  sectionEyebrow: { ...typography.label, color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.sm },
  sectionEyebrowBrand: { color: colors.brand },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.3 },

  // --- How it works flow ---------------------------------------------------------
  flowRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.xl },
  flowStop: { width: 150, alignItems: "center" },
  flowMedallion: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  flowTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.textPrimary, marginBottom: 4 },
  flowDescription: { ...typography.caption, color: colors.textSecondary, textAlign: "center", maxWidth: 140 },
  flowConnector: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm, marginTop: 16 },
  flowConnectorLabel: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginBottom: 8, textAlign: "center" },
  flowLineRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  flowLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // --- Proof band ------------------------------------------------------------
  proofRow: { flexDirection: "row", alignItems: "flex-start" },
  proofCol: { flex: 1 },
  proofDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: spacing.xl },
  proofText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 24 },

  // --- Mission band ------------------------------------------------------------
  missionBand: {
    width: "100%",
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.xxl + 16,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(225,29,72,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  missionEyebrow: { ...typography.label, color: colors.brand, letterSpacing: 1.5, marginBottom: spacing.md, textAlign: "center" },
  missionQuote: {
    fontFamily: fonts.displayMedium,
    fontSize: 30,
    lineHeight: 40,
    color: colors.textInverse,
    textAlign: "center",
    maxWidth: 720,
  },

  // --- Final CTA / footer ------------------------------------------------------
  ctaWrap: { alignItems: "center" },
  ctaTitle: { fontFamily: fonts.displayBlack, fontSize: 38, color: colors.textPrimary, marginBottom: spacing.lg, textAlign: "center", letterSpacing: -0.5 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { ...typography.caption, color: colors.textSecondary },
});
