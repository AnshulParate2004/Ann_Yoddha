import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { History as HistoryIcon, LayoutDashboard, LogOut, Scan } from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import Scanner from '../screens/Scanner';
import History from '../screens/History';
import Dashboard from '../screens/Dashboard';

const Tab = createBottomTabNavigator();

function AuthFlow() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (mode === 'register') {
    return <RegisterScreen onSwitchToLogin={() => setMode('login')} />;
  }

  return <LoginScreen onSwitchToRegister={() => setMode('register')} />;
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#2e7d32" size="large" />
      <Text style={styles.loadingText}>Checking account...</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { loading, token, logout } = useAuth();

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
        screenOptions={{ 
          tabBarActiveTintColor: '#4CAF50',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <LogOut color="#fff" size={18} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={Dashboard} 
          options={{ 
            tabBarIcon: ({color}) => <LayoutDashboard color={color} size={24} /> 
          }} 
        />

        <Tab.Screen 
          name="Scanner" 
          component={Scanner} 
          options={{ 
            tabBarIcon: ({color}) => <Scan color={color} size={24} /> 
          }} 
        />

        <Tab.Screen 
          name="History" 
          component={History} 
          options={{ 
            tabBarIcon: ({color}) => <HistoryIcon color={color} size={24} /> 
          }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7ef',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#365a35',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
});
