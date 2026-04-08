import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Cloud, CloudOff, ListFilter, ScanLine } from "lucide-react-native";

import { getHistory, ScanResult } from "../database/sqlite";
import { palette, radius, shadows, spacing, text } from "../theme/tokens";

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
    if (filter === "detected") return data.filter((item) => item.disease_name.toLowerCase() !== "healthy");
    return data.filter((item) => item.is_synced === 0);
  }, [data, filter]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Diagnosis History</Text>
        <Text style={styles.headerSub}>Review scan results and sync status from recent captures.</Text>
      </View>

      <View style={styles.filterWrap}>
        <View style={styles.filterTitleRow}>
          <ListFilter color={palette.textSecondary} size={15} />
          <Text style={styles.filterTitle}>Filters</Text>
        </View>
        <View style={styles.filterButtons}>
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterButton, active && styles.filterButtonActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => String(item.id ?? item.timestamp)}
        contentContainerStyle={filteredData.length === 0 ? styles.emptyWrap : styles.listWrap}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image_uri }} style={styles.image} />
            <View style={styles.info}>
              <Text style={styles.title}>{item.disease_name}</Text>
              <Text style={styles.meta}>Confidence {Math.round(item.confidence * 100)}%</Text>
              <Text style={styles.date}>{new Date(item.timestamp).toLocaleString()}</Text>
              <View style={[styles.statusPill, item.is_synced ? styles.syncedPill : styles.pendingPill]}>
                {item.is_synced ? <Cloud color={palette.success} size={12} /> : <CloudOff color={palette.warning} size={12} />}
                <Text style={[styles.statusText, item.is_synced ? styles.syncedText : styles.pendingText]}>
                  {item.is_synced ? "Saved to cloud" : "Saved offline"}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ScanLine color={palette.textMuted} size={40} />
            <Text style={styles.emptyTitle}>No results in this filter</Text>
            <Text style={styles.emptySub}>Capture one crop image to start a diagnosis log and track sync status.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
    gap: 3,
  },
  headerTitle: {
    fontSize: text.title,
    lineHeight: 30,
    fontWeight: "900",
    color: palette.textPrimary,
  },
  headerSub: {
    color: palette.textSecondary,
    fontSize: text.body,
  },
  filterWrap: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterTitle: {
    color: palette.textSecondary,
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
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
    borderColor: "#cde0d3",
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
  listWrap: {
    gap: spacing.sm,
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    ...shadows.card,
  },
  image: {
    width: 106,
    height: 106,
    backgroundColor: "#d4d4d4",
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center",
  },
  title: {
    textTransform: "capitalize",
    color: palette.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  meta: {
    marginTop: 2,
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
  statusPill: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  syncedPill: {
    backgroundColor: palette.successSoft,
  },
  pendingPill: {
    backgroundColor: palette.warningSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  syncedText: {
    color: palette.success,
  },
  pendingText: {
    color: palette.warning,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  emptySub: {
    color: palette.textSecondary,
    textAlign: "center",
    fontSize: text.body,
    lineHeight: 21,
  },
});
