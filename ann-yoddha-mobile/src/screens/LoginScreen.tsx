import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf, LockKeyhole, Mail } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { palette, radius, shadows, spacing, text } from "../theme/tokens";

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

export default function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useDemoCredentials = () => {
    setEmail("farmer_01@annyoddha.com");
    setPassword("FarmerPassword123!");
    setError(null);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <LinearGradient colors={[...palette.gradientCanvas]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView contentContainerStyle={styles.scrollWrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandHero}>
          <LinearGradient colors={[...palette.gradientHero]} style={styles.brandBadge}>
            <Leaf color={palette.white} size={24} />
          </LinearGradient>
          <Text style={styles.brandTitle}>Ann Yoddha</Text>
          <Text style={styles.brandSub}>Field-grade wheat diagnosis, expert recommendations, and AI voice chat built for daily use.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Continue to scanning, synced history, agronomist chat, and voice guidance.</Text>

          <View style={styles.inputWrap}>
            <Mail color={palette.textMuted} size={16} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.inputWrap}>
            <LockKeyhole color={palette.textMuted} size={16} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity disabled={submitting} onPress={handleLogin} style={styles.primaryButton}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={useDemoCredentials} style={styles.demoButton}>
            <Text style={styles.demoText}>Use Demo Farmer Account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitchToRegister} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Create new account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  orbTop: {
    position: "absolute",
    top: -110,
    right: -60,
    height: 240,
    width: 240,
    borderRadius: 120,
    backgroundColor: "rgba(220, 235, 220, 0.9)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -70,
    left: -50,
    height: 220,
    width: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 234, 210, 0.94)",
  },
  scrollWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    gap: spacing.xl,
  },
  brandHero: {
    gap: spacing.sm,
  },
  brandBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: text.display,
    lineHeight: 44,
    color: palette.textPrimary,
    fontWeight: "900",
  },
  brandSub: {
    fontSize: text.body,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "rgba(255, 253, 247, 0.94)",
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
    ...shadows.floating,
  },
  title: {
    fontSize: text.subtitle,
    color: palette.textPrimary,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: -4,
    fontSize: text.body,
    lineHeight: 21,
    color: palette.textSecondary,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: palette.textPrimary,
  },
  error: {
    color: palette.danger,
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: text.body,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: spacing.xs,
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    alignItems: "center",
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  demoButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  demoText: {
    color: palette.primaryDeep,
    fontWeight: "800",
    fontSize: text.body,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  secondaryText: {
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "700",
  },
});
