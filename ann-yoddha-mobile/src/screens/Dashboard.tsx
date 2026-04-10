import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Clock3, Cloud, CloudOff, MapPin, RefreshCw, ShieldAlert, Sprout, Zap } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { getUnsyncedScans } from "../database/sqlite";
import { getHistory as getCloudHistory } from "../api/analytics";
import { getProfile } from "../api/profile";
import { syncOfflineScans } from "../services/syncService";
import { palette, radius, spacing, text } from "../theme/tokens";
import { ActionButton, AppScreen, GradientCard, SectionHeading, StatusChip, SurfaceCard } from "../components/AppSurface";

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
  const { width } = useWindowDimensions();
  const sizeClass = width < 360 ? "tiny" : width <= 420 ? "compact" : "regular";
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
  const [syncCenterVisible, setSyncCenterVisible] = useState(false);
  const [syncAttempts, setSyncAttempts] = useState(0);

  useEffect(() => {
    if (isFocused) {
      loadStats();
    }
  }, [isFocused]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [cloudRes, unsynced, profileData] = await Promise.all([
        token ? getCloudHistory(50, token) : Promise.resolve({ history: [] }),
        getUnsyncedScans(),
        token ? getProfile(token).catch(() => null) : Promise.resolve(null),
      ]);

      const history = cloudRes.history || [];
      const healthy = history.filter((scan: any) => scan.disease_name?.toLowerCase() === "healthy").length;

      setProfile(profileData);
      setLatestScan(history[0] ?? null);
      setStats({
        total: history.length,
        healthy,
        diseased: history.length - healthy,
        pendingSync: unsynced.length,
      });
    } catch (error) {
      console.error("Dashboard loadStats error:", error);
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

  const handleSyncWithRetry = async () => {
    if (!token) return;
    let attempt = 0;
    const maxAttempts = 3;
    setSyncAttempts(0);
    while (attempt < maxAttempts) {
      attempt += 1;
      setSyncAttempts(attempt);
      try {
        const result = await syncOfflineScans(token);
        await loadStats();
        setNotice({ tone: "success", message: `${result.syncedCount} scan(s) synced.` });
        return;
      } catch {
        if (attempt === maxAttempts) {
          setNotice({ tone: "warning", message: "Sync retries exhausted. Please try again later." });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** (attempt - 1)));
        }
      }
    }
  };

  const healthRate = stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 100;
  const latestIsSynced = latestScan?.is_synced !== undefined ? !!latestScan.is_synced : true;
  const latestStatus = latestScan ? (latestIsSynced ? "Saved to cloud" : "Saved offline, sync pending") : "No scans yet";
  const latestTreatment = latestScan
    ? latestScan.treatment
    : "Start a crop scan to receive disease diagnosis and treatment guidance.";

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <AppScreen>
      <GradientCard>
        <Text style={styles.heroEyebrow}>Field overview</Text>
        <Text style={[styles.heroTitle, sizeClass !== "regular" && styles.heroTitleCompact]}>
          Welcome, {profile?.name || user?.email?.split("@")[0] || "Farmer"}
        </Text>
        <Text style={styles.heroSubtitle}>
          A cleaner snapshot of crop health, sync state, and the next action you should take.
        </Text>

        {profile?.region ? (
          <View style={styles.heroMetaRow}>
            <MapPin color="#dbe9de" size={14} />
            <Text style={styles.heroMetaText}>{profile.region}</Text>
          </View>
        ) : null}

        <View style={[styles.heroStats, sizeClass === "tiny" && styles.heroStatsCompact]}>
          <View>
            <Text style={[styles.heroScore, sizeClass !== "regular" && styles.heroScoreCompact]}>{healthRate}%</Text>
            <Text style={styles.heroCaption}>Healthy ratio</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatColumn}>
            <Text style={[styles.heroMetric, sizeClass !== "regular" && styles.heroMetricCompact]}>{stats.total}</Text>
            <Text style={styles.heroMetaText}>Total scans tracked</Text>
            <Text style={[styles.heroMetric, styles.heroMetricSmall, sizeClass !== "regular" && styles.heroMetricCompact]}>{stats.pendingSync}</Text>
            <Text style={styles.heroMetaText}>Waiting to sync</Text>
          </View>
        </View>
      </GradientCard>

      {notice ? (
        <SurfaceCard style={[styles.noticeCard, notice.tone === "success" ? styles.noticeSuccess : notice.tone === "warning" ? styles.noticeWarning : styles.noticeInfo]}>
          <Text style={styles.noticeText}>{notice.message}</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.metricGrid}>
        <SurfaceCard style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricIconSuccess]}>
            <Sprout color={palette.success} size={18} />
          </View>
          <Text style={styles.metricValue}>{stats.healthy}</Text>
          <Text style={styles.metricLabel}>Healthy scans</Text>
        </SurfaceCard>

        <SurfaceCard style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricIconDanger]}>
            <ShieldAlert color={palette.danger} size={18} />
          </View>
          <Text style={styles.metricValue}>{stats.diseased}</Text>
          <Text style={styles.metricLabel}>Detected issues</Text>
        </SurfaceCard>

        <SurfaceCard style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricIconWarning]}>
            <CloudOff color={palette.warning} size={18} />
          </View>
          <Text style={styles.metricValue}>{stats.pendingSync}</Text>
          <Text style={styles.metricLabel}>Pending sync</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Latest"
          title={latestScan ? latestScan.disease_name : "No diagnosis yet"}
          subtitle={latestScan ? `Confidence ${(latestScan.confidence * 100).toFixed(1)}%` : "Capture one image to get started"}
          right={<StatusChip label={latestStatus} tone={latestIsSynced ? "success" : "warning"} />}
        />
        <Text style={styles.latestTreatment}>{latestTreatment}</Text>
        {latestScan ? (
          <View style={styles.metaRow}>
            {latestIsSynced ? <Cloud color={palette.success} size={14} /> : <CloudOff color={palette.warning} size={14} />}
            <Clock3 color={palette.textMuted} size={14} />
            <Text style={styles.metaText}>{new Date(latestScan.timestamp).toLocaleString()}</Text>
          </View>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Actions"
          title="What next"
          subtitle="Keep the workflow short: scan, sync, then review deeper analytics only when needed."
        />
        <View style={styles.actionStack}>
          <ActionButton
            label="Scan crop now"
            onPress={() => navigation.navigate("Diagnosis")}
            icon={<Zap color={palette.white} size={18} />}
          />
          <ActionButton
            label={syncing ? "Syncing offline scans..." : "Sync offline scans"}
            onPress={handleSync}
            disabled={syncing}
            tone="secondary"
            icon={syncing ? <ActivityIndicator color={palette.primary} /> : <RefreshCw color={palette.primary} size={18} />}
          />
          <ActionButton label="Open analytics" onPress={() => navigation.navigate("Analytics")} tone="ghost" />
          <ActionButton label="Open sync center" onPress={() => setSyncCenterVisible(true)} tone="secondary" />
        </View>
      </SurfaceCard>

      <Modal visible={syncCenterVisible} transparent animationType="fade" onRequestClose={() => setSyncCenterVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.syncModal}>
            <Text style={styles.syncTitle}>Sync Center</Text>
            <Text style={styles.syncText}>Pending offline scans: {stats.pendingSync}</Text>
            <Text style={styles.syncText}>Retry attempt: {syncAttempts || "-"}</Text>
            <View style={styles.syncActions}>
              <ActionButton label="Retry with backoff" onPress={handleSyncWithRetry} />
              <Pressable onPress={() => setSyncCenterVisible(false)} style={styles.dismissButton}>
                <Text style={styles.dismissText}>Close</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  heroEyebrow: {
    color: "#dce8df",
    fontSize: text.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: palette.white,
    fontSize: text.title,
    lineHeight: 31,
    fontWeight: "700",
  },
  heroTitleCompact: {
    fontSize: text.subtitle + 2,
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: "#e6f0ea",
    fontSize: text.body,
    lineHeight: 22,
  },
  heroMetaRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: {
    color: "#d8e7dd",
    fontSize: 13,
    fontWeight: "600",
  },
  heroStats: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroStatsCompact: {
    gap: spacing.md,
  },
  heroScore: {
    color: palette.white,
    fontSize: 54,
    lineHeight: 58,
    fontWeight: "700",
  },
  heroScoreCompact: {
    fontSize: 40,
    lineHeight: 44,
  },
  heroCaption: {
    color: "#dce8df",
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroStatColumn: {
    flex: 1,
    gap: 4,
  },
  heroMetric: {
    color: palette.white,
    fontSize: 28,
    fontWeight: "700",
  },
  heroMetricCompact: {
    fontSize: 22,
  },
  heroMetricSmall: {
    marginTop: spacing.sm,
    fontSize: 24,
  },
  noticeCard: {
    paddingVertical: spacing.md,
  },
  noticeInfo: {
    backgroundColor: palette.infoSoft,
  },
  noticeSuccess: {
    backgroundColor: palette.successSoft,
  },
  noticeWarning: {
    backgroundColor: palette.warningSoft,
  },
  noticeText: {
    color: palette.textPrimary,
    fontSize: text.body,
    fontWeight: "600",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 104,
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconSuccess: {
    backgroundColor: palette.successSoft,
  },
  metricIconDanger: {
    backgroundColor: palette.dangerSoft,
  },
  metricIconWarning: {
    backgroundColor: palette.warningSoft,
  },
  metricValue: {
    marginTop: spacing.sm,
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  metricLabel: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: text.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  latestTreatment: {
    marginTop: spacing.md,
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 22,
  },
  metaRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  actionStack: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  syncModal: {
    gap: spacing.sm,
  },
  syncTitle: {
    color: palette.textPrimary,
    fontSize: text.subtitle,
    fontWeight: "700",
  },
  syncText: {
    color: palette.textSecondary,
    fontSize: text.body,
  },
  syncActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  dismissText: {
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "600",
  },
});
