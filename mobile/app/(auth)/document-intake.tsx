import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, elevation, radii, spacing, typography } from "@/constants/theme";

type Document = { id: string; name: string; type: string; size: string };

const SAMPLE_DOCUMENTS: Document[] = [
  { id: "enrollment", name: "Enrollment history.csv", type: "Enrollment history", size: "248 KB" },
  { id: "catalog", name: "Course catalog.xlsx", type: "Catalog or schedule export", size: "1.2 MB" },
  { id: "planning", name: "Planning priorities.pdf", type: "Planning document", size: "860 KB" },
];

const FINDINGS = [
  { icon: "trending-up-outline" as const, category: "Demand gap", title: "Advanced sections are carrying the clearest growth signal.", detail: "Recent enrollment is rising faster in upper-level offerings than in the rest of the sample." },
  { icon: "alert-circle-outline" as const, category: "Constraint", title: "Two planning assumptions need a source before the next review.", detail: "Capacity and instructor availability are referenced, but not represented in the uploaded files." },
  { icon: "arrow-forward-outline" as const, category: "Next action", title: "Start the next review with a section-level capacity check.", detail: "That comparison will tell the team whether the demand signal requires a schedule change." },
];

export default function DocumentIntake() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showFindings, setShowFindings] = useState(false);

  const documentSummary = useMemo(() => {
    if (!documents.length) return "No documents added yet";
    return `${documents.length} document${documents.length === 1 ? "" : "s"} ready for a quick review`;
  }, [documents.length]);

  function addDocument(document: Document) {
    setDocuments((current) => current.some((item) => item.id === document.id) ? current : [...current, document]);
  }

  if (showFindings) {
    return (
      <Screen>
        <View style={styles.findingsHeader}>
          <View style={styles.findingsIcon}><Ionicons name="sparkles-outline" size={22} color={colors.onBrand} /></View>
          <View style={styles.findingsHeaderCopy}>
            <Text style={styles.eyebrow}>QUICK FINDINGS</Text>
            <Text style={styles.title}>Here&apos;s what stands out.</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>A prototype review based on {documents.length} sample document{documents.length === 1 ? "" : "s"}.</Text>
        <View style={styles.demoNotice}>
          <Ionicons name="flask-outline" size={18} color={colors.brand} />
          <Text style={styles.demoNoticeText}>Demo output: these findings illustrate the review experience and are not production analysis.</Text>
        </View>
        <View style={styles.findingsList}>
          {FINDINGS.map((finding) => (
            <View key={finding.category} style={styles.findingCard}>
              <View style={styles.findingIcon}><Ionicons name={finding.icon} size={20} color={colors.brand} /></View>
              <View style={styles.findingCopy}>
                <Text style={styles.findingCategory}>{finding.category}</Text>
                <Text style={styles.findingTitle}>{finding.title}</Text>
                <Text style={styles.findingDetail}>{finding.detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button label="Request a workspace" onPress={() => router.push("/(auth)/request-join")} />
        <Button label="Review different documents" variant="ghost" onPress={() => setShowFindings(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Ionicons name="document-text-outline" size={38} color={colors.brand} style={styles.icon} />
      <Text style={styles.eyebrow}>WHAT WE NEED FROM YOU</Text>
      <Text style={styles.title}>Bring the files you already have.</Text>
      <Text style={styles.subtitle}>
        Add a few planning documents and we&apos;ll show you the kind of quick, explainable findings Shishi can surface.
      </Text>

      <View style={styles.acceptedCard}>
        <Text style={styles.sectionTitle}>Useful starting points</Text>
        <Text style={styles.acceptedText}>Enrollment history, course catalog or schedule exports, and planning priorities.</Text>
      </View>

      <Pressable style={styles.uploadCard} onPress={() => addDocument(SAMPLE_DOCUMENTS[0])}>
        <View style={styles.uploadIcon}><Ionicons name="cloud-upload-outline" size={24} color={colors.brand} /></View>
        <View style={styles.uploadCopy}>
          <Text style={styles.uploadTitle}>Add a document</Text>
          <Text style={styles.uploadDescription}>Choose a sample file to preview the workflow.</Text>
        </View>
        <Ionicons name="add" size={22} color={colors.brand} />
      </Pressable>

      <Text style={styles.sectionTitle}>Or start with a sample</Text>
      <View style={styles.sampleList}>
        {SAMPLE_DOCUMENTS.map((document) => {
          const selected = documents.some((item) => item.id === document.id);
          return (
            <Pressable key={document.id} style={[styles.sampleRow, selected && styles.sampleRowSelected]} onPress={() => addDocument(document)}>
              <Ionicons name={selected ? "checkmark-circle" : "document-outline"} size={20} color={selected ? colors.success : colors.brand} />
              <View style={styles.sampleCopy}>
                <Text style={styles.sampleName}>{document.name}</Text>
                <Text style={styles.sampleMeta}>{document.type} · {document.size}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.summary}>{documentSummary}</Text>
      <Button label="Show quick findings" onPress={() => setShowFindings(true)} disabled={!documents.length} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.brand, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  acceptedCard: { backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  acceptedText: { ...typography.caption, color: colors.textSecondary },
  uploadCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg },
  uploadIcon: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  uploadCopy: { flex: 1 },
  uploadTitle: { ...typography.bodyBold, color: colors.textPrimary },
  uploadDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sampleList: { gap: spacing.sm, marginBottom: spacing.sm },
  sampleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  sampleRowSelected: { borderColor: colors.success, backgroundColor: colors.successBg },
  sampleCopy: { flex: 1 },
  sampleName: { ...typography.bodyBold, color: colors.textPrimary },
  sampleMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  summary: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  findingsHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  findingsIcon: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  findingsHeaderCopy: { flex: 1 },
  demoNotice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.infoBg, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  demoNoticeText: { ...typography.caption, color: colors.brandDark, flex: 1 },
  findingsList: { gap: spacing.md, marginBottom: spacing.lg },
  findingCard: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, ...elevation.card },
  findingIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  findingCopy: { flex: 1 },
  findingCategory: { ...typography.label, color: colors.brand, textTransform: "uppercase", marginBottom: spacing.xs },
  findingTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  findingDetail: { ...typography.caption, color: colors.textSecondary },
});
