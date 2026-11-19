/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from '../App';
import type { SampleAppClientProfile, SampleConfigGroup } from '../src/clients';
import { colors } from '../src/styles/colors';
import { commonStyles } from '../src/styles/common';
import LabeledSwitchRow from './components/atoms/LabeledSwitchRow';
import { useFidoCeremonySettings } from './fido/FidoCeremonySettings';

const PREFER_IMMEDIATE_CREDENTIALS_HINT = Platform.select({
  ios: 'Applies to passkey authentication in Journey and DaVinci flows only and is not sent on registration. Sign-in is limited to credentials on this device. When none match, authentication is cancelled: Journey continues past the cancellation and DaVinci shows the ceremony error.',
  default:
    'Applied to passkey registration in Journey and DaVinci flows through the Credential Manager create request. For authentication, the current Android native SDK cannot apply it: a warning is logged and the default sign-in flow runs.',
});

type Props = NativeStackScreenProps<RootStackParamList, 'Configuration'> & {
  profiles: readonly SampleAppClientProfile[];
  selectedJourneyProfileKey: string | null;
  selectedOidcProfileKey: string | null;
  selectedDeviceAuthProfileKey: string | null;
  onSelectJourneyProfile: (profileKey: string) => void;
  onSelectOidcProfile: (profileKey: string) => void;
  onSelectDeviceAuthProfile: (profileKey: string) => void;
};

/**
 * Groups sample profiles by UI section title.
 *
 * @param profiles Available sample profiles.
 * @returns Profile map keyed by section title.
 */
function groupProfilesBySection(
  profiles: readonly SampleAppClientProfile[],
): ReadonlyMap<SampleConfigGroup, readonly SampleAppClientProfile[]> {
  const grouped = new Map<SampleConfigGroup, SampleAppClientProfile[]>();

  for (const profile of profiles) {
    const sectionItems = grouped.get(profile.group);
    if (sectionItems) {
      sectionItems.push(profile);
      continue;
    }
    grouped.set(profile.group, [profile]);
  }

  return grouped;
}

/**
 * Sample app configuration selector screen.
 *
 * @param props Screen props.
 * @returns Configuration selector screen.
 */
export default function ConfigurationScreen(props: Props): React.ReactElement {
  const {
    profiles,
    selectedJourneyProfileKey,
    selectedOidcProfileKey,
    selectedDeviceAuthProfileKey,
    onSelectJourneyProfile,
    onSelectOidcProfile,
    onSelectDeviceAuthProfile,
  } = props;
  const {
    preferImmediatelyAvailableCredentials,
    setPreferImmediatelyAvailableCredentials,
    androidPlayServicesTimeout,
    setAndroidPlayServicesTimeout,
    androidRegistrationAutoSelect,
    setAndroidRegistrationAutoSelect,
  } = useFidoCeremonySettings();

  const deviceAuthProfiles = profiles.filter(
    profile => profile.group === 'Auth Grant',
  );
  const groupedProfiles = groupProfilesBySection(
    profiles.filter(profile => profile.group !== 'Auth Grant'),
  );

  return (
    <ScrollView
      style={commonStyles.configScreen}
      contentContainerStyle={commonStyles.configScreenContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={commonStyles.configSection}>
        <Text style={commonStyles.configSectionTitle}>
          Device Authorization Grant
        </Text>
        {deviceAuthProfiles.map(profile => {
          const selected = profile.key === selectedDeviceAuthProfileKey;
          const iconName = selected ? 'check' : 'check-box-outline-blank';
          const config = profile.deviceAuthConfig;
          return (
            <TouchableOpacity
              key={profile.key}
              style={commonStyles.configOptionRow}
              onPress={() => onSelectDeviceAuthProfile(profile.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={commonStyles.configOptionTextBlock}>
                <Text style={commonStyles.configOptionName}>
                  {config?.display || profile.name}
                </Text>
                <Text style={commonStyles.configOptionMeta}>
                  {config?.discoveryEndpoint ||
                    'Discovery endpoint not configured'}
                </Text>
                <Text style={commonStyles.configOptionMeta}>
                  {config?.clientId || 'Client ID not configured'} ·{' '}
                  {config?.scopes.join(', ') || 'No scopes configured'}
                </Text>
              </View>
              <MaterialIcon
                name={iconName}
                size={28}
                color={selected ? colors.primary : colors.textDark}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      {[...groupedProfiles.entries()].map(([group, items]) => (
        <View key={group} style={commonStyles.configSection}>
          <Text style={commonStyles.configSectionTitle}>{group}</Text>

          {items.map(profile => {
            const selected =
              group === 'Journey'
                ? profile.key === selectedJourneyProfileKey
                : profile.key === selectedOidcProfileKey;
            const iconName = selected ? 'check' : 'check-box-outline-blank';
            return (
              <TouchableOpacity
                key={profile.key}
                style={commonStyles.configOptionRow}
                onPress={() => {
                  if (group === 'Journey') {
                    onSelectJourneyProfile(profile.key);
                    return;
                  }
                  onSelectOidcProfile(profile.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={commonStyles.configOptionTextBlock}>
                  <Text style={commonStyles.configOptionName}>
                    {profile.name}
                  </Text>
                  <Text style={commonStyles.configOptionMeta}>
                    {profile.host}
                  </Text>
                  <Text style={commonStyles.configOptionMeta}>
                    {profile.environment}
                  </Text>
                </View>
                <MaterialIcon
                  name={iconName}
                  size={28}
                  color={selected ? colors.primary : colors.textDark}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={commonStyles.configSection}>
        <Text style={commonStyles.configSectionTitle}>Passkeys (FIDO)</Text>
        <LabeledSwitchRow
          label="Prefer immediately available credentials"
          value={preferImmediatelyAvailableCredentials}
          onValueChange={() =>
            setPreferImmediatelyAvailableCredentials(
              !preferImmediatelyAvailableCredentials,
            )
          }
        />
        <Text style={commonStyles.helperNote}>
          {PREFER_IMMEDIATE_CREDENTIALS_HINT}
        </Text>
        {Platform.OS === 'android' ? (
          <>
            <LabeledSwitchRow
              label="Use Play Services with a 60 second timeout"
              value={androidPlayServicesTimeout}
              onValueChange={() =>
                setAndroidPlayServicesTimeout(!androidPlayServicesTimeout)
              }
            />
            <Text style={commonStyles.helperNote}>
              Android only. Routes passkey authentication through Google Play
              Services and requires its FIDO API on the device.
            </Text>
            <LabeledSwitchRow
              label="Allow auto-select on registration"
              value={androidRegistrationAutoSelect}
              onValueChange={() =>
                setAndroidRegistrationAutoSelect(!androidRegistrationAutoSelect)
              }
            />
            <Text style={commonStyles.helperNote}>
              Android only. Sets the auto-select flag on the Credential Manager
              create request for passkey registration. The flag is passed to the
              credential provider, which decides whether it changes the prompt.
            </Text>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
