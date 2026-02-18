/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../../src/styles/colors';
import { commonStyles } from '../../../src/styles/common';
import PingTextInput from '../../components/PingTextInput';

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
 * Distributes suggestion labels across fixed visual rows.
 *
 * @param suggestions - Suggested journey names.
 * @param rowCount - Number of visual rows.
 * @returns Suggestions grouped by row.
 */
function buildSuggestionRows(
  suggestions: string[],
  rowCount: number
): string[][] {
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  suggestions.forEach((suggestion, index) => {
    rows[index % rowCount].push(suggestion);
  });
  return rows.filter((row) => row.length > 0);
}

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
  const suggestionRows = buildSuggestionRows(suggestedJourneys, 3);

  return (
    <>
      {showJourneyInput ? (
        <>
          <PingTextInput
            label="Journey name"
            placeholder="Enter journey name"
            value={journeyName}
            onChangeText={onJourneyNameChange}
            autoCapitalize="none"
          />
          {suggestedJourneys.length > 0 ? (
            <ScrollView
              horizontal
              style={styles.suggestionScroll}
              contentContainerStyle={styles.suggestionScrollContent}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.suggestionRowsContainer}>
                {suggestionRows.map((row, rowIndex) => (
                  <View key={`suggestion-row-${rowIndex}`} style={styles.suggestionRow}>
                    {row.map((name) => (
                      <TouchableOpacity
                        key={`${rowIndex}-${name}`}
                        onPress={() => onJourneyNameChange(name)}
                        style={commonStyles.suggestionChip}
                      >
                        <Text style={commonStyles.suggestionText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}
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

const styles = StyleSheet.create({
  suggestionScroll: {
    marginTop: 8,
    marginBottom: 16,
  },
  suggestionScrollContent: {
    paddingRight: 4,
  },
  suggestionRowsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
});
