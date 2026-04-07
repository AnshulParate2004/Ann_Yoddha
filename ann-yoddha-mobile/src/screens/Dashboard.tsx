import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Sprout, Activity, ShieldAlert, Zap, RefreshCw } from 'lucide-react-native'; // Added RefreshCw icon
import { useAuth } from '../context/AuthContext';
import { getHistory, ScanResult } from '../database/sqlite';
import { useIsFocused } from '@react-navigation/native';
import { syncOfflineScans } from '../services/syncService'; // Import the sync service

const { width } = Dimensions.get('window');

export default function Dashboard({ navigation }: any) {
  const { token } = useAuth();
  const [stats, setStats] = useState({ total: 0, healthy: 0, diseased: 0 });
  const [syncing, setSyncing] = useState(false); // New state for loading
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadStats();
    }
  }, [isFocused]);

  const loadStats = async () => {
    const history = await getHistory();
    const diseased = history.filter(h => h.disease_name.toLowerCase() !== 'healthy').length;
    setStats({
      total: history.length,
      healthy: history.length - diseased,
      diseased: diseased
    });
  };

  // Function to handle the manual sync
  const handleSync = async () => {
    if (!token) {
      Alert.alert("Login required", "Please sign in before syncing.");
      return;
    }
    setSyncing(true);
    try {
      const result = await syncOfflineScans(token);
      await loadStats(); // Refresh stats after sync
      if (result.syncedCount > 0) {
        Alert.alert("Success", `${result.syncedCount} scan(s) synchronized with the Yoddha server.`);
      } else {
        Alert.alert("Sync Info", "No pending offline scans were found.");
      }
    } catch (error) {
      Alert.alert("Sync Info", "No new scans to sync or server is currently unreachable.");
    } finally {
      setSyncing(false);
    }
  };

  const healthPercentage = stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 100;

  return (
    <ScrollView style={styles.container}>
      {/* Header Summary */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Crop Health Score</Text>
        <Text style={styles.scoreText}>{healthPercentage}%</Text>
        <Text style={styles.headerSub}>Based on your last {stats.total} scans</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <Sprout color="#4CAF50" size={32} />
          <Text style={styles.statNum}>{stats.healthy}</Text>
          <Text style={styles.statLabel}>Healthy</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFEBEE' }]}>
          <ShieldAlert color="#F44336" size={32} />
          <Text style={styles.statNum}>{stats.diseased}</Text>
          <Text style={styles.statLabel}>Threats</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      {/* Primary Scan Button */}
      <TouchableOpacity 
        style={styles.actionBtn} 
        onPress={() => navigation.navigate('Scanner')}
      >
        <Zap color="#FFF" size={24} />
        <Text style={styles.actionBtnText}>Start New AI Scan</Text>
      </TouchableOpacity>

      {/* NEW: Sync Button */}
      <TouchableOpacity 
        style={[styles.actionBtn, { backgroundColor: '#1976D2', marginTop: -5 }]} 
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <RefreshCw color="#FFF" size={24} />
            <Text style={styles.actionBtnText}>Sync Offline Data</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Recent Activity Mini-List */}
      <View style={styles.infoBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Activity color="#666" size={20} />
          <Text style={styles.infoTitle}>System Status</Text>
        </View>
        <Text style={styles.infoContent}>
          AI Model: YOLOv12 + SNN {'\n'}
          Database: {stats.total > 0 ? 'Active' : 'Empty'} {'\n'}
          Sync Status: {stats.total > 0 ? 'Ready' : 'Awaiting Data'}
        </Text>
      </View>
      
      <View style={{ height: 40 }} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  headerCard: {
    backgroundColor: '#4CAF50',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 25,
    elevation: 5,
  },
  headerTitle: { color: '#FFF', fontSize: 18, opacity: 0.9 },
  scoreText: { color: '#FFF', fontSize: 64, fontWeight: 'bold', marginVertical: 10 },
  headerSub: { color: '#FFF', fontSize: 14, opacity: 0.8 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: {
    width: width * 0.42,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
  },
  statNum: { fontSize: 24, fontWeight: 'bold', marginTop: 10, color: '#333' },
  statLabel: { fontSize: 14, color: '#666' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  actionBtn: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    padding: 20,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  infoBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#EEE', marginBottom: 20 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10, color: '#666' },
  infoContent: { marginTop: 10, color: '#888', lineHeight: 22 },
});
