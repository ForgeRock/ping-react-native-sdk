/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, View } from 'react-native';
import type { CallbackEntry } from '../callbacks';
import { readString } from '../callbacks';
import { rendererStyles } from './styles';

/**
 * Renders warning UI for callbacks requiring additional native integrations.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered integration warning card.
 */
export function renderIntegrationRequiredCallback(
  entry: CallbackEntry
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.warningCard}>
      <Text style={rendererStyles.warningTitle}>Callback requires additional integration</Text>
      <Text style={rendererStyles.warningText}>Type: {callback.type}</Text>
      {callback.nativeClass ? (
        <Text style={rendererStyles.warningText}>
          Native class: {readString(callback.nativeClass)}
        </Text>
      ) : null}
    </View>
  );
}
