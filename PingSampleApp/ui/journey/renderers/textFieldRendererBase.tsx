/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../callbacks';
import { readString } from '../callbacks';
import type { CallbackRenderContext } from './types';

type TextFieldRendererOptions = {
  defaultLabel: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  sanitize?: (text: string) => string;
};

/**
 * Shared text-field renderer for input-style callbacks.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @param options - Callback-specific rendering options.
 * @returns Rendered text field block.
 */
export function renderTextFieldCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext,
  options: TextFieldRendererOptions
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const label = readString(callback.prompt, options.defaultLabel);

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={commonStyles.inputGroup}>
      <Text style={commonStyles.inputLabel}>{label}</Text>
      <TextInput
        style={commonStyles.input}
        secureTextEntry={Boolean(options.secureTextEntry)}
        autoCapitalize="none"
        keyboardType={options.keyboardType ?? 'default'}
        value={readString(fieldValue)}
        onChangeText={(text) => setFieldValue(options.sanitize ? options.sanitize(text) : text)}
        placeholder={label}
        placeholderTextColor={colors.gray}
      />
    </View>
  );
}
