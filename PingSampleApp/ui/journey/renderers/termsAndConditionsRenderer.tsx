/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Switch, Text, View } from 'react-native';
import { colors } from '../../../src/styles/colors';
import { commonStyles } from '../../../src/styles/common';
import type { CallbackEntry } from '../utils/callbacks';
import { readBoolean, readString } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

/**
 * Renders `TermsAndConditionsCallback` with dedicated terms metadata and acceptance control.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered terms and conditions block.
 */
export function renderTermsAndConditionsCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const accepted = readBoolean(
    fieldValue,
    readBoolean(callback.accepted ?? callback.value, false)
  );
  const terms = readString(
    callback.terms,
    readString(callback.prompt, 'Review and accept terms and conditions to continue.')
  );
  const version = readString(callback.version);
  const createdAt = readString(callback.createDate);

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.termsContainer}>
      <Text style={commonStyles.inputLabel}>Terms and Conditions</Text>
      <Text style={rendererStyles.termsBody}>{terms}</Text>
      {version ? <Text style={rendererStyles.termsMeta}>Version: {version}</Text> : null}
      {createdAt ? <Text style={rendererStyles.termsMeta}>Created: {createdAt}</Text> : null}

      <View style={rendererStyles.switchRow}>
        <Text style={rendererStyles.switchLabel}>I accept these terms and conditions</Text>
        <Switch
          value={accepted}
          onValueChange={(nextValue) => setFieldValue(nextValue)}
          trackColor={{ false: colors.border, true: '#f3b8bb' }}
          thumbColor={accepted ? colors.primary : '#f5f5f5'}
        />
      </View>
    </View>
  );
}
