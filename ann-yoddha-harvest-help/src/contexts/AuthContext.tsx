import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface AuthState {
  token: string | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem("auth_token"),
    userId: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const setSession = useCallback((session: Session | null) => {
    if (session?.access_token) {
      localStorage.setItem("auth_token", session.access_token);
      setState({
        token: session.access_token,
        userId: session.user?.id ?? null,
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      localStorage.removeItem("auth_token");
      setState({ token: null, userId: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const verifyToken = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setState({ token: null, userId: null, isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const data = await api.getMe();
      setState(s => ({ ...s, userId: data.user_id, isLoading: false, isAuthenticated: true }));
    } catch {
      localStorage.removeItem("auth_token");
      setState({ token: null, userId: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
      } else {
        setSession(null);
      }
    });

    const token = localStorage.getItem("auth_token");
    if (token) {
      verifyToken();
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }

    return () => subscription.unsubscribe();
  }, [setSession, verifyToken]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.session) setSession(data.session);
  };

  const signup = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    if (data.session) {
      setSession(data.session);
    } else if (data.user) {
      // Email confirmation may be required; user exists but no session yet
      throw new Error(
        "Check your email to confirm your account. Then sign in."
      );
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("auth_token");
    setState({ token: null, userId: null, isLoading: false, isAuthenticated: false });
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
