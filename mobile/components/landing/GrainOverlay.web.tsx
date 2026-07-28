import React from "react";
import { View, ViewStyle } from "react-native";

// A tiled SVG feTurbulence filter, encoded as a data URI — no binary asset needed. White noise at
// ~15% max alpha, modulated by the turbulence pattern (see the feColorMatrix alpha row).
const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>
  <filter id='n'>
    <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
    <feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.15 0'/>
  </filter>
  <rect width='100%' height='100%' filter='url(#n)'/>
</svg>`;

const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`;

interface GrainOverlayProps {
  style?: ViewStyle;
}

// Subtle grain texture for a large flat color field — the current "proof of a human touch" answer to
// generic-looking AI UI, applied to DesktopLanding's hero panel only (see that file).
export function GrainOverlay({ style }: GrainOverlayProps) {
  const webStyle = {
    backgroundImage: `url("${NOISE_DATA_URI}")`,
    backgroundRepeat: "repeat",
  } as unknown as ViewStyle;

  return <View pointerEvents="none" style={[style, webStyle]} />;
}
