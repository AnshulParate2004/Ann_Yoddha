import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { uploadImage, streamRecommendation } from '../api/predict';
import { saveScan } from '../database/sqlite';
import { palette, radius, text, spacing } from '../theme/tokens';
import { ShieldAlert, Cloud, CloudOff, RefreshCcw, CheckCircle2, Loader } from 'lucide-react-native';

type Step = 'camera' | 'result';

export default function Scanner() {
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('camera');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [streamedRecommendation, setStreamedRecommendation] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20, textAlign: 'center', color: palette.textPrimary }}>
          Camera access is needed to detect crop diseases.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btnPrimary}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const reset = () => {
    setStep('camera');
    setPreview(null);
    setResult(null);
    setStreamedRecommendation(null);
    setIsStreaming(false);
  };

  const capture = async () => {
    if (!cameraRef.current || loading) return;
    if (!token) {
      alert("Please sign in before scanning."); // Changed to lowercase alert for simplicity if Alert isn't imported
      return;
    }
    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync();
      setPreview(photo.uri);
      
      const res = await uploadImage(photo.uri, token);
      const fallbackTimestamp = new Date().toISOString();
      const savedTimestamp = res?.timestamp ?? fallbackTimestamp;
      const diseaseName = res?.disease_name ?? 'uncertain';
      const confidence = res?.confidence ?? 0;
      const treatment = res?.treatment ?? 'Retake the image in better lighting and focus on one leaf or wheat head. Sync later when online.';

      await saveScan({
        disease_name: diseaseName,
        confidence,
        treatment,
        image_uri: photo.uri,
        timestamp: savedTimestamp,
        is_synced: res ? 1 : 0
      });

      setResult({
        disease_name: diseaseName,
        confidence,
        treatment,
        status: res ? 'saved_to_cloud' : 'saved_offline',
        timestamp: savedTimestamp
      });
      setStep('result');

      // Stream AI expert recommendation for non-healthy/uncertain results — mirrors web Diagnosis.tsx
      if (diseaseName.toLowerCase() !== 'healthy' && diseaseName.toLowerCase() !== 'uncertain') {
        setIsStreaming(true);
        setStreamedRecommendation('Connecting to agronomy expert...');
        streamRecommendation(
          diseaseName,
          token!,
          (status) => setStreamedRecommendation(status)
        ).then((answer) => {
          if (answer) setStreamedRecommendation(answer);
        }).finally(() => setIsStreaming(false));
      }
    } catch (err) {
      console.error("Capture or Save Error:", err);
      alert("Could not process the scan.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 'result' && result) {
    return (
      <ScrollView style={styles.containerBox} contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.headerTitle}>Diagnosis Result</Text>
        
        {preview && (
          <Image source={{ uri: preview }} style={styles.previewImage} />
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.diseaseTitle}>
              {result.disease_name === 'uncertain' ? 'Uncertain' : result.disease_name}
            </Text>
            <View style={[styles.badge, result.status === 'saved_to_cloud' ? styles.badgeSuccess : styles.badgeWarning]}>
              <Text style={[styles.badgeText, result.status === 'saved_to_cloud' ? {color: palette.success} : {color: palette.warning}]}>
                {result.status === 'saved_to_cloud' ? "Cloud Saved" : "Offline Pending"}
              </Text>
            </View>
          </View>

          <View style={styles.confidenceRow}>
            <Text style={{color: palette.textSecondary, fontSize: 13}}>Confidence</Text>
            <Text style={{fontWeight: '700', color: palette.textPrimary}}>{(result.confidence * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${result.confidence * 100}%` }]} />
          </View>

          <View style={styles.treatmentBox}>
            <View style={styles.treatmentTitleRow}>
              <Text style={styles.treatmentTitle}>Expert Recommendation</Text>
              {isStreaming && <ActivityIndicator size="small" color={palette.textMuted} />}
            </View>
            <Text style={styles.treatmentText}>{streamedRecommendation || result.treatment}</Text>
          </View>

          {result.disease_name === 'healthy' && (
            <View style={styles.healthyBox}>
              <CheckCircle2 color={palette.success} size={18} />
              <Text style={styles.healthyText}>No urgent treatment needed. Continue scouting and preventive care.</Text>
            </View>
          )}
          {result.disease_name === 'uncertain' && (
            <View style={styles.uncertainBox}>
              <CloudOff color={palette.warning} size={18} />
              <Text style={styles.uncertainText}>Retake the image in better lighting and focus on one leaf or wheat head before acting on this result.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.btnOutline} onPress={reset}>
          <RefreshCcw color={palette.primary} size={18} />
          <Text style={styles.btnOutlineText}>Scan Again</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing="back" mode="picture" />
      <View style={styles.overlay}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Analyzing crop image...</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.7} onPress={capture} style={styles.shutter} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  containerBox: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: palette.textPrimary, marginBottom: 16 },
  previewImage: { width: '100%', height: 250, borderRadius: radius.md, marginBottom: 16, backgroundColor: '#ddd' },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: palette.primarySoft, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  diseaseTitle: { fontSize: 20, fontWeight: '800', color: palette.textPrimary, textTransform: 'capitalize' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeSuccess: { backgroundColor: palette.successSoft },
  badgeWarning: { backgroundColor: palette.warningSoft },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: palette.border, borderRadius: 3, marginBottom: 20 },
  progressBarFill: { height: 6, backgroundColor: palette.primary, borderRadius: 3 },
  treatmentBox: { backgroundColor: palette.surfaceMuted, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.border, marginBottom: 16 },
  treatmentTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  treatmentTitle: { fontSize: 12, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase' },
  treatmentText: { fontSize: 14, color: palette.textPrimary, lineHeight: 22 },
  healthyBox: { flexDirection: 'row', gap: 10, backgroundColor: palette.successSoft, padding: 12, borderRadius: radius.sm, alignItems: 'center' },
  healthyText: { color: palette.success, fontSize: 13, flex: 1, fontWeight: '500' },
  uncertainBox: { flexDirection: 'row', gap: 10, backgroundColor: palette.warningSoft, padding: 12, borderRadius: radius.sm, alignItems: 'center' },
  uncertainText: { color: palette.warning, fontSize: 13, flex: 1, fontWeight: '500' },
  btnOutline: { flexDirection: 'row', gap: 8, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: palette.primary, justifyContent: 'center', alignItems: 'center' },
  btnOutlineText: { color: palette.primary, fontWeight: '700', fontSize: 16 },
  btnPrimary: { backgroundColor: palette.primary, padding: 15, borderRadius: 10 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150, justifyContent: 'center', alignItems: 'center' },
  loadingBox: { alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16 },
  loadingText: { color: '#fff', fontWeight: '600' },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', borderWidth: 6, borderColor: '#4CAF50' }
});