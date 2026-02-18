/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { commonStyles } from '../../../../src/styles/common';
import { fieldStyles } from './fieldStyles';
import { resolvePromptText, toDisplayString } from './valueReaders';
import type { JourneyFieldRendererProps } from './types';

/**
 * Renders an output-only callback field.
 *
 * @param props - Field renderer props.
 * @returns Output-only field card.
 */
export default function JourneyOutputField(
  props: JourneyFieldRendererProps
): React.ReactElement {
  const { field } = props;
  const promptText = resolvePromptText(field.prompt, field.message);

  return (
    <View style={fieldStyles.card}>
      {promptText.length > 0 ? (
        <Text style={fieldStyles.promptText}>{promptText}</Text>
      ) : null}
      {field.message ? <Text style={fieldStyles.helperText}>{field.message}</Text> : null}
      <ScrollView style={fieldStyles.payloadScroll} nestedScrollEnabled>
        <Text style={commonStyles.codeText}>{toDisplayString(field.raw.value)}</Text>
      </ScrollView>
    </View>
  );
}
