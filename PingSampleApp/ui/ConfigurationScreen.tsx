/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from '../App';
import type { SampleAppClientProfile, SampleConfigGroup } from '../src/clients';
import { colors } from '../src/styles/colors';
import { commonStyles } from '../src/styles/common';

type Props = NativeStackScreenProps<RootStackParamList, 'Configuration'> & {
  profiles: readonly SampleAppClientProfile[];
  selectedJourneyProfileKey: string | null;
  selectedOidcProfileKey: string | null;
  onSelectJourneyProfile: (profileKey: string) => void;
  onSelectOidcProfile: (profileKey: string) => void;
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
    onSelectJourneyProfile,
    onSelectOidcProfile,
  } = props;

  const groupedProfiles = useMemo(
    () => groupProfilesBySection(profiles),
    [profiles],
  );

  const selectedJourneyProfile = useMemo(
    () => profiles.find(profile => profile.key === selectedJourneyProfileKey),
    [profiles, selectedJourneyProfileKey],
  );

  const selectedOidcProfile = useMemo(
    () => profiles.find(profile => profile.key === selectedOidcProfileKey),
    [profiles, selectedOidcProfileKey],
  );

  return (
    <ScrollView
      style={commonStyles.configScreen}
      contentContainerStyle={commonStyles.configScreenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={commonStyles.configSelectedLabel}>Selected Environment</Text>
      <Text style={commonStyles.configSelectedValue}>
        {`Journey: ${selectedJourneyProfile?.name ?? 'None'}`}
      </Text>
      <Text style={commonStyles.configSelectedValue}>
        {`OIDC: ${selectedOidcProfile?.name ?? 'None'}`}
      </Text>

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
    </ScrollView>
  );
}
