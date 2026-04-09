/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { commonStyles } from '../../../../src/styles/common';
import { journeyDebugPanelStyles as styles } from '../../../../src/styles/journeyStyles';
import {
  type JourneyDebugEntry,
  debugPayloadToString,
} from '../../utils/debug';

/**
 * Props for Journey debug panel.
 */
export type JourneyDebugPanelProps = {
  entries: JourneyDebugEntry[];
  onClear: () => void;
};

/**
 * Renders an on-screen debug trace for Journey callback/test validation.
 *
 * @param props - Panel input props.
 * @returns Debug panel element.
 */
export default function JourneyDebugPanel(
  props: JourneyDebugPanelProps,
): React.ReactElement {
  const { entries, onClear } = props;

  return (
    <View style={commonStyles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Journey Debug</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClear}
          disabled={entries.length === 0}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No debug events yet.</Text>
      ) : (
        entries.map(entry => (
          <View key={entry.id} style={styles.eventCard}>
            <Text style={styles.eventTitle}>
              [{entry.timestamp}] {entry.title}
            </Text>
            {entry.payload !== undefined ? (
              <ScrollView
                style={styles.payloadScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                onStartShouldSetResponderCapture={(): boolean => true}
                onMoveShouldSetResponderCapture={(): boolean => true}
              >
                <Text style={commonStyles.codeText}>
                  {debugPayloadToString(entry.payload)}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
