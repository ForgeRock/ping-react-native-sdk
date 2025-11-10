import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';

type RootStackParamList = {
  Home: undefined;
  DogStorage: undefined;
  Journey: undefined;
};

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };

export default function HomeScreen({ navigation }: Props) {
  const menuItems = [
    { title: '🐶 Go to Dog Storage', screen: 'DogStorage' },
    { title: '🌐 Launch Journey', screen: 'Journey' },
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
