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
import { LockKeyhole, Mail, UserRoundPlus } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { palette, radius, shadows, spacing, text } from "../theme/tokens";

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await register(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <View style={styles.brandBlock}>
          <View style={styles.brandIconWrap}>
            <UserRoundPlus color={palette.primaryDeep} size={22} />
          </View>
          <Text style={styles.brandTitle}>Create your account</Text>
          <Text style={styles.brandSub}>One secure account keeps diagnoses, analytics, and agronomist conversations in sync.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.subtitle}>Use a working email and a strong password for secure access.</Text>

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
              placeholder="Password (min 8 characters)"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <View style={styles.inputWrap}>
            <LockKeyhole color={palette.textMuted} size={16} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={styles.input}
              value={confirmPassword}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity disabled={submitting} onPress={handleRegister} style={styles.primaryButton}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitchToLogin} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Already have an account? Sign in</Text>
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
    top: -100,
    left: -50,
    height: 230,
    width: 230,
    borderRadius: 120,
    backgroundColor: "rgba(220, 235, 220, 0.88)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -80,
    right: -40,
    height: 220,
    width: 220,
    borderRadius: 120,
    backgroundColor: "rgba(244, 234, 210, 0.94)",
  },
  scrollWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    gap: spacing.xl,
  },
  brandBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  brandIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: palette.accentSoft,
  },
  brandTitle: {
    fontSize: text.title,
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
