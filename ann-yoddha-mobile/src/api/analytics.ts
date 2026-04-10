import { BACKEND_URL } from '../utils/constants';

export async function getHistory(limit: number = 50, token: string) {
  const response = await fetch(`${BACKEND_URL}/history?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

export async function getHotspots(token: string, region?: string) {
  const params = region ? `?region=${encodeURIComponent(region)}` : "";
  const response = await fetch(`${BACKEND_URL}/api/v1/analytics/hotspots${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch hotspots');
  const data = await response.json();
  return data.hotspots || data || [];
}

export async function getPredictive(token: string) {
  const response = await fetch(`${BACKEND_URL}/api/v1/analytics/predictive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch predictive');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
