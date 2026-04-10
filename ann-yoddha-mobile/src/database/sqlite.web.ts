export interface ScanResult {
  id?: number;
  disease_name: string;
  confidence: number;
  treatment: string;
  image_uri: string;
  timestamp: string;
  is_synced: number;
}

let webHistory: ScanResult[] = [];

export const initDatabase = async () => {
  console.log("Web Mode: SQLite initialization skipped.");
};

export const saveScan = async (scan: ScanResult) => {
  const savedScan = { ...scan, id: scan.id ?? Date.now() };
  webHistory = [savedScan, ...webHistory];
  return { lastInsertRowId: savedScan.id };
};

export const getHistory = async (): Promise<ScanResult[]> => {
  return webHistory;
};

export const getUnsyncedScans = async (): Promise<ScanResult[]> => {
  return webHistory.filter((scan) => scan.is_synced === 0);
};

export const markScansSynced = async (ids: number[]) => {
  if (ids.length === 0) {
    return;
  }

  webHistory = webHistory.map((scan) =>
    scan.id && ids.includes(scan.id) ? { ...scan, is_synced: 1 } : scan,
  );
};
