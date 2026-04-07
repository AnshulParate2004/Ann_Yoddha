import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

export interface ScanResult {
  id?: number;
  disease_name: string;
  confidence: number;
  treatment: string;
  image_uri: string;
  timestamp: string;
  is_synced: number; 
}

// Memory-only storage for Web so the UI doesn't break
let webHistory: ScanResult[] = [];

// Helper to get DB only on mobile
const getDb = () => {
  if (Platform.OS === 'web') return null;
  return SQLite.openDatabaseSync('ann_yoddha.db');
};

export const initDatabase = async () => {
  if (Platform.OS === 'web') {
    console.log("Web Mode: SQLite initialization skipped.");
    return;
  }

  const db = getDb();
  await db!.execAsync(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disease_name TEXT,
      confidence REAL,
      treatment TEXT,
      image_uri TEXT,
      timestamp TEXT,
      is_synced INTEGER DEFAULT 0
    );
  `);
};

export const saveScan = async (scan: ScanResult) => {
  if (Platform.OS === 'web') {
    console.log("Web Mode: Saving to temporary memory.");
    const savedScan = { ...scan, id: scan.id ?? Date.now() };
    webHistory = [savedScan, ...webHistory];
    return { lastInsertRowId: savedScan.id };
  }

  const db = getDb();
  return await db!.runAsync(
    'INSERT INTO scans (disease_name, confidence, treatment, image_uri, timestamp, is_synced) VALUES (?, ?, ?, ?, ?, ?)',
    [scan.disease_name, scan.confidence, scan.treatment, scan.image_uri, scan.timestamp, scan.is_synced]
  );
};

export const getHistory = async (): Promise<ScanResult[]> => {
  if (Platform.OS === 'web') {
    return webHistory;
  }

  const db = getDb();
  return await db!.getAllAsync('SELECT * FROM scans ORDER BY id DESC');
};

export const getUnsyncedScans = async (): Promise<ScanResult[]> => {
  if (Platform.OS === 'web') {
    return webHistory.filter((scan) => scan.is_synced === 0);
  }

  const db = getDb();
  return await db!.getAllAsync('SELECT * FROM scans WHERE is_synced = 0 ORDER BY id ASC');
};

export const markScansSynced = async (ids: number[]) => {
  if (ids.length === 0) {
    return;
  }

  if (Platform.OS === 'web') {
    webHistory = webHistory.map((scan) =>
      scan.id && ids.includes(scan.id) ? { ...scan, is_synced: 1 } : scan
    );
    return;
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  await db!.runAsync(`UPDATE scans SET is_synced = 1 WHERE id IN (${placeholders})`, ids);
};
