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
import { configureLogger, logger } from '@ping-identity/rn-logger';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './src/styles/colors';

/** Minimal shape required to patch `defaultProps.style` on a core RN component class. */
type ComponentWithDefaultStyle = {
  defaultProps?: {
    style?: unknown;
    [key: string]: unknown;
  };
};

/**
 * Navigation route map for the sample app's native stack.
 *
 * Each key is a screen name; the value is the params type that screen accepts
 * (`undefined` means no params).
 */
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
 *
 * ## Structure
 *
 * 1. **Profile selection** — `sampleAppClientProfiles` (defined in `src/clients.ts`) lists
 *    pre-built client configurations. The active profile is stored as `selectedProfileKey`
 *    and defaults to `DEFAULT_SAMPLE_APP_CLIENT_PROFILE_KEY`.
 *
 * 2. **Client initialization** — whenever `selectedProfile` changes the component calls
 *    `journeyClient.init()` inside a guarded async effect. Init errors are surfaced as an
 *    inline message instead of crashing.
 *
 * 3. **Context providers** — `JourneyProvider` and `OidcProvider` expose the active
 *    clients to every screen via React context so screens do not import clients directly.
 *
 * 4. **Navigation** — a `NativeStackNavigator` registers all demo screens.
 *
 * 5. **Global SDK setup** — `configureLogger` and `configureBrowser` are called once per
 *    effect cycle to set sensible defaults. The browser logger is intentionally separate
 *    from the global logger so browser diagnostics can be filtered independently.
 */
export default function App() {
  // Dedicated browser logger keeps browser diagnostics separate from global SDK logging.
  const browserLogger = useMemo(() => logger({ level: 'debug' }), []);
  /** Non-null while the journey client failed to initialise after a profile switch. */
  const [initError, setInitError] = useState<string | null>(null);
  /** Key of the active client profile, defaults to the first configured profile. */
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(
    DEFAULT_SAMPLE_APP_CLIENT_PROFILE_KEY
  );

  /** Resolved profile object for the current selection, falling back to the first profile. */
  const selectedProfile = useMemo(
    () =>
      sampleAppClientProfiles.find((profile) => profile.key === selectedProfileKey) ??
      sampleAppClientProfiles[0],
    [selectedProfileKey]
  );

  useEffect(() => {
    let isMounted = true;
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

    MaterialIcon.loadFont().catch((error: unknown) => {
      console.warn('Failed to load MaterialIcons font', error);
    });

    /**
     * Calls `journeyClient.init()` for the active profile.
     *
     * Wrapped in an async function so the effect callback itself stays synchronous
     * (React effects must not return a Promise). The `isMounted` flag prevents
     * state updates after the component unmounts or the effect re-runs.
     */
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
            error instanceof Error ? error.message : 'Failed to initialize Journey client.';
          setInitError(message);
        }
      }
    };

    void initializeJourneyClient();

    // ( TODO: REVISIT )Global SDK logger baseline. Tune this when debugging integration issues.
    configureLogger({ level: 'info' });

    // Browser defaults used by OIDC/browser flows in this sample app.
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
              {(props) => (
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
              {(props) => (
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
            <Stack.Screen
              name="Oidc"
              options={{ title: 'OIDC Demo' }}
            >
              {(props) => (
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
