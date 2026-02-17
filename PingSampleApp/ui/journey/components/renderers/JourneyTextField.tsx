/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../../../../src/styles/colors';
import { commonStyles } from '../../../../src/styles/common';
import { fieldStyles } from './fieldStyles';
import { resolvePromptText, toDisplayString } from './valueReaders';
import type { JourneyFieldRendererProps } from './types';

/**
 * Renders text-like callback fields, including password and number input modes.
 *
 * @param props - Field renderer props.
 * @returns Text field card.
 */
export default function JourneyTextField(
  props: JourneyFieldRendererProps
): React.ReactElement {
  const { field, currentValue, setFieldValue } = props;
  const promptText = resolvePromptText(field.prompt, field.message);

  return (
    <View style={fieldStyles.card}>
      {promptText.length > 0 ? (
        <Text style={fieldStyles.promptText}>{promptText}</Text>
      ) : null}
      <TextInput
        style={commonStyles.input}
        value={toDisplayString(currentValue)}
        onChangeText={(text) => setFieldValue(field.id, text)}
        secureTextEntry={field.kind === 'password'}
        keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
        placeholder="Enter value"
        placeholderTextColor={colors.gray}
      />
    </View>
  );
}
