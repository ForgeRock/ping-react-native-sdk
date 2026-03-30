/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TextInput } from 'react-native';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import ConfigurationScreen from './ui/ConfigurationScreen';
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
import {
  DEFAULT_SAMPLE_APP_CLIENT_PROFILE_KEY,
  sampleAppClientProfiles,
} from './src/clients';
import { configureBrowser } from '@ping-identity/rn-browser';
import { logger } from '@ping-identity/rn-logger';
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
  Configuration: undefined;
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
  // Dedicated browser logger keeps browser diagnostics separate from global SDK logging.
  const browserLogger = useMemo(() => logger({ level: 'debug' }), []);
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(
    DEFAULT_SAMPLE_APP_CLIENT_PROFILE_KEY,
  );

  const selectedProfile = useMemo(
    () =>
      sampleAppClientProfiles.find(
        profile => profile.key === selectedProfileKey,
      ) ?? sampleAppClientProfiles[0],
    [selectedProfileKey],
  );

  useEffect(() => {
    let isMounted = true;
    const textComponent = Text as unknown as ComponentWithDefaultStyle;
    const textDefaults = textComponent.defaultProps ?? {};
    textComponent.defaultProps = {
      ...textDefaults,
      style: [textDefaults.style, { fontFamily: 'Montserrat-Regular' }],
    };

    const textInputComponent =
      TextInput as unknown as ComponentWithDefaultStyle;
    const textInputDefaults = textInputComponent.defaultProps ?? {};
    textInputComponent.defaultProps = {
      ...textInputDefaults,
      style: [textInputDefaults.style, { fontFamily: 'Montserrat-Regular' }],
    };

    MaterialIcon.loadFont().catch((error: unknown) => {
      console.warn('Failed to load MaterialIcons font', error);
    });

    // Initialize selected Journey client at app startup and after profile switches.
    const initializeJourneyClient = async (): Promise<void> => {
      try {
        await Promise.resolve(selectedProfile.journeyClient.init());
        if (isMounted) {
          setInitError(null);
        }
      } catch (error) {
        console.error('Failed to initialize Journey client', error);
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to initialize Journey client.';
          setInitError(message);
        }
      }
    };

    void initializeJourneyClient();

    // Browser defaults used by OIDC/browser flows in this sample app.
    configureBrowser(
      {
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
      },
      {
        logger: browserLogger,
      },
    );

    return () => {
      isMounted = false;
    };
  }, [browserLogger, selectedProfile]);

  if (initError) {
    // Fail fast with a clear startup error instead of crashing on first journey API call.
    return <Text>{`Journey client init failed: ${initError}`}</Text>;
  }

  return (
    // Journey and OIDC hooks resolve clients from these contexts.
    <JourneyProvider client={selectedProfile.journeyClient}>
      <OidcProvider client={selectedProfile.oidcClient}>
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
              options={{ title: 'PingIdentity Demo', headerShown: false }}
            >
              {props => (
                <HomeScreen
                  {...props}
                  selectedConfigName={selectedProfile.name}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="Configuration"
              options={{ title: 'Configuration' }}
            >
              {props => (
                <ConfigurationScreen
                  {...props}
                  profiles={sampleAppClientProfiles}
                  selectedProfileKey={selectedProfile.key}
                  onSelectProfile={setSelectedProfileKey}
                />
              )}
            </Stack.Screen>
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
            <Stack.Screen name="Oidc" options={{ title: 'OIDC Demo' }}>
              {props => (
                <OidcScreen
                  {...props}
                  clientConfig={selectedProfile.oidcClientConfig}
                />
              )}
            </Stack.Screen>
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
