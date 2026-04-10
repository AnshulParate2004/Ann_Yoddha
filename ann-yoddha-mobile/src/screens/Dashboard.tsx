import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Clock3, Cloud, CloudOff, MapPin, RefreshCw, ShieldAlert, Sprout, Zap } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { getUnsyncedScans } from "../database/sqlite";
import { getHistory as getCloudHistory } from "../api/analytics";
import { getProfile } from "../api/profile";
import { syncOfflineScans } from "../services/syncService";
import { palette, radius, shadows, spacing, text } from "../theme/tokens";

interface DashboardProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

type NoticeTone = "info" | "success" | "warning";

interface StatusNotice {
  tone: NoticeTone;
  message: string;
}

export default function Dashboard({ navigation }: DashboardProps) {
  const { token, user } = useAuth();
  const isFocused = useIsFocused();
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const [profile, setProfile] = useState<{ name: string; region?: string } | null>(null);
  const [latestScan, setLatestScan] = useState<any | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    healthy: 0,
    diseased: 0,
    pendingSync: 0,
  });

  useEffect(() => {
    if (isFocused) {
      loadStats();
    }
  }, [isFocused]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Fetch cloud history + profile + offline pending count in parallel — mirrors web Dashboard
      const [cloudRes, unsynced, profileData] = await Promise.all([
        token ? getCloudHistory(50, token) : Promise.resolve({ history: [] }),
        getUnsyncedScans(),
        token ? getProfile(token).catch(() => null) : Promise.resolve(null),
      ]);

      const history = cloudRes.history || [];
      const healthy = history.filter((s: any) => s.disease_name?.toLowerCase() === "healthy").length;

      setProfile(profileData);
      setLatestScan(history[0] ?? null);
      setStats({
        total: history.length,
        healthy,
        diseased: history.length - healthy,
        pendingSync: unsynced.length,
      });
    } catch (err) {
      console.error("Dashboard loadStats error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!token) {
      setNotice({ tone: "warning", message: "Login required before syncing offline scans." });
      return;
    }

    setSyncing(true);
    setNotice(null);
    try {
      const result = await syncOfflineScans(token);
      await loadStats();
      if (result.syncedCount > 0) {
        setNotice({ tone: "success", message: `${result.syncedCount} offline scan(s) synced to cloud.` });
      } else {
        setNotice({ tone: "info", message: "No pending offline scans found." });
      }
    } catch (_error) {
      setNotice({ tone: "warning", message: "Sync failed. Check connection and try again." });
    } finally {
      setSyncing(false);
    }
  };

  const healthRate = stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 100;
  // Cloud history records are always synced; local SQLite records may not be
  const latestIsSynced = latestScan?.is_synced !== undefined ? !!latestScan.is_synced : true;
  const latestStatus = latestScan ? (latestIsSynced ? "Saved to cloud" : "Saved offline, sync pending") : "No scans yet";
  const latestTreatment = latestScan
    ? latestScan.treatment
    : "Start a crop scan to receive disease diagnosis and treatment guidance.";

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Welcome, {profile?.name || user?.email?.split('@')[0] || 'Farmer'}</Text>
        <Text style={styles.heroTitle}>Field Overview</Text>
        {profile?.region ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 8 }}>
            <MapPin color="#c8dfd2" size={13} />
            <Text style={[styles.heroMetaText, { fontSize: 12 }]}>{profile.region}</Text>
          </View>
        ) : null}
        <View style={styles.heroMetrics}>
          <Text style={styles.heroScore}>{healthRate}%</Text>
          <View>
            <Text style={styles.heroMetaLabel}>Healthy ratio</Text>
            <Text style={styles.heroMetaText}>{stats.healthy} healthy out of {stats.total} scans</Text>
          </View>
        </View>
      </View>

      {notice ? (
        <View style={[styles.notice, notice.tone === "success" ? styles.noticeSuccess : notice.tone === "warning" ? styles.noticeWarning : styles.noticeInfo]}>
          <Text style={styles.noticeText}>{notice.message}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Sprout color={palette.success} size={22} />
          <Text style={styles.statNumber}>{stats.healthy}</Text>
          <Text style={styles.statLabel}>Healthy</Text>
        </View>

        <View style={styles.statCard}>
          <ShieldAlert color={palette.danger} size={22} />
          <Text style={styles.statNumber}>{stats.diseased}</Text>
          <Text style={styles.statLabel}>Detected</Text>
        </View>

        <View style={styles.statCard}>
          <CloudOff color={palette.warning} size={22} />
          <Text style={styles.statNumber}>{stats.pendingSync}</Text>
          <Text style={styles.statLabel}>Pending sync</Text>
        </View>
      </View>

      <View style={styles.latestCard}>
        <View style={styles.latestHeader}>
          <Text style={styles.sectionTitle}>Latest Diagnosis</Text>
          <View style={[styles.statusPill, latestIsSynced ? styles.syncedPill : styles.pendingPill]}>
            {latestIsSynced ? <Cloud color={palette.success} size={13} /> : <CloudOff color={palette.warning} size={13} />}
            <Text style={[styles.statusPillText, latestIsSynced ? styles.syncedText : styles.pendingText]}>{latestStatus}</Text>
          </View>
        </View>

        <Text style={styles.latestDisease}>{latestScan ? latestScan.disease_name : "No diagnosis yet"}</Text>
        <Text style={styles.latestMeta}>
          {latestScan ? `Confidence ${Math.round(latestScan.confidence * 100)}%` : "Capture one image to get started"}
        </Text>
        <Text style={styles.latestTreatment}>{latestTreatment}</Text>

        {latestScan ? (
          <View style={styles.timestampRow}>
            <Clock3 color={palette.textMuted} size={14} />
            <Text style={styles.timestamp}>{new Date(latestScan.timestamp).toLocaleString()}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionsWrap}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate("Diagnosis")}>
          <Zap color="#fff" size={20} />
          <Text style={styles.primaryActionText}>Scan Crop Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryAction} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator color={palette.info} /> : <RefreshCw color={palette.info} size={18} />}
          <Text style={styles.secondaryActionText}>{syncing ? "Syncing..." : "Sync Offline Scans"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostAction} onPress={() => navigation.navigate("Analytics")}>
          <Text style={styles.ghostActionText}>Open Full History</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 42,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: palette.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  heroEyebrow: {
    color: "#c8dfd2",
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: "#fff",
    fontSize: text.title,
    fontWeight: "800",
  },
  heroMetrics: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroScore: {
    color: "#fff",
    fontSize: 54,
    lineHeight: 58,
    fontWeight: "900",
  },
  heroMetaLabel: {
    color: "#dbebdf",
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroMetaText: {
    color: "#e5f0e9",
    fontSize: text.body,
    marginTop: 2,
  },
  notice: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  noticeInfo: {
    backgroundColor: palette.infoSoft,
    borderColor: "#c8d8ee",
  },
  noticeSuccess: {
    backgroundColor: palette.successSoft,
    borderColor: "#c9e6d3",
  },
  noticeWarning: {
    backgroundColor: palette.warningSoft,
    borderColor: "#f0d6ab",
  },
  noticeText: {
    fontSize: text.body,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  statNumber: {
    marginTop: spacing.xs,
    fontSize: text.subtitle,
    color: palette.textPrimary,
    fontWeight: "800",
  },
  statLabel: {
    color: palette.textSecondary,
    fontSize: text.caption,
    fontWeight: "700",
  },
  latestCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.card,
  },
  latestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: text.subtitle,
    color: palette.textPrimary,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
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
  statusPillText: {
    fontSize: text.caption,
    fontWeight: "700",
  },
  syncedText: {
    color: palette.success,
  },
  pendingText: {
    color: palette.warning,
  },
  latestDisease: {
    marginTop: spacing.md,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    textTransform: "capitalize",
    color: palette.textPrimary,
  },
  latestMeta: {
    marginTop: spacing.xs,
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "700",
  },
  latestTreatment: {
    marginTop: spacing.md,
    color: palette.textSecondary,
    lineHeight: 21,
    fontSize: text.body,
  },
  timestampRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  timestamp: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  actionsWrap: {
    gap: spacing.sm,
  },
  primaryAction: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryActionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryAction: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: palette.infoSoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#c7daef",
  },
  secondaryActionText: {
    color: palette.info,
    fontWeight: "800",
    fontSize: text.body,
  },
  ghostAction: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostActionText: {
    color: palette.textPrimary,
    fontWeight: "700",
    fontSize: text.body,
  },
});
