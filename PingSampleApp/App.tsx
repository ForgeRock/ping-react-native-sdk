import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MultiStorageScreen from './ui/MultiStorageScreeen';
import HomeScreen from './ui/HomeScreen';
import JourneyScreen from './ui/JourneyScreen';
import { loginClient, loginClient2 } from './src/clients';
import { JourneyClient } from '@react-native-pingidentity/journey/lib/typescript/src/types';

export type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  Journey: { journeyClient: JourneyClient };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Init login clients
    loginClient.init()
    loginClient2.init(); 
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
