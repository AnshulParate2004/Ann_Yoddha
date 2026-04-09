const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  name?: string;
  phone?: string;
  region?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

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

  async login(email: string, password: string) {
    const body = new URLSearchParams();
    body.append("username", email);
    body.append("password", password);

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(error.detail || "Login failed");
    }

    return response.json() as Promise<AuthResponse>;
  }

  async register(email: string, password: string, name?: string) {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  }

  async getMe() {
    return this.request<AuthUser>("/auth/me");
  }

  async getProfile() {
    const user = await this.getMe();
    return {
      farmer_id: String(user.id),
      user_id: String(user.id),
      name: user.name || user.email.split("@")[0],
      phone: user.phone || "-",
      region: user.region || "-",
      language: "en",
      email: user.email,
      role: user.role,
    };
  }

  async getHistory(limit = 50) {
    return this.request<{
      history: Array<{
        id: number;
        disease_name: string;
        confidence: number;
        treatment: string;
        image_url: string | null;
        timestamp: string;
      }>;
      limit: number;
    }>(`/history?limit=${limit}`);
  }

  async uploadDiagnosis(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    return this.request<{
      disease_name: string;
      confidence: number;
      treatment: string;
      timestamp: string;
      status: string;
    }>("/predict", {
      method: "POST",
      body: formData,
    });
  }

  async getHotspots(region?: string) {
    const params = region ? `?region=${encodeURIComponent(region)}` : "";
    const response = await this.request<{
      hotspots?: Array<{
        region: string;
        disease: string;
        count: number;
        severity: string;
      }>; message?: string
    }>(`/api/v1/analytics/hotspots${params}`);
    return response.hotspots || [];
  }

  async getPredictive() {
    const response = await this.request<{ message?: string } | Array<{
      month: string;
      predicted_cases: number;
      disease: string;
    }>>("/api/v1/analytics/predictive");
    return Array.isArray(response) ? response : [];
  }

  async streamRecommendation(disease: string) {
    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}/api/v1/recommendations/stream?disease=${encodeURIComponent(disease)}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`Streaming failed: ${response.status}`);
    }
    return response;
  }

  async streamChat(query: string, sessionId: string) {
    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(
      `${API_BASE}/api/v1/recommendations/chat/stream?query=${encodeURIComponent(query)}&session_id=${encodeURIComponent(sessionId)}`,
      { method: "GET", headers }
    );
    if (!response.ok) throw new Error(`Streaming failed: ${response.status}`);
    return response;
  }

  async getChatSessions() {
    return this.request<{ sessions: { session_id: string; first_message: string; created_at: string; message_count: number }[] }>("/api/v1/recommendations/chat/sessions");
  }

  async getSessionMessages(sessionId: string) {
    return this.request<{ messages: { id: string; role: string; content: string; created_at: string }[] }>(`/api/v1/recommendations/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  }

  async getChatHistory(sessionId?: string) {
    const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    return this.request<{ history: { id: string; role: string; content: string; created_at: string }[] }>(`/api/v1/recommendations/chat/history${qs}`);
  }

  // Health
  async health() {
    return this.request<{ status: string }>("/health");
  }

  // Azure Speech
  async getSpeechToken() {
    return this.request<{ token: string; region: string }>("/api/v1/speech/token");
  }
}

export const api = new ApiClient();
