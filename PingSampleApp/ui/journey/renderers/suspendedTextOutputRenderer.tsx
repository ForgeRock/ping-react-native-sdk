/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../utils/callbacks';
import { readString } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

/**
 * Renders `SuspendedTextOutputCallback` with resume URL input controls.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered suspended callback form block.
 */
export function renderSuspendedTextOutputCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { loading, onResume, resumeUrl, setResumeUrl } = context;

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={commonStyles.suspendedBox}>
      <Text style={commonStyles.suspendedMessage}>
        {readString(
          callback.message ?? callback.prompt,
          'An email has been sent. Continue via resume URL.'
        )}
      </Text>
      <TextInput
        style={commonStyles.input}
        placeholder="Paste resume URL from email"
        placeholderTextColor={colors.gray}
        value={resumeUrl}
        onChangeText={(value) => setResumeUrl(value)}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={[commonStyles.buttonPrimary, rendererStyles.resumeButton]}
        onPress={onResume}
        disabled={loading}
      >
        <Text style={commonStyles.buttonText}>Resume Journey</Text>
      </TouchableOpacity>
    </View>
  );
}
