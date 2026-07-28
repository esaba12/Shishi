import React from "react";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

// Native: expo-blur's real platform blur view. See BlurBackdrop.web.tsx for why web needs a
// different implementation.
export function BlurBackdrop() {
  return <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />;
}
