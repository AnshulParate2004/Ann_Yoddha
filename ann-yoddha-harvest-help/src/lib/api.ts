const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("auth_token");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `Error ${res.status}`);
    }

    return res.json();
  }

  // Auth
  // Auth: handled by Supabase (signup/login in AuthContext). We only call getMe with the stored token.
  async getMe() {
    return this.request<{ user_id: string }>("/api/v1/auth/me");
  }

  // Farmer
  async getProfile() {
    return this.request<{
      farmer_id: string;
      user_id: string;
      name: string;
      phone: string;
      region: string;
      language: string;
    }>("/api/v1/farmers/me/profile");
  }

  async getHistory(limit = 50) {
    return this.request<Array<{
      id: string;
      disease_detected: string;
      severity: string;
      confidence: number;
      created_at: string;
    }>>(`/api/v1/farmers/me/history?limit=${limit}`);
  }

  // Diagnosis
  async uploadDiagnosis(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    return this.request<{
      status: string;
      detections: Array<{
        disease: string;
        confidence: number;
        severity?: string;
        bbox?: [number, number, number, number];
      }>;
    }>("/api/v1/diagnosis/upload", {
      method: "POST",
      body: formData,
    });
  }

  // Recommendations
  async getRecommendations(disease: string, severity?: string) {
    const params = new URLSearchParams({ disease });
    if (severity) params.append("severity", severity);
    return this.request<{
      disease: string;
      treatments: Array<{
        type: string;
        name: string;
        description: string;
        dosage?: string;
      }>;
    }>(`/api/v1/recommendations/?${params}`);
  }

  // Analytics
  async getHotspots(region?: string) {
    const params = region ? `?region=${encodeURIComponent(region)}` : "";
    return this.request<Array<{
      region: string;
      disease: string;
      count: number;
      severity: string;
    }>>(`/api/v1/analytics/hotspots${params}`);
  }

  async getPredictive() {
    return this.request<Array<{
      month: string;
      predicted_cases: number;
      disease: string;
    }>>("/api/v1/analytics/predictive");
  }

  // Health
  async health() {
    return this.request<{ status: string }>("/health");
  }
}

export const api = new ApiClient();
