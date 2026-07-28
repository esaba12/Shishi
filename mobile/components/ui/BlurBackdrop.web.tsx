import React from "react";

// react-native-web strips `backdropFilter`/`WebkitBackdropFilter` from a View's style before it
// reaches the DOM — confirmed live: expo-blur's own BlurView.web.tsx sets exactly these two
// properties, and they never make it into any compiled CSS rule. A raw <div> (a real DOM node,
// untouched by RNW's style-property allowlist) is the standard workaround.
export function BlurBackdrop() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    />
  );
}
