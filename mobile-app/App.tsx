import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { initDatabase } from './src/db/database';
import { useSyncStore } from './src/store/useSyncStore';
import * as Network from 'expo-network';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const [isReady, setIsReady] = React.useState(false);
  const { setOnline, checkConnection } = useSyncStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize DB
        await initDatabase();

        // Initial connection check
        await checkConnection();

        setIsReady(true);
      } catch (e) {
        console.warn(e);
      }
    }

    prepare();

    // Subscribe to network changes
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
