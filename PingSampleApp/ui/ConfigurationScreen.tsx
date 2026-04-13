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
  selectedProfileKey: string;
  onSelectProfile: (profileKey: string) => void;
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
  const { profiles, selectedProfileKey, onSelectProfile } = props;

  const groupedProfiles = useMemo(
    () => groupProfilesBySection(profiles),
    [profiles],
  );

  // NOTE: `selectedProfile` was removed because it triggered an ESLint error:
  //   @typescript-eslint/no-unused-vars — 'selectedProfile' is assigned a value but never used.
  // The variable was computed but never referenced in the JSX.
  // It seems selectedProfileKey is sufficient for determining which profile is selected when rendering the list, so selectedProfile was not necessary.
  // If we need to display additional details about the selected profile in the future, we can consider reintroducing it at that time.
  //
  // const selectedProfile = useMemo(
  //   () => profiles.find((profile) => profile.key === selectedProfileKey),
  //   [profiles, selectedProfileKey]
  // );

  return (
    <ScrollView
      style={commonStyles.configScreen}
      contentContainerStyle={commonStyles.configScreenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={commonStyles.configSelectedLabel}>Selected Environment</Text>

      {[...groupedProfiles.entries()].map(([group, items]) => (
        <View key={group} style={commonStyles.configSection}>
          <Text style={commonStyles.configSectionTitle}>{group}</Text>

          {items.map(profile => {
            const selected = profile.key === selectedProfileKey;
            const iconName = selected ? 'check' : 'check-box-outline-blank';
            return (
              <TouchableOpacity
                key={profile.key}
                style={commonStyles.configOptionRow}
                onPress={() => onSelectProfile(profile.key)}
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
