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
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <ScrollView contentContainerStyle={styles.scrollWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <View style={styles.brandIconWrap}>
            <Leaf color={palette.primary} size={24} />
          </View>
          <Text style={styles.brandTitle}>Ann Yoddha</Text>
          <Text style={styles.brandSub}>Professional wheat diagnosis and field-ready treatment guidance.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue scanning, saving, and syncing crop diagnoses.</Text>

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
  blobTop: {
    position: "absolute",
    top: -90,
    right: -40,
    height: 230,
    width: 230,
    borderRadius: 120,
    backgroundColor: "#d5e6d8",
  },
  blobBottom: {
    position: "absolute",
    bottom: -70,
    left: -50,
    height: 200,
    width: 200,
    borderRadius: 100,
    backgroundColor: "#efe8d3",
  },
  scrollWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  brandBlock: {
    gap: spacing.sm,
  },
  brandIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    width: 44,
    borderRadius: radius.md,
    backgroundColor: palette.primarySoft,
  },
  brandTitle: {
    fontSize: text.hero,
    color: palette.textPrimary,
    fontWeight: "800",
  },
  brandSub: {
    fontSize: text.body,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
    ...shadows.card,
  },
  title: {
    fontSize: text.subtitle,
    color: palette.textPrimary,
    fontWeight: "800",
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
    backgroundColor: palette.surfaceMuted,
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
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  demoButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#cfdbc8",
    backgroundColor: "#eff5ec",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  demoText: {
    color: palette.primary,
    fontWeight: "700",
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
