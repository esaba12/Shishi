import React, { createContext, useContext, useMemo, useState } from "react";

export interface DemoTheme {
  id: string;
  name: string;
  description: string;
  brand: string;
  brandDark: string;
  brandSoft: string;
  accentSoft: string;
  onBrand: string;
}

export const DEMO_THEMES: DemoTheme[] = [
  { id: "rose", name: "Rose", description: "Shishi default", brand: "#E11D48", brandDark: "#9F1239", brandSoft: "#FFE1EA", accentSoft: "#FFEAF2", onBrand: "#FFFFFF" },
  { id: "indigo", name: "Indigo", description: "Academic blue", brand: "#4657A7", brandDark: "#2F3B78", brandSoft: "#E8EBFF", accentSoft: "#EEF0FF", onBrand: "#FFFFFF" },
  { id: "teal", name: "Teal", description: "Modern green-blue", brand: "#007F7B", brandDark: "#005B58", brandSoft: "#DDF6F4", accentSoft: "#E8FAF8", onBrand: "#FFFFFF" },
  { id: "gold", name: "Gold", description: "Warm institutional", brand: "#B7791F", brandDark: "#7A4D0D", brandSoft: "#FFF2CC", accentSoft: "#FFF7DE", onBrand: "#FFFFFF" },
];

interface DemoThemeContextValue {
  theme: DemoTheme;
  setTheme: (themeId: string) => void;
}

const DemoThemeContext = createContext<DemoThemeContextValue | null>(null);

export function DemoThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState(DEMO_THEMES[0].id);
  const theme = useMemo(
    () => DEMO_THEMES.find((candidate) => candidate.id === themeId) ?? DEMO_THEMES[0],
    [themeId],
  );
  const value = useMemo(() => ({ theme, setTheme: setThemeId }), [theme]);

  return <DemoThemeContext.Provider value={value}>{children}</DemoThemeContext.Provider>;
}

export function useDemoTheme() {
  const value = useContext(DemoThemeContext);
  if (!value) throw new Error("useDemoTheme must be used inside DemoThemeProvider");
  return value;
}
