import React, { useRef, useState } from "react";
import { Alert, ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { CheckCircle2, Cloud, CloudOff, RefreshCcw, ScanSearch, Sparkles } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { uploadImage, streamRecommendation } from "../api/predict";
import { saveScan } from "../database/sqlite";
import { palette, radius, spacing, text } from "../theme/tokens";
import { ActionButton, AppScreen, GradientCard, SectionHeading, StatusChip, SurfaceCard } from "../components/AppSurface";

type Step = "camera" | "result";

export default function Scanner() {
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("camera");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [streamedRecommendation, setStreamedRecommendation] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const cameraRef = useRef<any>(null);

  const reset = () => {
    setStep("camera");
    setPreview(null);
    setResult(null);
    setStreamedRecommendation(null);
    setIsStreaming(false);
  };

  const capture = async () => {
    if (!cameraRef.current || loading) return;
    if (!token) {
      Alert.alert("Sign in required", "Please sign in before scanning.");
      return;
    }

    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync();
      setPreview(photo.uri);

      const res = await uploadImage(photo.uri, token);
      const fallbackTimestamp = new Date().toISOString();
      const savedTimestamp = res?.timestamp ?? fallbackTimestamp;
      const diseaseName = res?.disease_name ?? "uncertain";
      const confidence = res?.confidence ?? 0;
      const treatment =
        res?.treatment ??
        "Retake the image in better lighting and focus on one leaf or wheat head. Sync later when online.";

      await saveScan({
        disease_name: diseaseName,
        confidence,
        treatment,
        image_uri: photo.uri,
        timestamp: savedTimestamp,
        is_synced: res ? 1 : 0,
      });

      setResult({
        disease_name: diseaseName,
        confidence,
        treatment,
        status: res ? "saved_to_cloud" : "saved_offline",
        timestamp: savedTimestamp,
      });
      setStep("result");

      if (diseaseName.toLowerCase() !== "healthy" && diseaseName.toLowerCase() !== "uncertain") {
        setIsStreaming(true);
        setStreamedRecommendation("Connecting to agronomy expert...");
        streamRecommendation(diseaseName, token, (status) => setStreamedRecommendation(status))
          .then((answer) => {
            if (answer) setStreamedRecommendation(answer);
          })
          .finally(() => setIsStreaming(false));
      }
    } catch (error) {
      console.error("Capture or Save Error:", error);
      Alert.alert("Scan failed", "Could not process the scan.");
    } finally {
      setLoading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <AppScreen contentContainerStyle={styles.permissionContent}>
        <GradientCard>
          <Text style={styles.permissionEyebrow}>Camera access</Text>
          <Text style={styles.permissionTitle}>Enable crop scanning</Text>
          <Text style={styles.permissionText}>Camera access is required to capture leaves and wheat heads for diagnosis.</Text>
        </GradientCard>
        <SurfaceCard>
          <ActionButton label="Grant permission" onPress={requestPermission} />
        </SurfaceCard>
      </AppScreen>
    );
  }

  if (step === "result" && result) {
    const isHealthy = result.disease_name === "healthy";
    const isUncertain = result.disease_name === "uncertain";
    const isSynced = result.status === "saved_to_cloud";

    return (
      <AppScreen>
        <SectionHeading
          eyebrow="Diagnosis"
          title="Scan result"
          subtitle="A simplified result card with the diagnosis, confidence, and next action."
        />

        {preview ? <Image source={{ uri: preview }} style={styles.previewImage} /> : null}

        <SurfaceCard>
          <View style={styles.resultHeader}>
            <View style={styles.resultTitleWrap}>
              <Text style={styles.resultTitle}>{isUncertain ? "Uncertain" : result.disease_name}</Text>
              <Text style={styles.resultMeta}>Confidence {(result.confidence * 100).toFixed(1)}%</Text>
            </View>
            <StatusChip label={isSynced ? "Saved to cloud" : "Offline pending"} tone={isSynced ? "success" : "warning"} />
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(result.confidence * 100, 6)}%` }]} />
          </View>

          <SurfaceCard style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <View style={styles.recommendationTitleWrap}>
                <Sparkles color={palette.primary} size={16} />
                <Text style={styles.recommendationTitle}>Expert recommendation</Text>
              </View>
              {isStreaming ? <ActivityIndicator size="small" color={palette.textMuted} /> : null}
            </View>
            <Text style={styles.recommendationText}>{streamedRecommendation || result.treatment}</Text>
          </SurfaceCard>

          {isHealthy ? (
            <View style={[styles.callout, styles.calloutSuccess]}>
              <CheckCircle2 color={palette.success} size={18} />
              <Text style={styles.calloutTextSuccess}>No urgent treatment needed. Continue scouting and preventive care.</Text>
            </View>
          ) : null}

          {isUncertain ? (
            <View style={[styles.callout, styles.calloutWarning]}>
              <CloudOff color={palette.warning} size={18} />
              <Text style={styles.calloutTextWarning}>Retake the image in better lighting and focus on one leaf or wheat head before acting on this result.</Text>
            </View>
          ) : null}

          <View style={styles.resultFooter}>
            {isSynced ? <Cloud color={palette.success} size={14} /> : <CloudOff color={palette.warning} size={14} />}
            <Text style={styles.resultFooterText}>{new Date(result.timestamp).toLocaleString()}</Text>
          </View>
        </SurfaceCard>

        <ActionButton
          label="Scan again"
          onPress={reset}
          tone="secondary"
          icon={<RefreshCcw color={palette.primary} size={18} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <GradientCard>
        <Text style={styles.permissionEyebrow}>Capture</Text>
        <Text style={styles.permissionTitle}>Scan a crop image</Text>
        <Text style={styles.permissionText}>Frame one leaf or wheat head clearly. Better light and tighter focus improve the result.</Text>
      </GradientCard>

      <SurfaceCard style={styles.cameraCard}>
        <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" mode="picture" />
        <View style={styles.cameraOverlay}>
          <View style={styles.focusFrame} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Tips"
          title="Before you capture"
          subtitle="Keep it to a single surface, avoid blur, and hold steady for a second before pressing scan."
        />
        <View style={styles.tipList}>
          <View style={styles.tipRow}>
            <ScanSearch color={palette.primary} size={18} />
            <Text style={styles.tipText}>Fill most of the frame with the affected area.</Text>
          </View>
          <View style={styles.tipRow}>
            <Sparkles color={palette.accent} size={18} />
            <Text style={styles.tipText}>Natural daylight usually produces the cleanest diagnosis.</Text>
          </View>
        </View>
      </SurfaceCard>

      <ActionButton
        label={loading ? "Analyzing crop image..." : "Capture and analyze"}
        onPress={capture}
        disabled={loading}
        icon={loading ? <ActivityIndicator color={palette.white} /> : <ScanSearch color={palette.white} size={18} />}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  permissionContent: {
    justifyContent: "center",
    minHeight: "100%",
  },
  permissionEyebrow: {
    color: "#dfeadf",
    fontSize: text.caption,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  permissionTitle: {
    marginTop: spacing.xs,
    color: palette.white,
    fontSize: text.title,
    fontWeight: "900",
  },
  permissionText: {
    marginTop: spacing.sm,
    color: "#e7f0ea",
    fontSize: text.body,
    lineHeight: 22,
  },
  cameraCard: {
    padding: spacing.sm,
    overflow: "hidden",
  },
  cameraPreview: {
    height: 340,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  focusFrame: {
    width: "62%",
    aspectRatio: 1,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tipList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 21,
  },
  previewImage: {
    width: "100%",
    height: 250,
    borderRadius: radius.xl,
    backgroundColor: "#d9d9d9",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  resultTitleWrap: {
    flex: 1,
  },
  resultTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  resultMeta: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "700",
  },
  progressTrack: {
    marginTop: spacing.md,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  recommendationCard: {
    marginTop: spacing.lg,
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    padding: spacing.md,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  recommendationTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recommendationTitle: {
    color: palette.textPrimary,
    fontSize: text.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  recommendationText: {
    marginTop: spacing.sm,
    color: palette.textPrimary,
    fontSize: text.body,
    lineHeight: 22,
  },
  callout: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  calloutSuccess: {
    backgroundColor: palette.successSoft,
  },
  calloutWarning: {
    backgroundColor: palette.warningSoft,
  },
  calloutTextSuccess: {
    flex: 1,
    color: palette.success,
    fontSize: text.body,
    fontWeight: "600",
  },
  calloutTextWarning: {
    flex: 1,
    color: palette.warning,
    fontSize: text.body,
    fontWeight: "600",
  },
  resultFooter: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  resultFooterText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});
