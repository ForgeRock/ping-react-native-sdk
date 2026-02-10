/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import { loginClient, loginClient2 } from '../src/clients';
import { getDeviceId } from '@ping-identity/rn-device-id';

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };

export default function HomeScreen({ navigation }: Props) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceIdError, setDeviceIdError] = useState<string | null>(null);

  const menuItems = [
    { title: '📦 Launch Storage', screen: 'Storage' },
    {
      title: '🌐 Launch Journey',
      screen: 'Journey',
      params: { journeyClient: loginClient },
    },
    {
      title: '🌐 Launch Journey 2',
      screen: 'Journey',
      params: { journeyClient: loginClient2 },
    },
    { title: '🧭 Launch Browser', screen: 'Browser' },
    {
      title: '🧪 Logger Demo',
      screen: 'Logger',
    },
    {
      title: '📲 Device Profile',
      screen: 'DeviceProfile',
    },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadDeviceIds = async (): Promise<void> => {
      try {
        const defaultId = await getDeviceId();
        if (isMounted) setDeviceId(defaultId);
      } catch (err) {
        if (isMounted) {
          setDeviceIdError(`Device ID failed: ${String(err)}`);
        }
      }
    };

    loadDeviceIds();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={commonStyles.homeContainer}>
      <Image
        source={require('../assets/ping-logo.jpg')}
        style={commonStyles.homeLogo}
      />

      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={commonStyles.homeRow}
          onPress={() => navigation.navigate(item.screen as any, item.params)}
        >
          <Text style={commonStyles.homeRowText}>{item.title}</Text>
        </TouchableOpacity>
      ))}

      <View style={commonStyles.homeFooter}>
        <Text style={commonStyles.homeFooterText}>
          React Native Unified SDK
        </Text>
        <Text style={commonStyles.devideIdText}>
          Device Id: {deviceId ?? 'Loading...'}
        </Text>
        {deviceIdError && (
          <Text style={commonStyles.devideIdText}>
            Device Id Error: {deviceIdError}
          </Text>
        )}
      </View>
    </View>
  );
}
