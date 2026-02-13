/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, View } from 'react-native';
import type { CallbackEntry } from '../utils/callbacks';
import { readString } from '../utils/callbacks';
import { rendererStyles } from './styles';

/**
 * Renders a `TextOutputCallback` informational message.
 *
 * @param entry - Callback entry metadata.
 * @returns Rendered text output card.
 */
export function renderTextOutputCallback(entry: CallbackEntry): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.messageCard}>
      <Text style={rendererStyles.messageText}>
        {readString(callback.message ?? callback.prompt)}
      </Text>
    </View>
  );
}
