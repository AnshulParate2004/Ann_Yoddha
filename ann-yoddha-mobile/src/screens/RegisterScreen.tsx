import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await register(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Register once to keep diagnosis history and cloud sync connected.</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#7a7a7a"
          style={styles.input}
          value={email}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#7a7a7a"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <TextInput
          onChangeText={setConfirmPassword}
          placeholder="Confirm Password"
          placeholderTextColor="#7a7a7a"
          secureTextEntry
          style={styles.input}
          value={confirmPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity disabled={submitting} onPress={handleRegister} style={styles.primaryButton}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Register</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitchToLogin} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Already have an account?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f4f7ef',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#234d20',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#50624f',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d2dbcf',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fbfcf8',
  },
  error: {
    color: '#b3261e',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: '600',
  },
});
