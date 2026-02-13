/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../callbacks';
import { rendererStyles } from './styles';

/**
 * Renders a `DeviceProfileCallback` placeholder while native collection runs.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered device profile card.
 */
export function renderDeviceProfileCallback(entry: CallbackEntry): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.messageCard}>
      <Text style={commonStyles.inputLabel}>Device profile</Text>
      <Text style={commonStyles.helperNote}>
        Collecting device profile information...
      </Text>
    </View>
  );
}
