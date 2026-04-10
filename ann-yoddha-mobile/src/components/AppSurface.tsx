import React from "react";
import {
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette, radius, shadows, spacing, text } from "../theme/tokens";

export function AppScreen({
  children,
  contentContainerStyle,
  ...props
}: ScrollViewProps) {
  return (
    <View style={styles.screen}>
      <LinearGradient colors={[...palette.gradientCanvas]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <SafeAreaView edges={["left", "right"]} style={styles.safeArea}>
        <ScrollView
          {...props}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function SurfaceCard({
  children,
  style,
  density = "default",
  ...props
}: ViewProps & { style?: StyleProp<ViewStyle>; density?: "compact" | "default" | "feature" }) {
  return (
    <View {...props} style={[styles.card, densityStyles[density], style]}>
      {children}
    </View>
  );
}

export function GradientCard({
  children,
  colors = palette.gradientHero,
  style,
}: {
  children: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={colors} style={[styles.gradientCard, style]}>
      {children}
    </LinearGradient>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headingSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function StatusChip({
  label,
  tone = "default",
  style,
  textStyle,
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.chip, chipToneStyles[tone], style]}>
      <Text style={[styles.chipText, chipToneTextStyles[tone], textStyle]}>{label}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  tone = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  tone?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonToneStyles[tone],
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, buttonToneTextStyles[tone]]}>{label}</Text>
    </Pressable>
  );
}

const chipToneStyles = StyleSheet.create({
  default: { backgroundColor: palette.surfaceMuted },
  success: { backgroundColor: palette.successSoft },
  warning: { backgroundColor: palette.warningSoft },
  danger: { backgroundColor: palette.dangerSoft },
  primary: { backgroundColor: palette.primarySoft },
});

const densityStyles = StyleSheet.create({
  compact: { padding: spacing.md },
  default: { padding: spacing.lg },
  feature: { padding: spacing.xl },
});

const chipToneTextStyles = StyleSheet.create({
  default: { color: palette.textSecondary },
  success: { color: palette.success },
  warning: { color: palette.warning },
  danger: { color: palette.danger },
  primary: { color: palette.primaryDeep },
});

const buttonToneStyles = StyleSheet.create({
  primary: { backgroundColor: palette.primary },
  secondary: { backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.border },
  ghost: { backgroundColor: palette.surfaceMuted },
});

const buttonToneTextStyles = StyleSheet.create({
  primary: { color: palette.white },
  secondary: { color: palette.textPrimary },
  ghost: { color: palette.primaryDeep },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl + 96,
    gap: spacing.lg,
  },
  orbTop: {
    position: "absolute",
    top: -110,
    right: -44,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(220, 235, 220, 0.92)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -70,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 234, 210, 0.9)",
  },
  card: {
    backgroundColor: "rgba(255, 253, 247, 0.92)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.card,
  },
  gradientCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.floating,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headingCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: palette.textMuted,
    fontSize: text.caption,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headingTitle: {
    color: palette.textPrimary,
    fontSize: text.title,
    lineHeight: 30,
    fontWeight: "700",
  },
  headingSubtitle: {
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 21,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
