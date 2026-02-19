/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyScreen from './ui/JourneyScreen';
import BrowserScreen from './ui/BrowserScreen';
import LoggerScreen from './ui/LoggerScreen';
import OidcScreen from './ui/OidcScreen';
import DeviceProfileScreen from './ui/DeviceProfileScreen';
import { loginClient, loginClient2 } from './src/clients';
import { JourneyClient } from '@react-native-pingidentity/journey/lib/typescript/src/types';
import { configureLogger, logger } from '@ping-identity/rn-logger';
import { configureBrowser } from '@ping-identity/rn-browser';

export type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  Journey: { journeyClient: JourneyClient };
  Browser: undefined;
  Logger: undefined;
  Oidc: undefined;
  DeviceProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root sample app component that wires navigation and initializes demo clients.
 */
export default function App() {
  const browserLogger = useMemo(() => logger({ level: 'debug' }), []);

  useEffect(() => {
    // Init login clients
    loginClient.init();
    loginClient2.init();

    configureLogger({ level: 'info' });

    configureBrowser({
      android: {
        customTabs: {
          showTitle: false,
          urlBarHidingEnabled: true,
          colorScheme: 'dark',
        },
        authTabs: {
          ephemeral: true,
          colorScheme: 'dark',
          toolbarColor: '#5333a5',
          navigationBarColor: '#001F3F',
        },
      },
    }, {
      logger: browserLogger,
    });
  }, [browserLogger]);
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'PingIdentity Demo', headerShown: false }}
        />
        <Stack.Screen
          name="Storage"
          component={MultiStorageScreen}
          options={{ title: 'Storage' }}
        />
        <Stack.Screen
          name="Journey"
          component={JourneyScreen}
          options={{ title: 'Journey' }}
        />
        <Stack.Screen
          name="Browser"
          component={BrowserScreen}
          options={{ title: 'Browser Demo' }}
        />
        <Stack.Screen
          name="Logger"
          component={LoggerScreen}
          options={{ title: 'Logger Demo' }}
        />
        <Stack.Screen
          name="Oidc"
          component={OidcScreen}
          options={{ title: 'OIDC Demo' }}
        />
        <Stack.Screen
          name="DeviceProfile"
          component={DeviceProfileScreen}
          options={{ title: 'Device Profile' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
