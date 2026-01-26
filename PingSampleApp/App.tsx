import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyScreen from './ui/JourneyScreen';
import BrowserScreen from './ui/BrowserScreen';
import LoggerScreen from './ui/LoggerScreen';
import OidcScreen from './ui/OidcScreen';
import { loginClient, loginClient2 } from './src/clients';
import { JourneyClient } from '@react-native-pingidentity/journey/lib/typescript/src/types';
import { configureBrowser } from '@react-native-pingidentity/browser';

export type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  Journey: { journeyClient: JourneyClient };
  Browser: undefined;
  Logger: undefined;
  Oidc: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Init login clients
    loginClient.init()
    loginClient2.init();

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
          toolbarColor: '#0057B8',
          navigationBarColor: '#001F3F',
        },
      },
    });
  }, []);
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
