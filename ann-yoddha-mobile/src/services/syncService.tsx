import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { BACKEND_URL } from '../utils/constants';
import { getUnsyncedScans, markScansSynced } from '../database/sqlite';

interface SyncResponse {
  synced_count: number;
  synced_scans: Array<{
    local_id: number | null;
    cloud_id: number;
    timestamp: string;
  }>;
  status: string;
}

export const syncOfflineScans = async (token: string) => {
  if (Platform.OS === 'web') {
    console.log("Web Mode: Sync uses fetch with local memory fallback.");
  }

  const state = await Network.getNetworkStateAsync();

  if (!state.isConnected) {
    throw new Error("No internet connection");
  }

  const unsynced = await getUnsyncedScans();

  if (unsynced.length === 0) {
    return { syncedCount: 0 };
  }

  const response = await fetch(`${BACKEND_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      scans: unsynced.map((scan) => ({
        local_id: scan.id ?? null,
        disease_name: scan.disease_name,
        confidence: scan.confidence,
        treatment: scan.treatment,
        image_url: scan.image_uri,
        timestamp: scan.timestamp,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Cloud sync failed');
  }

  const result = (await response.json()) as SyncResponse;
  const syncedIds = result.synced_scans
    .map((scan) => scan.local_id)
    .filter((id): id is number => typeof id === 'number');

  await markScansSynced(syncedIds);

  return { syncedCount: result.synced_count };
};
