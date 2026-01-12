import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import { loginClient, loginClient2 } from '../src/clients';
import { multiply } from '@forgerock/react-native-ping-logger';

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };

export default function HomeScreen({ navigation }: Props) {
  const [loggerTest, setLoggerTest] = useState<string>('');

  useEffect(() => {
    // Logger sanity test: multiply 7 * 6
    const result = multiply(7, 6);
    setLoggerTest(`Logger Test: 7 × 6 = ${result}`);
  }, []);

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
  ];

  return (
    <View style={commonStyles.homeContainer}>
      <Image
        source={require('../assets/ping-logo.jpg')}
        style={commonStyles.homeLogo}
      />

      {loggerTest ? (
        <View style={commonStyles.homeRow}>
          <Text style={commonStyles.homeRowText}>{loggerTest}</Text>
        </View>
      ) : null}

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
          React Native Unified SDK — POC Build
        </Text>
      </View>
    </View>
  );
}
