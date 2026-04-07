import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { initDatabase } from './src/database/sqlite';

export default function App() {
  useEffect(() => {
    initDatabase()
      .then(() => console.log("Ann Yoddha DB Started"))
      .catch(err => console.error("Database failed:", err));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
