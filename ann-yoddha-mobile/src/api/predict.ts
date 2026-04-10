import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { BACKEND_URL } from '../utils/constants';

export interface PredictResponse {
  disease_name: string;
  confidence: number;
  treatment: string;
  timestamp: string;
  status: string;
}

export const uploadImage = async (uri: string, token: string): Promise<PredictResponse | null> => {
  try {
    if (Platform.OS === 'web') {
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      const formData = new FormData();
      formData.append('image', blob, 'scan.jpg');

      const response = await fetch(`${BACKEND_URL}/predict`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        return (await response.json()) as PredictResponse;
      }

      console.warn('Server responded with:', response.status);
      return null;
    }

    const response = await FileSystem.uploadAsync(`${BACKEND_URL}/predict`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200) {
      return JSON.parse(response.body) as PredictResponse;
    }

    console.warn('Server responded with:', response.status);
    return null;
  } catch (e) {
    console.error('Upload Error:', e);
    return null;
  }
};

/**
 * Streams an AI expert recommendation for a given disease name.
 * Mirrors the web app's api.streamRecommendation() → /api/v1/recommendations/stream
 * Parses SSE events and returns the final answer string.
 */
export const streamRecommendation = async (
  disease: string,
  token: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/recommendations/stream?disease=${encodeURIComponent(disease)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Streaming failed: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n');
    let finalAnswer = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.event === 'status' && onProgress) {
            onProgress(`⏳ ${data.message}`);
          } else if (data.event === 'final_result') {
            finalAnswer = data.data.answer;
          } else if (data.event === 'error') {
            finalAnswer = `❌ Error: ${data.message}`;
          }
        } catch (_) {}
      }
    }

    return finalAnswer || '';
  } catch (e) {
    console.error('streamRecommendation Error:', e);
    return '';
  }
};

