/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import { getDeviceId } from '@ping-identity/rn-device-id';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../src/styles/colors';

type HomeScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavProp };
type HomeMenuItem = {
  title: string;
  subtitle: string;
  icon: string;
  screen?: keyof RootStackParamList;
  comingSoon?: boolean;
};

export default function HomeScreen({ navigation }: Props) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceIdError, setDeviceIdError] = useState<string | null>(null);

  const authenticationItems: HomeMenuItem[] = [
    {
      title: 'DaVinci Flow',
      subtitle: 'Test Davinci Authentication',
      icon: 'vpn-key',
      comingSoon: true,
    },
    {
      title: 'Journey Flow',
      subtitle: 'Test Journey Authentication',
      icon: 'map',
      screen: 'JourneyRoute',
    },
    {
      title: 'OIDC Login',
      subtitle: 'OpenID Connect Flow',
      icon: 'lock',
      screen: 'Oidc',
    },
  ];

  const userManagementItems: HomeMenuItem[] = [
    {
      title: 'Access Token',
      subtitle: 'View current token',
      icon: 'token',
      screen: 'Token',
    },
    {
      title: 'User Profile',
      subtitle: 'View user details',
      icon: 'account-circle',
      screen: 'UserProfile',
    },
    {
      title: 'Device Management',
      subtitle: 'Manage registered devices',
      icon: 'device-hub',
      comingSoon: true,
    },
    {
      title: 'Logout',
      subtitle: 'End session',
      icon: 'logout',
      screen: 'Logout',
    },
  ];

  const developerToolsItems: HomeMenuItem[] = [
    {
      title: 'Browser',
      subtitle: 'Test browser flow',
      icon: 'language',
      screen: 'Browser',
    },
    {
      title: 'Logger',
      subtitle: 'Test logging',
      icon: 'logo-dev',
      screen: 'Logger',
    },
    {
      title: 'Storage',
      subtitle: 'Test storage',
      icon: 'storage',
      screen: 'Storage',
    },
    {
      title: 'Device Profile',
      subtitle: 'Collect device profile data',
      icon: 'phone-android',
      screen: 'DeviceProfile',
    },
  ];

  const renderMenuItem = (item: HomeMenuItem): React.ReactElement => {
    const isDisabled = item.comingSoon || !item.screen;

    return (
      <TouchableOpacity
        key={item.title}
        style={[commonStyles.homeRow, isDisabled ? commonStyles.homeRowDisabled : null]}
        onPress={isDisabled ? undefined : () => navigation.navigate(item.screen as keyof RootStackParamList)}
        disabled={isDisabled}
      >
        <View style={commonStyles.homeRowContent}>
          <View style={commonStyles.homeRowIconWrap}>
            <MaterialIcon
              name={item.icon}
              size={36}
              color={isDisabled ? colors.homeRowDisabledIcon : colors.primary}
            />
          </View>
          <View style={commonStyles.homeRowTextStack}>
            <View style={commonStyles.homeRowTitleContainer}>
              <Text style={[commonStyles.homeRowTitle, isDisabled ? commonStyles.homeRowTitleDisabled : null]}>
                {item.title}
              </Text>
              {item.comingSoon ? (
                <View style={commonStyles.homeComingSoonBadge}>
                  <Text style={commonStyles.homeComingSoonText}>COMING SOON</Text>
                </View>
              ) : null}
            </View>
            <Text style={[commonStyles.homeRowSubtitle, isDisabled ? commonStyles.homeRowSubtitleDisabled : null]}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        <Text style={[commonStyles.homeRowChevron, isDisabled ? commonStyles.homeRowChevronDisabled : null]}>
          {'>'}
        </Text>
      </TouchableOpacity>
    );
  };

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
      <View style={commonStyles.homeHeader}>
        <Image
          source={require('../assets/ping-logo.jpg')}
          style={commonStyles.homeHeaderLogo}
        />
        <Text style={commonStyles.homeHeaderTitle}>React Native Sample App</Text>
        <Text style={commonStyles.homeHeaderSubtitle}>Version 1.0</Text>
      </View>

      <ScrollView
        style={commonStyles.homeBody}
        contentContainerStyle={commonStyles.homeBodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={commonStyles.homeList}>
          <Text style={commonStyles.homeSectionTitle}>AUTHENTICATION</Text>
          {authenticationItems.map(renderMenuItem)}

          <Text style={commonStyles.homeSectionTitle}>USER MANAGEMENT</Text>
          {userManagementItems.map(renderMenuItem)}

          <Text style={commonStyles.homeSectionTitle}>DEVELOPER TOOLS</Text>
          {developerToolsItems.map(renderMenuItem)}

          <View style={commonStyles.homeFooter}>
            <View style={commonStyles.deviceIdCard}>
              <View style={commonStyles.deviceIdHeaderRow}>
                <MaterialIcon name="smartphone" size={30} color={colors.iconBody} />
                <Text style={commonStyles.deviceIdTitle}>Device ID</Text>
                {!deviceIdError ? (
                  <Text style={commonStyles.deviceIdSecuredText}>Secured</Text>
                ) : null}
              </View>
              <View style={commonStyles.deviceIdDivider} />
              {deviceIdError ? (
                <Text style={commonStyles.deviceIdErrorText}>{deviceIdError}</Text>
              ) : (
                <Text style={commonStyles.deviceIdValueText}>
                  {deviceId ?? 'Loading...'}
                </Text>
              )}
            </View>
            {deviceIdError ? (
              <Text style={commonStyles.devideIdText}>
                Device ID could not be resolved.
              </Text>
            ) : null}
            <Text style={commonStyles.homeFooterText}>React Native Unified SDK</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
