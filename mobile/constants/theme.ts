// Shishi design system.
// Brand direction: pink + red + white — warm, modern, a little celebratory (candles, the table).
// Tokens are semantic-first. Legacy keys (primary/background/text/…) are kept as aliases so every
// existing screen re-skins to the new palette for free; new/updated code should prefer the
// semantic roles (brand/bg/textPrimary/…).

// --- Font families ---------------------------------------------------------
// Loaded in app/_layout.tsx via useFonts. Frank Ruhl Libre (serif, strong Hebrew heritage) carries
// display/headings; Rubik (geometric sans, full Hebrew + Latin) carries body/UI. Both cover Hebrew,
// so the same type system works LTR and RTL.
export const fonts = {
  displayRegular: "FrankRuhlLibre_400Regular",
  displayMedium: "FrankRuhlLibre_500Medium",
  displayBold: "FrankRuhlLibre_700Bold",
  displayBlack: "FrankRuhlLibre_900Black",
  bodyRegular: "Rubik_400Regular",
  bodyMedium: "Rubik_500Medium",
  bodySemiBold: "Rubik_600SemiBold",
  bodyBold: "Rubik_700Bold",
} as const;

// --- Color -----------------------------------------------------------------
export const colors = {
  // Legacy aliases (do not remove while older screens still reference them).
  background: "#FFF7F9",
  surface: "#FFFFFF",
  primary: "#E11D48",
  primaryDark: "#9F1239",
  accent: "#FF4D8D",
  text: "#241419",
  textMuted: "#8A6B73",
  border: "#F3DCE3",
  success: "#15803D",
  danger: "#DC2626",
  disabled: "#E7D3D9",
  overlay: "rgba(36, 20, 25, 0.55)",

  // Semantic roles (prefer these going forward).
  bg: "#FFF7F9", // app background — a barely-there pink white
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#FFF0F4", // subtle pink fill for inset rows / disabled fields
  textPrimary: "#241419",
  textSecondary: "#8A6B73",
  textInverse: "#FFFFFF",
  brand: "#E11D48", // rose-red — the primary
  brandDark: "#9F1239",
  brandSoft: "#FFE1EA", // pink tint — badge/pressed backgrounds
  onBrand: "#FFFFFF",
  accentSoft: "#FFEAF2",
  successBg: "#E7F4EC",
  dangerBg: "#FCE8E8",
  info: "#E11D48",
  infoBg: "#FFE1EA",
} as const;

// --- Spacing / radii -------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// --- Elevation -------------------------------------------------------------
// Warm-tinted shadows so cards lift off the pink background without looking gray/muddy.
export const elevation = {
  card: {
    shadowColor: "#7A1533",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#7A1533",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  overlay: {
    shadowColor: "#3A0A1A",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

// --- Typography ------------------------------------------------------------
// With custom fontFamily the family carries the weight, so we don't set fontWeight here.
export const typography = {
  display: { fontFamily: fonts.displayBlack, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.bodySemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
} as const;
