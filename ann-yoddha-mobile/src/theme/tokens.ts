export const palette = {
  background: "#f6f4ea",
  backgroundSecondary: "#eef2e6",
  surface: "#fffdf7",
  surfaceRaised: "#ffffff",
  surfaceMuted: "#f2f2ea",
  primary: "#2f6d4f",
  primaryDeep: "#1f4f39",
  primarySoft: "#dcebdc",
  accent: "#d8a451",
  accentSoft: "#f4ead2",
  textPrimary: "#17211c",
  textSecondary: "#55655d",
  textMuted: "#7c877f",
  border: "#d7dfd2",
  borderStrong: "#bfd0bf",
  success: "#2f7a47",
  successSoft: "#e7f4e8",
  warning: "#af6d1e",
  warningSoft: "#fff2de",
  danger: "#b04736",
  dangerSoft: "#fdebe6",
  info: "#2f6f87",
  infoSoft: "#e6f3f7",
  overlay: "rgba(15, 23, 18, 0.66)",
  dark: "#0f1514",
  white: "#ffffff",
  gradientCanvas: ["#f8f6ee", "#edf3e6", "#dfe8d8"] as const,
  gradientHero: ["#346f50", "#1f4f39"] as const,
  gradientAccent: ["#f1e2bf", "#d8a451"] as const,
  voiceListening: ["#35b86f", "#1f8a53"] as const,
  voiceThinking: ["#4d7ef0", "#2e58c6"] as const,
  voiceSpeaking: ["#2f6d4f", "#d8a451"] as const,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  xxxl: 38,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const text = {
  display: 42,
  hero: 34,
  title: 26,
  subtitle: 18,
  body: 15,
  caption: 12,
};

export const shadows = {
  card: {
    shadowColor: "#122117",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floating: {
    shadowColor: "#122117",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
};
