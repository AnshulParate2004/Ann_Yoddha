import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: {
    id: number;
    email: string;
    role: string;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem("auth_token"),
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const applyAuth = useCallback((token: string, user: { id: number; email: string; role: string }) => {
    localStorage.setItem("auth_token", token);
    setState({
      token,
      user,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem("auth_token");
    setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const verifyToken = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      clearAuth();
      return;
    }
    try {
      const user = await withTimeout(api.getMe(), 7000);
      setState({ token, user, isLoading: false, isAuthenticated: true });
    } catch {
      clearAuth();
    }
  }, [clearAuth]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      verifyToken();
    } else {
      clearAuth();
    }
  }, [clearAuth, verifyToken]);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    applyAuth(data.access_token, data.user);
  };

  const signup = async (email: string, password: string, name: string) => {
    void name;
    const data = await api.register(email, password);
    applyAuth(data.access_token, data.user);
  };

  const logout = async () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
