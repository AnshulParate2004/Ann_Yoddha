import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { uploadImage } from '../api/predict';
import { saveScan } from '../database/sqlite';

export default function Scanner() {
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20, textAlign: 'center' }}>
          Camera access is needed to detect wheat diseases.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || loading) return;
    if (!token) {
      Alert.alert("Login required", "Please sign in before scanning.");
      return;
    }
    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync();
      console.log("Image captured at:", photo.uri);
      const result = await uploadImage(photo.uri, token);
      const fallbackTimestamp = new Date().toISOString();
      const savedTimestamp = result?.timestamp ?? fallbackTimestamp;
      const diseaseName = result?.disease_name ?? 'uncertain';
      const confidence = result?.confidence ?? 0;
      const treatment =
        result?.treatment ??
        'Retake the image in better lighting and focus on one leaf or wheat head. Sync later when online.';

      await saveScan({
        disease_name: diseaseName,
        confidence,
        treatment,
        image_uri: photo.uri,
        timestamp: savedTimestamp,
        is_synced: result ? 1 : 0
      });

      console.log("Scan saved to SQLite successfully");

      if (result) {
        Alert.alert(
          "Diagnosis Complete",
          `Disease: ${result.disease_name}\nConfidence: ${Math.round(result.confidence * 100)}%\nTreatment: ${result.treatment}\nStatus: Saved to cloud`
        );
      } else {
        Alert.alert(
          "Saved Offline",
          "Cloud diagnosis was unavailable. The scan was saved locally and will sync later."
        );
      }

    } catch (err) {
      console.error("Capture or Save Error:", err);
      Alert.alert("Error", "Could not save the scan. Check camera permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Ensure the CameraView has no children between <CameraView> and </CameraView> */}
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        ref={cameraRef} 
        facing="back" 
        mode="picture" 
      />
      {/* The UI layer sits independently on top */}
      <View style={styles.overlay}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Analyzing crop image...</Text>
          </View>
        ) : (
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={capture} 
            style={styles.shutter} 
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  overlay: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
  },
  loadingText: {
    color: '#fff',
    fontWeight: '600',
  },
  shutter: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'white', 
    borderWidth: 6, // Fixed from borderWeight
    borderColor: '#4CAF50' 
  },
  btn: { 
    backgroundColor: '#4CAF50', 
    padding: 15, 
    borderRadius: 10 
  }
});