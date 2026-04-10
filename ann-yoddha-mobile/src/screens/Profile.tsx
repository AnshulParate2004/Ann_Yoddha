import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../api/profile';
import { palette, text, radius } from '../theme/tokens';
import { User, Phone, MapPin, Globe, LogOut } from 'lucide-react-native';

export default function Profile() {
  const { token, user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getProfile(token).then(setProfile).catch(console.error).finally(() => setLoading(false));
    }
  }, [token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Farmer Information</Text>
        
        {loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <View style={styles.infoContainer}>
            <View style={styles.row}>
              <View style={styles.iconBox}><User color={palette.primary} size={20} /></View>
              <View>
                <Text style={styles.label}>Full Name</Text>
                <Text style={styles.value}>{profile?.name || '-'}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.iconBox}><Phone color={palette.primary} size={20} /></View>
              <View>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{profile?.phone || '-'}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.iconBox}><MapPin color={palette.primary} size={20} /></View>
              <View>
                <Text style={styles.label}>Region</Text>
                <Text style={styles.value}>{profile?.region || '-'}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.iconBox}><Globe color={palette.primary} size={20} /></View>
              <View>
                <Text style={styles.label}>Language</Text>
                <Text style={styles.value}>{profile?.language || '-'}</Text>
              </View>
            </View>

            <View style={styles.emailSeparator} />
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile?.email || user?.email || '-'}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <LogOut color={palette.danger} size={20} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: palette.textPrimary, marginBottom: 20 },
  card: { backgroundColor: palette.surface, borderRadius: radius.md, padding: 20, borderWidth: 1, borderColor: palette.primarySoft },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, color: palette.textPrimary },
  infoContainer: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { padding: 8, backgroundColor: palette.primarySoft, borderRadius: radius.sm },
  label: { fontSize: 12, color: palette.textSecondary },
  value: { fontSize: 15, fontWeight: '500', color: palette.textPrimary, marginTop: 2 },
  emailSeparator: { height: 1, backgroundColor: palette.border, marginVertical: 8 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40, padding: 16, backgroundColor: palette.dangerSoft, borderRadius: radius.md },
  logoutText: { color: palette.danger, fontWeight: '600', fontSize: 16 }
});
