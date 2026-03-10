/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TextInput } from 'react-native';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyRouteScreen from './ui/JourneyRouteScreen';
import JourneyHelperScreen from './ui/JourneyHelperScreen';
import JourneyFullScreen from './ui/JourneyFullScreen';
import BrowserScreen from './ui/BrowserScreen';
import LoggerScreen from './ui/LoggerScreen';
import OidcScreen from './ui/OidcScreen';
import DeviceProfileScreen from './ui/DeviceProfileScreen';
import UserProfileScreen from './ui/UserProfileScreen';
import TokenScreen from './ui/TokenScreen';
import LogoutScreen from './ui/LogoutScreen';
import { JourneyProvider } from '@ping-identity/rn-journey';
import { OidcProvider } from '@ping-identity/rn-oidc';
import { loginClient, sampleOidcWebClient } from './src/clients';
import { configureBrowser } from '@ping-identity/rn-browser';
import { configureLogger, logger } from '@ping-identity/rn-logger';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './src/styles/colors';

type ComponentWithDefaultStyle = {
  defaultProps?: {
    style?: unknown;
    [key: string]: unknown;
  };
};

export type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  JourneyRoute: undefined;
  JourneyHelper: { journeyName?: string } | undefined;
  JourneyFull: undefined;
  Browser: undefined;
  Logger: undefined;
  Oidc: undefined;
  DeviceProfile: undefined;
  UserProfile: undefined;
  Token: undefined;
  Logout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root sample app component that wires navigation and initializes demo clients.
 */
export default function App() {
  const browserLogger = useMemo(() => logger({ level: 'debug' }), []);

  useEffect(() => {
    const textComponent = Text as unknown as ComponentWithDefaultStyle;
    const textDefaults = textComponent.defaultProps ?? {};
    textComponent.defaultProps = {
      ...textDefaults,
      style: [textDefaults.style, { fontFamily: 'Montserrat-Regular' }],
    };

    const textInputComponent = TextInput as unknown as ComponentWithDefaultStyle;
    const textInputDefaults = textInputComponent.defaultProps ?? {};
    textInputComponent.defaultProps = {
      ...textInputDefaults,
      style: [textInputDefaults.style, { fontFamily: 'Montserrat-Regular' }],
    };

    MaterialIcon.loadFont().catch(() => undefined);

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
          toolbarColor: colors.browserToolbar,
          navigationBarColor: colors.browserNavigationBar,
        },
      },
    }, {
      logger: browserLogger,
    });
  }, [browserLogger]);
  return (
    <JourneyProvider client={loginClient}>
      <OidcProvider client={sampleOidcWebClient}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerTitleStyle: { fontFamily: 'Montserrat-Medium' },
              headerBackTitleStyle: { fontFamily: 'Montserrat-Regular' },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
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
              name="JourneyRoute"
              component={JourneyRouteScreen}
              options={{ title: 'Journey Configuration' }}
            />
            <Stack.Screen
              name="JourneyHelper"
              component={JourneyHelperScreen}
              options={{ title: 'Journey Flow' }}
            />
            <Stack.Screen
              name="JourneyFull"
              component={JourneyFullScreen}
              options={{ title: 'Journey Full (API)' }}
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
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ title: 'User Profile' }}
            />
            <Stack.Screen
              name="Token"
              component={TokenScreen}
              options={{ title: 'Token' }}
            />
            <Stack.Screen
              name="Logout"
              component={LogoutScreen}
              options={{ title: 'Logout' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </OidcProvider>
    </JourneyProvider>
  );
}
