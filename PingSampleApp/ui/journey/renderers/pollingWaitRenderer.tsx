/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import type { CallbackEntry } from '../utils/callbacks';
import { readString } from '../utils/callbacks';
import { rendererStyles } from './styles';

/**
 * Renders `PollingWaitCallback` as a loading state card.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered polling wait card.
 */
export function renderPollingWaitCallback(entry: CallbackEntry): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.messageCard}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={rendererStyles.messageText}>
        {readString(callback.message, 'Please wait...')}
      </Text>
    </View>
  );
}
