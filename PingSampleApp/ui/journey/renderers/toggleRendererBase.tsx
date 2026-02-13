/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Switch, Text, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import type { CallbackEntry } from '../callbacks';
import { readBoolean } from '../callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

type ToggleRendererOptions = {
  label: string;
  defaultValue: boolean;
};

/**
 * Shared toggle renderer for boolean-style callbacks.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @param options - Callback-specific toggle options.
 * @returns Rendered toggle block.
 */
export function renderToggleCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext,
  options: ToggleRendererOptions
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const value = readBoolean(fieldValue, options.defaultValue);

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.switchRow}>
      <Text style={rendererStyles.switchLabel}>{options.label}</Text>
      <Switch
        value={value}
        onValueChange={(nextValue) => setFieldValue(nextValue)}
        trackColor={{ false: colors.border, true: '#f3b8bb' }}
        thumbColor={value ? colors.primary : '#f5f5f5'}
      />
    </View>
  );
}
