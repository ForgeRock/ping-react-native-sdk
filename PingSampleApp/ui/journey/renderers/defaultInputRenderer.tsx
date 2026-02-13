/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../callbacks';
import { readString } from '../callbacks';
import type { CallbackRenderContext } from './types';

/**
 * Renders the default text/number input field for supported callbacks.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered default input block.
 */
export function renderDefaultInputCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const label =
    readString(callback.prompt) ||
    (callback.type === 'NameCallback'
      ? 'Username'
      : callback.type === 'PasswordCallback' ||
        callback.type === 'ValidatedCreatePasswordCallback'
      ? 'Password'
      : callback.type);
  const secureTextEntry =
    callback.type === 'PasswordCallback' ||
    callback.type === 'ValidatedCreatePasswordCallback';
  const keyboardType =
    callback.type === 'NumberAttributeInputCallback' ? 'numeric' : 'default';

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={commonStyles.inputGroup}>
      <Text style={commonStyles.inputLabel}>{label}</Text>
      <TextInput
        style={commonStyles.input}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        keyboardType={keyboardType}
        value={readString(fieldValue)}
        onChangeText={(text) =>
          setFieldValue(
            callback.type === 'NumberAttributeInputCallback'
              ? text.replace(/[^0-9.]/g, '')
              : text
          )
        }
        placeholder={label}
        placeholderTextColor={colors.gray}
      />
    </View>
  );
}
