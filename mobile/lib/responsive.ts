import { useWindowDimensions } from "react-native";

export interface Responsive {
  width: number;
  isTablet: boolean;
  isDesktop: boolean;
  /** Max content width so feeds/detail don't stretch edge-to-edge on wide screens. */
  contentMaxWidth: number;
}

// Breakpoints: mobile web < 600, tablet 600–899, desktop ≥ 900. Drives adaptive nav + capped content.
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const contentMaxWidth = isDesktop ? 720 : isTablet ? 600 : width;
  return { width, isTablet, isDesktop, contentMaxWidth };
}
