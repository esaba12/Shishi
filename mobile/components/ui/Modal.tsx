import React from "react";
import { Modal as RNModal, Pressable, StyleSheet, View } from "react-native";
import { colors, radii, spacing, elevation } from "@/constants/theme";
import { Reveal } from "./Reveal";

interface ModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
}

/** Centered card overlay, backed by RN's cross-platform Modal (portals correctly on web via
 *  react-native-web). Used for the web checkout/donation card-entry forms — anywhere a flow needs to
 *  stay in the SPA rather than navigating to a new screen. */
export function Modal({ visible, onRequestClose, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Reveal style={styles.cardWrap}>
          <View style={[styles.card, elevation.overlay]}>{children}</View>
        </Reveal>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  cardWrap: { width: "100%", maxWidth: 420 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
});
