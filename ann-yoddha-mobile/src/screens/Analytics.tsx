import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { CheckCircle2, Download, MapPin, RefreshCw, ShieldAlert, TrendingUp, TriangleAlert } from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useAuth } from "../context/AuthContext";
import { getHistory, getHotspots } from "../api/analytics";
import { palette, spacing, text } from "../theme/tokens";
import { ActionButton, AppScreen, GradientCard, SectionHeading, StatusChip, SurfaceCard } from "../components/AppSurface";

function processLast14Days(history: any[]) {
  const days = Array.from({ length: 14 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return date.toISOString().split("T")[0];
  });

  const map = new Map<string, { healthy: number; diseased: number }>();
  days.forEach((day) => map.set(day, { healthy: 0, diseased: 0 }));

  history.forEach((item) => {
    const date = item.timestamp?.split("T")[0];
    if (!map.has(date)) return;

    const current = map.get(date)!;
    if (item.disease_name?.toLowerCase() === "healthy") current.healthy += 1;
    else if (item.disease_name?.toLowerCase() !== "uncertain") current.diseased += 1;
  });

  return Array.from(map.entries()).map(([date, value]) => ({ label: date.slice(5), ...value }));
}

function summarize(history: any[]) {
  const total = history.length;
  const healthy = history.filter((item) => item.disease_name?.toLowerCase() === "healthy").length;
  const uncertain = history.filter((item) => item.disease_name?.toLowerCase() === "uncertain").length;
  const diseased = total - healthy - uncertain;
  const avgConf = total > 0 ? Math.round((history.reduce((acc, item) => acc + (item.confidence || 0), 0) / total) * 100) : 0;

  const counts = new Map<string, number>();
  history
    .filter((item) => item.disease_name?.toLowerCase() !== "healthy" && item.disease_name?.toLowerCase() !== "uncertain")
    .forEach((item) => counts.set(item.disease_name, (counts.get(item.disease_name) ?? 0) + 1));

  const topDiseases = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return { total, healthy, uncertain, diseased, avgConf, topDiseases };
}

export default function Analytics() {
  const { width } = useWindowDimensions();
  const sizeClass = width < 360 ? "tiny" : width <= 420 ? "compact" : "regular";
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);

  const chartWidth = Math.max(sizeClass === "tiny" ? 240 : 270, width - (sizeClass === "regular" ? 84 : 64));

  const load = async (quiet = false) => {
    if (!token) return;

    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const [historyResponse, hotspotsResponse] = await Promise.all([getHistory(500, token), getHotspots(token)]);
      setHistory(historyResponse.history || []);
      setHotspots(Array.isArray(hotspotsResponse) ? hotspotsResponse : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const metrics = useMemo(() => summarize(history), [history]);
  const trend = useMemo(() => processLast14Days(history), [history]);

  const pieData = [
    { name: "Healthy", population: metrics.healthy, color: palette.success, legendFontColor: palette.textSecondary, legendFontSize: 12 },
    { name: "Detected", population: metrics.diseased, color: palette.danger, legendFontColor: palette.textSecondary, legendFontSize: 12 },
    { name: "Uncertain", population: metrics.uncertain, color: palette.warning, legendFontColor: palette.textSecondary, legendFontSize: 12 },
  ];

  const lineData = {
    labels: trend.filter((_, index) => index % 2 === 0).map((item) => item.label),
    datasets: [
      { data: trend.filter((_, index) => index % 2 === 0).map((item) => item.diseased), color: () => palette.danger, strokeWidth: 2 },
      { data: trend.filter((_, index) => index % 2 === 0).map((item) => item.healthy), color: () => palette.success, strokeWidth: 2 },
    ],
    legend: ["Detected", "Healthy"],
  };

  const barData =
    metrics.topDiseases.length > 0
      ? {
          labels: metrics.topDiseases.map((item) => item.name.substring(0, 7)),
          datasets: [{ data: metrics.topDiseases.map((item) => item.count) }],
        }
      : { labels: ["No data"], datasets: [{ data: [0] }] };

  const chartConfig = {
    backgroundColor: palette.surfaceRaised,
    backgroundGradientFrom: palette.surfaceRaised,
    backgroundGradientTo: palette.surfaceRaised,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(47, 109, 79, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(85, 101, 93, ${opacity})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: palette.primary },
    propsForBackgroundLines: { strokeDasharray: "4 4", stroke: palette.border, strokeWidth: 1 },
  };

  const exportReport = async () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #17211c; background: #fffdf7; }
    h1 { color: #2f6d4f; margin-bottom: 4px; }
    .sub { color: #7c877f; font-size: 13px; margin-bottom: 28px; }
    .grid { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .card { background: #f6f4ea; border: 1px solid #d7dfd2; border-radius: 14px; padding: 16px; min-width: 140px; flex: 1; }
    .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #7c877f; font-weight: 700; }
    .card-value { font-size: 28px; font-weight: 800; margin-top: 4px; }
    .green { color: #2f7a47; } .red { color: #b04736; } .blue { color: #2f6d4f; }
    h2 { color: #2f6d4f; margin-top: 24px; margin-bottom: 8px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f2f2ea; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #7c877f; }
    td { padding: 10px 12px; border-bottom: 1px solid #ece7da; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-red { background: #fdebe6; color: #b04736; }
    .badge-yellow { background: #fff2de; color: #af6d1e; }
    .badge-green { background: #e7f4e8; color: #2f7a47; }
    .footer { margin-top: 40px; font-size: 11px; color: #9aa39c; text-align: center; }
  </style>
</head>
<body>
  <h1>Ann Yoddha Field Report</h1>
  <p class="sub">Generated on ${date} | Powered by Ann Yoddha AI</p>

  <div class="grid">
    <div class="card"><div class="card-label">Total Scans</div><div class="card-value">${metrics.total}</div></div>
    <div class="card"><div class="card-label">Healthy</div><div class="card-value green">${metrics.total > 0 ? Math.round((metrics.healthy / metrics.total) * 100) : 0}%</div></div>
    <div class="card"><div class="card-label">Detected</div><div class="card-value red">${metrics.diseased}</div></div>
    <div class="card"><div class="card-label">Avg Confidence</div><div class="card-value blue">${metrics.avgConf}%</div></div>
  </div>

  <h2>Disease Breakdown</h2>
  ${
    metrics.topDiseases.length > 0
      ? `<table>
          <tr><th>#</th><th>Disease</th><th>Scan Count</th><th>Status</th></tr>
          ${metrics.topDiseases
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.name}</td>
              <td>${item.count}</td>
              <td><span class="badge badge-red">Detected</span></td>
            </tr>`,
            )
            .join("")}
        </table>`
      : '<p style="color:#7c877f">No disease data recorded.</p>'
  }

  <h2>Regional Hotspots</h2>
  ${
    hotspots.length > 0
      ? `<table>
          <tr><th>Disease</th><th>Region</th><th>Cases</th><th>Severity</th></tr>
          ${hotspots
            .map(
              (spot) => `
            <tr>
              <td>${spot.disease}</td>
              <td>${spot.region}</td>
              <td>${spot.count ?? "-"}</td>
              <td><span class="badge ${
                spot.severity === "high" ? "badge-red" : spot.severity === "medium" ? "badge-yellow" : "badge-green"
              }">${(spot.severity || "").toUpperCase()}</span></td>
            </tr>`,
            )
            .join("")}
        </table>`
      : '<p style="color:#7c877f">No regional hotspots tracked.</p>'
  }

  <div class="footer">Ann Yoddha &copy; ${new Date().getFullYear()} - AI-powered crop disease management</div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export Field Report" });
      } else {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export failed", "Could not generate the report.");
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <GradientCard>
          <Text style={styles.heroEyebrow}>Field intelligence</Text>
          <Text style={styles.heroTitle}>Analytics overview</Text>
          <Text style={styles.heroSubtitle}>Loading charts and trend summaries...</Text>
        </GradientCard>
        <SurfaceCard style={styles.skeletonCard}><ActivityIndicator size="large" color={palette.primary} /></SurfaceCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <GradientCard>
        <Text style={styles.heroEyebrow}>Field intelligence</Text>
        <Text style={[styles.heroTitle, sizeClass !== "regular" && styles.heroTitleCompact]}>Analytics overview</Text>
        <Text style={styles.heroSubtitle}>Disease trends, hotspot signals, and health distribution presented in the same visual language as the rest of the app.</Text>
      </GradientCard>

        <View style={[styles.actionRow, sizeClass === "tiny" && styles.actionRowTiny]}>
        <ActionButton
          label={refreshing ? "Refreshing..." : "Refresh"}
          onPress={() => load(true)}
          disabled={refreshing}
          tone="secondary"
          icon={refreshing ? <ActivityIndicator color={palette.primary} /> : <RefreshCw color={palette.primary} size={18} />}
          style={styles.actionButton}
        />
        <ActionButton
          label="Export report"
          onPress={exportReport}
          icon={<Download color={palette.white} size={18} />}
          style={styles.actionButton}
        />
      </View>

      <View style={[styles.metricGrid, sizeClass === "tiny" && styles.metricGridTiny]}>
        <MetricCard label="Total scans" value={String(metrics.total)} tone="default" />
        <MetricCard label="Healthy" value={`${metrics.total > 0 ? Math.round((metrics.healthy / metrics.total) * 100) : 0}%`} tone="success" />
      </View>
      <View style={[styles.metricGrid, sizeClass === "tiny" && styles.metricGridTiny]}>
        <MetricCard label="Detected" value={String(metrics.diseased)} tone="danger" icon={<ShieldAlert color={palette.danger} size={16} />} />
        <MetricCard label="Avg confidence" value={`${metrics.avgConf}%`} tone="primary" />
      </View>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Trend"
          title="14-day scan movement"
          subtitle="Healthy versus detected cases across the last two weeks."
          right={<TrendingUp color={palette.primary} size={18} />}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={lineData}
            width={chartWidth}
            height={214}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines
            withOuterLines={false}
            withShadow={false}
          />
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Distribution"
          title="Health breakdown"
          subtitle="Healthy, detected, and uncertain outcomes from your recorded scans."
          right={<CheckCircle2 color={palette.primary} size={18} />}
        />
        {metrics.total > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <PieChart
              data={pieData}
              width={chartWidth}
              height={190}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="12"
              absolute
            />
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No scans yet. Capture a crop image to populate the health distribution.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Frequency"
          title="Top detected diseases"
          subtitle="The most common issues seen across your scan history."
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={barData}
            width={chartWidth}
            height={230}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
          />
        </ScrollView>
      </SurfaceCard>

      {metrics.topDiseases.length > 0 ? (
        <SurfaceCard>
          <SectionHeading eyebrow="Breakdown" title="Disease list" subtitle="A compact summary of the most frequent detections." />
          <View style={styles.listWrap}>
            {metrics.topDiseases.map((item) => (
              <View key={item.name} style={styles.listRow}>
                <View style={styles.listLeft}>
                  <ShieldAlert color={palette.danger} size={16} />
                  <Text style={styles.listText}>{item.name}</Text>
                </View>
                <StatusChip label={`${item.count} scans`} tone="danger" />
              </View>
            ))}
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <SectionHeading
          eyebrow="Regions"
          title="Hotspots"
          subtitle="Regional disease concentrations when available from the backend."
          right={<MapPin color={palette.danger} size={18} />}
        />
        {hotspots.length > 0 ? (
          <View style={styles.listWrap}>
            {hotspots.map((spot, index) => (
              <View key={`${spot.region}-${spot.disease}-${index}`} style={styles.hotspotRow}>
                <View style={styles.hotspotCopy}>
                  <Text style={styles.hotspotDisease}>{spot.disease}</Text>
                  <Text style={styles.hotspotRegion}>{spot.region} · {spot.count ?? "-"} cases</Text>
                </View>
                <StatusChip
                  label={(spot.severity || "low").toUpperCase()}
                  tone={spot.severity === "high" ? "danger" : spot.severity === "medium" ? "warning" : "success"}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <TriangleAlert color={palette.textMuted} size={28} />
            <Text style={styles.emptyText}>No regional hotspots are currently tracked.</Text>
          </View>
        )}
      </SurfaceCard>
    </AppScreen>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "danger" | "primary";
  icon?: React.ReactNode;
}) {
  return (
    <SurfaceCard style={styles.metricCard} density="compact">
      <View style={styles.metricHeader}>
        {icon}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.metricValue,
          tone === "success" ? styles.metricValueSuccess : null,
          tone === "danger" ? styles.metricValueDanger : null,
          tone === "primary" ? styles.metricValuePrimary : null,
        ]}
      >
        {value}
      </Text>
    </SurfaceCard>
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
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: palette.white,
    fontSize: text.title,
    fontWeight: "700",
  },
  heroTitleCompact: {
    fontSize: text.subtitle + 3,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: "#e7f0ea",
    fontSize: text.body,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionRowTiny: {
    gap: spacing.xs,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 160,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricGridTiny: {
    gap: spacing.xs,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: "48%",
    minHeight: 112,
    justifyContent: "space-between",
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: text.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  metricValueSuccess: {
    color: palette.success,
  },
  metricValueDanger: {
    color: palette.danger,
  },
  metricValuePrimary: {
    color: palette.primary,
  },
  chart: {
    marginTop: spacing.md,
    borderRadius: 14,
  },
  listWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  listLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  listText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: text.body,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  hotspotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  hotspotCopy: {
    flex: 1,
  },
  hotspotDisease: {
    color: palette.textPrimary,
    fontSize: text.body,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  hotspotRegion: {
    marginTop: 3,
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  skeletonCard: {
    minHeight: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    marginTop: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyText: {
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 21,
    textAlign: "center",
  },
});
