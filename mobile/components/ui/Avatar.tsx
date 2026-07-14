import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors, fonts } from "@/constants/theme";

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

/** Circular host/guest avatar. Shows the photo (cached via expo-image) or a brand-tinted monogram
 *  fallback. Extracted from the duplicated avatar blocks in DinnerCard + Dinner detail. */
export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={dimension}
        contentFit="cover"
        transition={200}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.onBrand,
    fontFamily: fonts.displayBold,
  },
});
