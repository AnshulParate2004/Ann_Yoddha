import React, { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { LayoutDashboard, Scan, User, MessageSquare, BarChart3 } from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import Scanner from "../screens/Scanner";
import Dashboard from "../screens/Dashboard";
import Profile from "../screens/Profile";
import Analytics from "../screens/Analytics";
import Chat from "../screens/Chat";
import { palette, radius, text } from "../theme/tokens";

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
          headerStyle: styles.header,
          headerTintColor: "#fff",
          headerTitleStyle: styles.headerTitle,
          sceneStyle: { backgroundColor: palette.background },
          headerRight: () => null, // Logout moved to Profile screen
          tabBarIcon: ({ color, focused }) => {
            if (route.name === "Dashboard") return <LayoutDashboard color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
            if (route.name === "Diagnosis") return <Scan color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
            if (route.name === "Analytics") return <BarChart3 color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
            if (route.name === "Chat") return <MessageSquare color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
            if (route.name === "Profile") return <User color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
            return <LayoutDashboard color={color} size={22} strokeWidth={focused ? 2.4 : 2.1} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={Dashboard} options={{ title: "Overview", tabBarLabel: "Home" }} />
        <Tab.Screen name="Diagnosis" component={Scanner} options={{ title: "Scan Crop", tabBarLabel: "Scan" }} />
        <Tab.Screen name="Analytics" component={Analytics} options={{ title: "Analytics" }} />
        <Tab.Screen name="Chat" component={Chat} options={{ title: "Agronomist" }} />
        <Tab.Screen name="Profile" component={Profile} options={{ title: "Profile" }} />
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
  header: {
    backgroundColor: palette.primary,
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  logoutButton: {
    marginRight: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  tabBar: {
    height: Platform.OS === "ios" ? 84 : 74,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    paddingTop: 8,
    borderTopWidth: 0,
    backgroundColor: "#fffef9",
    shadowColor: "#101913",
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabItem: {
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  scanIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9ece7",
  },
  scanIconWrapFocused: {
    backgroundColor: palette.primary,
  },
});
