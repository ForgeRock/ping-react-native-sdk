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
    {
      title: '🧪 Logger Demo',
      screen: 'Logger',
    },
    {
      title: '🔐 Launch OIDC',
      subtitle: 'OpenID Connect Flow',
      icon: '🔒',
      screen: 'Oidc',
    },
  ];

  return (
    <View style={commonStyles.homeContainer}>
      <View style={commonStyles.homeHeader}>
        <Image
          source={require('../assets/ping-logo.jpg')}
          style={commonStyles.homeHeaderLogo}
        />
        <Text style={commonStyles.homeHeaderTitle}>React Native Sample App</Text>
        <Text style={commonStyles.homeHeaderSubtitle}>Version 1.0</Text>
      </View>

      <View style={commonStyles.homeList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={commonStyles.homeRow}
            onPress={() => navigation.navigate(item.screen as any, item.params)}
          >
            <View style={commonStyles.homeRowContent}>
              {item.subtitle ? (
                <View style={commonStyles.homeRowCompact}>
                  <Text style={commonStyles.homeRowIcon}>{item.icon}</Text>
                  <View style={commonStyles.homeRowTextStack}>
                    <Text style={commonStyles.homeRowTitle}>OIDC Login</Text>
                    <Text style={commonStyles.homeRowSubtitle}>
                      {item.subtitle}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={commonStyles.homeRowText}>{item.title}</Text>
              )}
            </View>
            <Text style={commonStyles.homeRowChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={commonStyles.homeFooter}>
        <Text style={commonStyles.homeFooterText}>
          React Native Unified SDK
        </Text>
      </View>
    </View>
  );
}
