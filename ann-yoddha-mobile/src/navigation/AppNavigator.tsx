import React, { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { LayoutDashboard, Scan, User, MessageSquare, BarChart3 } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import Scanner from "../screens/Scanner";
import Dashboard from "../screens/Dashboard";
import Profile from "../screens/Profile";
import Analytics from "../screens/Analytics";
import Chat from "../screens/Chat";
import { palette, radius, shadows, text } from "../theme/tokens";

const Tab = createBottomTabNavigator();

function AuthFlow() {
  const [mode, setMode] = useState<"login" | "register">("login");

  if (mode === "register") {
    return <RegisterScreen onSwitchToLogin={() => setMode("login")} />;
  }

  return <LoginScreen onSwitchToRegister={() => setMode("register")} />;
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={styles.loadingText}>Checking account...</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { loading, token } = useAuth();

  if (loading) {
    return (
      <NavigationContainer>
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  if (!token) {
    return (
      <NavigationContainer>
        <AuthFlow />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarHideOnKeyboard: true,
          headerTintColor: "#fff",
          headerTitleStyle: styles.headerTitle,
          headerTitleAlign: "left",
          headerShadowVisible: false,
          headerBackground: () => <LinearGradient colors={[...palette.gradientHero]} style={StyleSheet.absoluteFillObject} />,
          sceneStyle: { backgroundColor: palette.background },
          headerRight: () => null, // Logout moved to Profile screen
          tabBarIcon: ({ color, focused }) => {
            const icon =
              route.name === "Dashboard" ? <LayoutDashboard color={color} size={20} strokeWidth={focused ? 2.5 : 2.1} /> :
              route.name === "Diagnosis" ? <Scan color={color} size={20} strokeWidth={focused ? 2.5 : 2.1} /> :
              route.name === "Analytics" ? <BarChart3 color={color} size={20} strokeWidth={focused ? 2.5 : 2.1} /> :
              route.name === "Chat" ? <MessageSquare color={color} size={20} strokeWidth={focused ? 2.5 : 2.1} /> :
              <User color={color} size={20} strokeWidth={focused ? 2.5 : 2.1} />;

            return <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>{icon}</View>;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={Dashboard} options={{ title: "Overview", tabBarLabel: "Home" }} />
        <Tab.Screen name="Diagnosis" component={Scanner} options={{ title: "Scan Crop", tabBarLabel: "Scan" }} />
        <Tab.Screen name="Analytics" component={Analytics} options={{ title: "Analytics", tabBarLabel: "Stats" }} />
        <Tab.Screen name="Chat" component={Chat} options={{ title: "Agronomist", tabBarLabel: "Chat" }} />
        <Tab.Screen name="Profile" component={Profile} options={{ title: "Profile", tabBarLabel: "Me" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.background,
    gap: 12,
  },
  loadingText: {
    fontSize: text.body,
    color: palette.textSecondary,
    fontWeight: "700",
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: 0.2,
    fontSize: 17,
  },
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    height: Platform.OS === "ios" ? 78 : 72,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    paddingTop: 6,
    borderTopWidth: 0,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,253,247,0.96)",
    ...shadows.floating,
  },
  tabItem: {
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconWrapActive: {
    backgroundColor: palette.primarySoft,
  },
});
