import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TextInput } from 'react-native';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyRouteScreen from './ui/JourneyRouteScreen';
import JourneyHelperScreen from './ui/JourneyHelperScreen';
import BrowserScreen from './ui/BrowserScreen';
import LoggerScreen from './ui/LoggerScreen';
import OidcScreen from './ui/OidcScreen';
import DeviceProfileScreen from './ui/DeviceProfileScreen';
import UserProfileScreen from './ui/UserProfileScreen';
import TokenScreen from './ui/TokenScreen';
import LogoutScreen from './ui/LogoutScreen';
import { JourneyProvider } from '@ping-identity/rn-journey';
import { loginClient } from './src/clients';
import { configureBrowser } from '@react-native-pingidentity/browser';
import { configureLogger } from '@react-native-pingidentity/logger';
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
  Browser: undefined;
  Logger: undefined;
  Oidc: undefined;
  DeviceProfile: undefined;
  UserProfile: undefined;
  Token: undefined;
  Logout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
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
    });
  }, []);
  return (
    <JourneyProvider client={loginClient}>
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
    </JourneyProvider>
  );
}
