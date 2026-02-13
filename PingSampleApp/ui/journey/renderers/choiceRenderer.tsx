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
import { readNumber, readString, readStringArray } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

/**
 * Renders `ChoiceCallback` options with local selection state.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered choice selection block.
 */
export function renderChoiceCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const choices = readStringArray(callback.choices);
  const selectedIndex = Math.max(
    0,
    Math.floor(readNumber(fieldValue, readNumber(callback.selectedIndex, 0)))
  );

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.choiceContainer}>
      <Text style={commonStyles.inputLabel}>
        {readString(callback.prompt, 'Choose an option')}
      </Text>
      <View style={rendererStyles.choiceRow}>
        {choices.map((choice, optionIndex) => (
          <TouchableOpacity
            key={`${callback.type}-${absoluteIndex}-${optionIndex}`}
            style={[
              rendererStyles.choiceOutlineButton,
              selectedIndex === optionIndex &&
                rendererStyles.choiceOutlineButtonSelected,
            ]}
            onPress={() => setFieldValue(optionIndex)}
          >
            <Text
              style={[
                rendererStyles.choiceOutlineButtonText,
                selectedIndex === optionIndex &&
                  rendererStyles.choiceOutlineButtonTextSelected,
              ]}
            >
              {choice}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
