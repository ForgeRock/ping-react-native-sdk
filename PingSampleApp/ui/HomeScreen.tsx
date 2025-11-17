import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';
import {multiply} from '@react-native-pingidentity/journey-poc'

type RootStackParamList = {
  Home: undefined;
  Storage: undefined;
  Journey: undefined;
};

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };

export default function HomeScreen({ navigation }: Props) {
  const menuItems = [
    { title: '📦 Launch Storage', screen: 'Storage' },
    { title: '🌐 Launch Journey', screen: 'Journey' },
  ];

  return (
    <View style={commonStyles.homeContainer}>
      <Image
        source={require('../assets/ping-logo.jpg')}
        style={commonStyles.homeLogo}
      />
      <Text>Result from Journey POC TM multiple() - {multiply(2,3)}</Text>

      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={commonStyles.homeRow}
          onPress={() => navigation.navigate(item.screen as any)}
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
