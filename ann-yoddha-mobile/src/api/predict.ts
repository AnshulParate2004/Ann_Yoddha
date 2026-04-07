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
