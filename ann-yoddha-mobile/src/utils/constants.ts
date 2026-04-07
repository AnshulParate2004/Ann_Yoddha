import { Platform } from 'react-native';

const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

const defaultBackendUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://127.0.0.1:8000';

export const BACKEND_URL = envBackendUrl || defaultBackendUrl;
