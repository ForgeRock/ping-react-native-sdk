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
import { readString } from '../callbacks';
import { rendererStyles } from './styles';

/**
 * Renders `HiddenValueCallback` as an informational block.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered hidden-value information block.
 */
export function renderHiddenValueCallback(
  entry: CallbackEntry
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const description = readString(
    callback.prompt,
    'Hidden callback value is managed by the native SDK.'
  );

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.metadataCard}>
      <Text style={commonStyles.inputLabel}>Hidden callback</Text>
      <Text style={rendererStyles.messageText}>{description}</Text>
    </View>
  );
}
