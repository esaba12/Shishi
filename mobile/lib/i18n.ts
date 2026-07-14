import { I18nManager } from "react-native";
import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import { en } from "./strings/en";
import { he } from "./strings/he";

// Single i18n instance for the app. Import this module for its side effects (locale + RTL setup)
// once, high in the tree (app/_layout.tsx), and use `t()` everywhere for user-facing copy.
export const i18n = new I18n({ en, he });
i18n.enableFallback = true;
i18n.defaultLocale = "en";

const SUPPORTED = ["en", "he"] as const;
const RTL_LOCALES = ["he"];

const deviceLocale = getLocales()[0]?.languageCode ?? "en";
i18n.locale = (SUPPORTED as readonly string[]).includes(deviceLocale) ? deviceLocale : "en";

export const isRTL = RTL_LOCALES.includes(i18n.locale);

// Let RN mirror layouts for RTL, and align the native direction with the active language.
// NOTE for QA: forceRTL only takes visual effect after a reload — in dev, save/refresh once; to test
// manually, call I18nManager.forceRTL(true) and reload. Logical layout props (marginStart/paddingEnd/
// textAlign:"left") throughout the new components ensure screens mirror correctly when it flips.
I18nManager.allowRTL(true);
if (isRTL !== I18nManager.isRTL) {
  I18nManager.forceRTL(isRTL);
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
