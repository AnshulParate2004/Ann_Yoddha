import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, TouchableOpacity
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getHistory, getHotspots } from '../api/analytics';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { MapPin, TrendingUp, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Download } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const W = Dimensions.get('window').width;
const CHART_W = W - 48;

// ── helpers matching web Analytics.tsx ──────────────────────────────────────

function processLast14Days(history: any[]) {
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  const map = new Map<string, { healthy: number; diseased: number }>();
  days.forEach(d => map.set(d, { healthy: 0, diseased: 0 }));
  history.forEach(item => {
    const date = item.timestamp?.split('T')[0];
    if (map.has(date)) {
      const e = map.get(date)!;
      if (item.disease_name?.toLowerCase() === 'healthy') e.healthy++;
      else if (item.disease_name?.toLowerCase() !== 'uncertain') e.diseased++;
    }
  });
  return Array.from(map.entries()).map(([date, v]) => ({ label: date.slice(5), ...v }));
}

function summarize(history: any[]) {
  const total = history.length;
  const healthy = history.filter(h => h.disease_name?.toLowerCase() === 'healthy').length;
  const uncertain = history.filter(h => h.disease_name?.toLowerCase() === 'uncertain').length;
  const diseased = total - healthy - uncertain;
  const avgConf = total > 0
    ? Math.round((history.reduce((a, h) => a + (h.confidence || 0), 0) / total) * 100)
    : 0;
  const counts = new Map<string, number>();
  history
    .filter(h => h.disease_name?.toLowerCase() !== 'healthy' && h.disease_name?.toLowerCase() !== 'uncertain')
    .forEach(h => counts.set(h.disease_name, (counts.get(h.disease_name) ?? 0) + 1));
  const topDiseases = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  return { total, healthy, uncertain, diseased, avgConf, topDiseases };
}

// ── component ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);

  const load = async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [histRes, spotsRes] = await Promise.all([
        getHistory(500, token),
        getHotspots(token),
      ]);
      setHistory(histRes.history || []);
      setHotspots(Array.isArray(spotsRes) ? spotsRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportReport = async () => {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #172120; background: #fff; }
    h1 { color: #2a6f4e; margin-bottom: 4px; }
    .sub { color: #7a8783; font-size: 13px; margin-bottom: 28px; }
    .grid { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .card { background: #f8faf8; border: 1px solid #dcf0e4; border-radius: 10px; padding: 16px; min-width: 140px; flex: 1; }
    .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #7a8783; font-weight: 700; }
    .card-value { font-size: 28px; font-weight: 800; margin-top: 4px; }
    .green { color: #10b981; } .red { color: #ef4444; } .blue { color: #2a6f4e; }
    h2 { color: #2a6f4e; margin-top: 24px; margin-bottom: 8px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f4f7f5; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #7a8783; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0ede6; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-red { background: #ffece8; color: #b23a2a; }
    .badge-yellow { background: #fff1dd; color: #b86a00; }
    .badge-green { background: #e7f5ec; color: #256f3a; }
    .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <h1>🌾 Ann Yoddha — Field Report</h1>
  <p class="sub">Generated on ${date} &nbsp;|&nbsp; Powered by Ann Yoddha AI</p>

  <div class="grid">
    <div class="card"><div class="card-label">Total Scans</div><div class="card-value">${metrics.total}</div></div>
    <div class="card"><div class="card-label">Healthy</div><div class="card-value green">${metrics.total > 0 ? Math.round((metrics.healthy / metrics.total) * 100) : 0}%</div></div>
    <div class="card"><div class="card-label">Diseased</div><div class="card-value red">${metrics.diseased}</div></div>
    <div class="card"><div class="card-label">Avg Confidence</div><div class="card-value blue">${metrics.avgConf}%</div></div>
  </div>

  <h2>Disease Breakdown</h2>
  ${metrics.topDiseases.length > 0 ? `
  <table>
    <tr><th>#</th><th>Disease</th><th>Scan Count</th><th>Status</th></tr>
    ${metrics.topDiseases.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.name}</td>
        <td>${d.count}</td>
        <td><span class="badge badge-red">Detected</span></td>
      </tr>
    `).join('')}
  </table>` : '<p style="color:#7a8783">No disease data recorded.</p>'}

  <h2>Regional Hotspots</h2>
  ${hotspots.length > 0 ? `
  <table>
    <tr><th>Disease</th><th>Region</th><th>Cases</th><th>Severity</th></tr>
    ${hotspots.map(s => `
      <tr>
        <td>${s.disease}</td>
        <td>${s.region}</td>
        <td>${s.count ?? '-'}</td>
        <td><span class="badge ${
          s.severity === 'high' ? 'badge-red' :
          s.severity === 'medium' ? 'badge-yellow' : 'badge-green'
        }">${(s.severity || '').toUpperCase()}</span></td>
      </tr>
    `).join('')}
  </table>` : '<p style="color:#7a8783">No regional hotspots tracked.</p>'}

  <div class="footer">Ann Yoddha &copy; ${new Date().getFullYear()} &mdash; AI-powered crop disease management</div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Field Report' });
      } else {
        alert('Sharing not available on this device.');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Could not generate the report.');
    }
  };

  useEffect(() => { load(); }, [token]);

  const metrics = useMemo(() => summarize(history), [history]);
  const trend = useMemo(() => processLast14Days(history), [history]);

  const pieData = [
    { name: 'Healthy', population: metrics.healthy, color: '#10b981', legendFontColor: '#5a6763', legendFontSize: 12 },
    { name: 'Infected', population: metrics.diseased, color: '#ef4444', legendFontColor: '#5a6763', legendFontSize: 12 },
    { name: 'Uncertain', population: metrics.uncertain, color: '#f59e0b', legendFontColor: '#5a6763', legendFontSize: 12 },
  ];

  const lineData = {
    labels: trend.filter((_, i) => i % 2 === 0).map(d => d.label),
    datasets: [
      { data: trend.filter((_, i) => i % 2 === 0).map(d => d.diseased), color: () => '#ef4444', strokeWidth: 2 },
      { data: trend.filter((_, i) => i % 2 === 0).map(d => d.healthy), color: () => '#10b981', strokeWidth: 2 },
    ],
    legend: ['Diseased', 'Healthy'],
  };

  const barData = metrics.topDiseases.length > 0
    ? {
        labels: metrics.topDiseases.map(d => d.name.substring(0, 7)),
        datasets: [{ data: metrics.topDiseases.map(d => d.count) }],
      }
    : { labels: ['No data'], datasets: [{ data: [0] }] };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(42, 111, 78, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(90, 103, 99, ${opacity})`,
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#2a6f4e' },
    propsForBackgroundLines: { strokeDasharray: '4 4', stroke: '#e5dfd2', strokeWidth: 1 },
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2a6f4e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Analytics</Text>
          <Text style={styles.pageSub}>Field Intelligence & Disease Trends</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color="#2a6f4e" />
              : <RefreshCw color="#2a6f4e" size={18} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={exportReport}>
            <Download color="#ffffff" size={18} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards — mirrors web 4-metric row */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { flex: 1 }]}>
          <Text style={styles.metricLabel}>Total Scans</Text>
          <Text style={styles.metricValue}>{metrics.total}</Text>
        </View>
        <View style={[styles.metricCard, { flex: 1 }]}>
          <Text style={styles.metricLabel}>Healthy</Text>
          <Text style={[styles.metricValue, { color: '#10b981' }]}>
            {metrics.total > 0 ? Math.round((metrics.healthy / metrics.total) * 100) : 0}%
          </Text>
        </View>
      </View>
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { flex: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldAlert color="#ef4444" size={16} />
            <Text style={styles.metricLabel}>Diseased</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#ef4444' }]}>{metrics.diseased}</Text>
        </View>
        <View style={[styles.metricCard, { flex: 1 }]}>
          <Text style={styles.metricLabel}>Avg Confidence</Text>
          <Text style={[styles.metricValue, { color: '#2a6f4e' }]}>{metrics.avgConf}%</Text>
        </View>
      </View>

      {/* 14-Day Trend Line Chart */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color="#2a6f4e" />
          <Text style={styles.cardTitle}>14-Day Scan Trend</Text>
        </View>
        <Text style={styles.cardSub}>Healthy vs Diseased over last 2 weeks</Text>
        <LineChart
          data={lineData}
          width={CHART_W}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={{ borderRadius: 8, marginTop: 8 }}
          withInnerLines={true}
          withOuterLines={false}
          withShadow={false}
        />
      </View>

      {/* Health Distribution Pie */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <CheckCircle2 size={18} color="#2a6f4e" />
          <Text style={styles.cardTitle}>Health Distribution</Text>
        </View>
        {metrics.total > 0 ? (
          <PieChart
            data={pieData}
            width={CHART_W}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="10"
            absolute
          />
        ) : (
          <Text style={styles.emptyText}>No data yet — scan your first crop to see distribution.</Text>
        )}
      </View>

      {/* Top Diseases Bar Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Disease Frequency</Text>
        <Text style={styles.cardSub}>Top detected diseases from your scans</Text>
        <BarChart
          data={barData}
          width={CHART_W}
          height={220}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(42, 111, 78, ${opacity})`,
          }}
          style={{ borderRadius: 8, marginTop: 8 }}
          showValuesOnTopOfBars
          fromZero
        />
      </View>

      {/* Disease breakdown list (mirrors web top-5 table) */}
      {metrics.topDiseases.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Disease Breakdown</Text>
          {metrics.topDiseases.map((d, i) => (
            <View key={i} style={styles.diseaseRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <ShieldAlert color="#ef4444" size={15} />
                <Text style={styles.diseaseName} numberOfLines={1}>{d.name}</Text>
              </View>
              <View style={styles.diseaseBadge}>
                <Text style={styles.diseaseBadgeText}>{d.count} scans</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Regional Hotspots */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <MapPin size={18} color="#ef4444" />
          <Text style={styles.cardTitle}>Regional Hotspots</Text>
        </View>
        {hotspots.length > 0 ? hotspots.map((spot, i) => (
          <View key={i} style={styles.spotRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.spotDisease}>{spot.disease}</Text>
              <Text style={styles.spotRegion}>{spot.region} · {spot.count ?? ''} cases</Text>
            </View>
            <View style={[styles.spotBadge,
              spot.severity === 'high' ? styles.badgeHigh :
              spot.severity === 'medium' ? styles.badgeMedium : styles.badgeLow
            ]}>
              <Text style={[styles.spotBadgeText,
                spot.severity === 'high' ? { color: '#b23a2a' } :
                spot.severity === 'medium' ? { color: '#b86a00' } : { color: '#256f3a' }
              ]}>{spot.severity?.toUpperCase()}</Text>
            </View>
          </View>
        )) : (
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
            <AlertTriangle color="#7a8783" size={28} />
            <Text style={styles.emptyText}>No regional hotspots currently tracked.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 20, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#172120' },
  pageSub: { fontSize: 13, color: '#5a6763', marginTop: 2 },
  refreshBtn: { padding: 10, backgroundColor: '#dcf0e4', borderRadius: 10 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#2a6f4e', borderRadius: 10 },
  exportBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  metricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metricCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#dcf0e4' },
  metricLabel: { fontSize: 12, color: '#7a8783', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 26, fontWeight: '800', color: '#172120', marginTop: 4 },
  chartCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#dcf0e4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#172120' },
  cardSub: { fontSize: 12, color: '#7a8783', marginBottom: 4 },
  emptyText: { textAlign: 'center', color: '#7a8783', fontSize: 13 },
  diseaseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0ede6' },
  diseaseName: { fontSize: 14, color: '#172120', fontWeight: '600', flex: 1 },
  diseaseBadge: { backgroundColor: '#ffece8', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  diseaseBadgeText: { fontSize: 11, fontWeight: '700', color: '#b23a2a' },
  spotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0ede6' },
  spotDisease: { fontSize: 14, fontWeight: '700', color: '#172120', textTransform: 'capitalize' },
  spotRegion: { fontSize: 12, color: '#7a8783', marginTop: 2 },
  spotBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeHigh: { backgroundColor: '#ffece8' },
  badgeMedium: { backgroundColor: '#fff1dd' },
  badgeLow: { backgroundColor: '#e7f5ec' },
  spotBadgeText: { fontSize: 10, fontWeight: '800' },
});
