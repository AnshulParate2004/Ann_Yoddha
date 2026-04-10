import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Cloud, CloudOff, ListFilter, ScanLine } from "lucide-react-native";

import { getHistory, ScanResult } from "../database/sqlite";
import { palette, radius, spacing, text } from "../theme/tokens";
import { AppScreen, SectionHeading, StatusChip, SurfaceCard } from "../components/AppSurface";

type FilterMode = "all" | "healthy" | "detected" | "unsynced";

const filters: Array<{ key: FilterMode; label: string }> = [
  { key: "all", label: "All" },
  { key: "healthy", label: "Healthy" },
  { key: "detected", label: "Detected" },
  { key: "unsynced", label: "Unsynced" },
];

export default function History() {
  const [data, setData] = useState<ScanResult[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      getHistory().then(setData);
    }
  }, [isFocused]);

  const filteredData = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "healthy") return data.filter((item) => item.disease_name.toLowerCase() === "healthy");
    if (filter === "detected") {
      return data.filter((item) => {
        const disease = item.disease_name.toLowerCase();
        return disease !== "healthy" && disease !== "uncertain";
      });
    }
    return data.filter((item) => item.is_synced === 0);
  }, [data, filter]);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <SurfaceCard>
        <SectionHeading
          eyebrow="Local log"
          title="Diagnosis history"
          subtitle="A simplified mobile archive of captured scans and sync status."
        />

        <View style={styles.filterWrap}>
          <View style={styles.filterTitleRow}>
            <ListFilter color={palette.textSecondary} size={15} />
            <Text style={styles.filterTitle}>Filters</Text>
          </View>
          <View style={styles.filterButtons}>
            {filters.map((item) => {
              const active = filter === item.key;
              return (
                <TouchableOpacity key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterButton, active && styles.filterButtonActive]}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SurfaceCard>

      {filteredData.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <ScanLine color={palette.textMuted} size={42} />
          <Text style={styles.emptyTitle}>No results in this filter</Text>
          <Text style={styles.emptySub}>Capture a crop image to start the diagnosis log and track sync status over time.</Text>
        </SurfaceCard>
      ) : (
        filteredData.map((item) => (
          <SurfaceCard key={String(item.id ?? item.timestamp)} style={styles.card}>
            <Image source={{ uri: item.image_uri }} style={styles.image} />
            <View style={styles.info}>
              <Text style={styles.title}>{item.disease_name}</Text>
              <Text style={styles.meta}>Confidence {Math.round(item.confidence * 100)}%</Text>
              <Text style={styles.date}>{new Date(item.timestamp).toLocaleString()}</Text>
              <View style={styles.statusRow}>
                {item.is_synced ? <Cloud color={palette.success} size={14} /> : <CloudOff color={palette.warning} size={14} />}
                <StatusChip label={item.is_synced ? "Saved to cloud" : "Saved offline"} tone={item.is_synced ? "success" : "warning"} />
              </View>
            </View>
          </SurfaceCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  filterWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  filterTitle: {
    color: palette.textSecondary,
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  filterButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterButtonActive: {
    borderColor: palette.borderStrong,
    backgroundColor: palette.primarySoft,
  },
  filterText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: palette.primary,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  emptySub: {
    color: palette.textSecondary,
    textAlign: "center",
    fontSize: text.body,
    lineHeight: 21,
  },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  image: {
    width: 112,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: "#d4d4d4",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: palette.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  meta: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "700",
  },
  date: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
