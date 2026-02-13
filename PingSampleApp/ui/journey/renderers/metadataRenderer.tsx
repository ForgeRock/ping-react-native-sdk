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
 * Renders `MetadataCallback` payloads for debugging and visibility.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered metadata card.
 */
export function renderMetadataCallback(entry: CallbackEntry): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.metadataCard}>
      <Text style={commonStyles.inputLabel}>Metadata</Text>
      <Text style={commonStyles.codeText}>
        {JSON.stringify(callback.value ?? {}, null, 2)}
      </Text>
    </View>
  );
}
