/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../src/styles/colors';
import { commonStyles } from '../../src/styles/common';

/**
 * Props for the Journey start panel.
 */
export type JourneyStartPanelProps = {
  showJourneyInput: boolean;
  journeyName: string;
  onJourneyNameChange: (value: string) => void;
  suggestedJourneys: string[];
  loading: boolean;
  canStart: boolean;
  onStart: () => void;
};

/**
 * Renders journey name input, suggestions, loading indicator, and start action.
 *
 * @param props - Component props.
 * @returns Journey start panel markup.
 */
export default function JourneyStartPanel(
  props: JourneyStartPanelProps
): React.ReactElement {
  const {
    showJourneyInput,
    journeyName,
    onJourneyNameChange,
    suggestedJourneys,
    loading,
    canStart,
    onStart,
  } = props;

  return (
    <>
      {showJourneyInput ? (
        <>
          <TextInput
            style={commonStyles.input}
            placeholder="Enter journey name"
            placeholderTextColor={colors.gray}
            value={journeyName}
            onChangeText={onJourneyNameChange}
          />
          <View style={commonStyles.suggestionContainer}>
            {suggestedJourneys.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => onJourneyNameChange(name)}
                style={commonStyles.suggestionChip}
              >
                <Text style={commonStyles.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}

      {canStart ? (
        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={onStart}
          disabled={loading}
        >
          <Text style={commonStyles.buttonText}>Start Journey</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}
