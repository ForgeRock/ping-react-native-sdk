import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyHelperScreen from './ui/JourneyHelperScreen';
import BrowserScreen from './ui/BrowserScreen';
import LoggerScreen from './ui/LoggerScreen';
import OidcScreen from './ui/OidcScreen';
import DeviceProfileScreen from './ui/DeviceProfileScreen';
import { JourneyProvider } from '@ping-identity/rn-journey';
import { loginClient } from './src/clients';
import { configureBrowser } from '@react-native-pingidentity/browser';
import { configureLogger } from '@react-native-pingidentity/logger';

export type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  JourneyHelper: undefined;
  Browser: undefined;
  Logger: undefined;
  Oidc: undefined;
  DeviceProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Init login clients
    loginClient.init();

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
    });
  }, []);
  return (
    <JourneyProvider client={loginClient}>
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
            name="JourneyHelper"
            component={JourneyHelperScreen}
            options={{ title: 'Journey (helper-driven)' }}
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
    </JourneyProvider>
  );
}
