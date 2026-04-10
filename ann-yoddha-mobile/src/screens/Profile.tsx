import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Globe, LogOut, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import { getProfile } from "../api/profile";
import { palette, spacing, text } from "../theme/tokens";
import { ActionButton, AppScreen, GradientCard, SectionHeading, StatusChip, SurfaceCard } from "../components/AppSurface";

function getInitials(value?: string | null) {
  if (!value) return "AY";
  const parts = value.split(" ").filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AY";
}

export default function Profile() {
  const { token, user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (token) {
      getProfile(token)
        .then((data) => {
          if (active) setProfile(data);
        })
        .catch(console.error)
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [token]);

  const displayName = profile?.name || user?.name || user?.email?.split("@")[0] || "Farmer";
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <AppScreen>
      <GradientCard colors={palette.gradientAccent}>
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Account</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>Your identity, sync access, and field profile in one place.</Text>
          </View>
        </View>
        <View style={styles.heroMetaWrap}>
          <StatusChip label="Protected account" tone="primary" />
          <StatusChip label={profile?.role || user?.role || "farmer"} tone="default" />
        </View>
      </GradientCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Farmer profile"
          title="Account details"
          subtitle="Kept minimal on mobile so the essentials are visible immediately."
          right={loading ? <ActivityIndicator color={palette.primary} /> : <ShieldCheck color={palette.primary} size={18} />}
        />

        <View style={styles.detailList}>
          <DetailRow icon={<User color={palette.primary} size={18} />} label="Full name" value={profile?.name || "-"} />
          <DetailRow icon={<Phone color={palette.primary} size={18} />} label="Phone" value={profile?.phone || "-"} />
          <DetailRow icon={<MapPin color={palette.primary} size={18} />} label="Region" value={profile?.region || "-"} />
          <DetailRow icon={<Globe color={palette.primary} size={18} />} label="Language" value={profile?.language || "en"} />
          <DetailRow icon={<Mail color={palette.primary} size={18} />} label="Email" value={profile?.email || user?.email || "-"} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          eyebrow="Session"
          title="Manage access"
          subtitle="Signing out clears the secure token stored on this device."
        />
        <View style={styles.actionWrap}>
          <ActionButton label="Sign out" onPress={logout} tone="secondary" icon={<LogOut color={palette.danger} size={18} />} />
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: palette.primaryDeep,
    fontSize: 24,
    fontWeight: "900",
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroEyebrow: {
    color: "#7a5a20",
    fontSize: text.caption,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: text.title,
    lineHeight: 31,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 21,
  },
  heroMetaWrap: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: palette.textMuted,
    fontSize: text.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  detailValue: {
    marginTop: 4,
    color: palette.textPrimary,
    fontSize: text.body,
    fontWeight: "700",
  },
  actionWrap: {
    marginTop: spacing.md,
  },
});
