import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import { loginClient, loginClient2 } from '../src/clients';

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };

export default function HomeScreen({ navigation }: Props) {
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
  ];

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
          React Native Unified SDK — POC Build
        </Text>
      </View>
    </View>
  );
}
