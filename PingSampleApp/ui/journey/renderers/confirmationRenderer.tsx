/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../utils/callbacks';
import { readString, readStringArray } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

/**
 * Renders `ConfirmationCallback` options as immediate-submit actions.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered confirmation action block.
 */
export function renderConfirmationCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex, typeIndex } = entry;
  const { autoSubmitting, loading, onConfirmationSelect } = context;
  const options = readStringArray(callback.options);

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.choiceContainer}>
      <Text style={commonStyles.inputLabel}>
        {readString(callback.prompt, 'Choose an option')}
      </Text>
      <View style={rendererStyles.choiceRow}>
        {options.map((option, optionIndex) => (
          <TouchableOpacity
            key={`${callback.type}-${absoluteIndex}-${optionIndex}`}
            style={rendererStyles.choiceButton}
            onPress={() => onConfirmationSelect(callback.type, typeIndex, optionIndex)}
            disabled={loading || autoSubmitting}
          >
            <Text style={commonStyles.buttonText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
