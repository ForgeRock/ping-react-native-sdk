/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../../src/styles/colors';
import { commonStyles } from '../../../../src/styles/common';
import { fieldStyles } from './fieldStyles';
import {
  readBoolean,
  readString,
  resolveOptionLabel,
  resolvePromptText,
} from './valueReaders';
import type { JourneyFieldRendererProps } from './types';

type JourneyKbaValue = {
  selectedQuestion?: string;
  selectedAnswer?: string;
  allowUserDefinedQuestions?: boolean;
};

/**
 * Renders a KBA callback field.
 *
 * @param props - Field renderer props.
 * @returns KBA field card.
 */
export default function JourneyKbaField(
  props: JourneyFieldRendererProps
): React.ReactElement {
  const { field, currentValue, setFieldValue } = props;
  const promptText = resolvePromptText(field.prompt, field.message, field.type);

  const kbaValue: JourneyKbaValue =
    (currentValue as JourneyKbaValue | undefined) ?? {
      selectedQuestion: '',
      selectedAnswer: '',
      allowUserDefinedQuestions: false,
    };

  return (
    <View style={fieldStyles.card}>
      <Text style={fieldStyles.typeText}>{field.type}</Text>
      <Text style={fieldStyles.promptText}>{promptText}</Text>
      {field.options && field.options.length > 0 ? (
        <View style={fieldStyles.optionWrap}>
          {field.options.map((option) => (
            <TouchableOpacity
              key={`${field.id}:question:${option.index}`}
              style={[
                commonStyles.buttonSecondary,
                readString(kbaValue.selectedQuestion) ===
                  resolveOptionLabel(option.label, option.value, option.index)
                  ? fieldStyles.selectedOption
                  : null,
              ]}
              onPress={() =>
                setFieldValue(field.id, {
                  selectedQuestion: resolveOptionLabel(
                    option.label,
                    option.value,
                    option.index
                  ),
                  selectedAnswer: readString(kbaValue.selectedAnswer),
                  allowUserDefinedQuestions: readBoolean(
                    kbaValue.allowUserDefinedQuestions,
                    false
                  ),
                })
              }
            >
              <Text style={commonStyles.buttonTextSecondary}>
                {resolveOptionLabel(option.label, option.value, option.index)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <TextInput
        style={commonStyles.input}
        value={readString(kbaValue.selectedQuestion)}
        onChangeText={(text) =>
          setFieldValue(field.id, {
            selectedQuestion: text,
            selectedAnswer: readString(kbaValue.selectedAnswer),
            allowUserDefinedQuestions: readBoolean(
              kbaValue.allowUserDefinedQuestions,
              false
            ),
          })
        }
        placeholder="Question"
        placeholderTextColor={colors.gray}
      />
      <TextInput
        style={[commonStyles.input, fieldStyles.topGap]}
        value={readString(kbaValue.selectedAnswer)}
        onChangeText={(text) =>
          setFieldValue(field.id, {
            selectedQuestion: readString(kbaValue.selectedQuestion),
            selectedAnswer: text,
            allowUserDefinedQuestions: readBoolean(
              kbaValue.allowUserDefinedQuestions,
              false
            ),
          })
        }
        placeholder="Answer"
        placeholderTextColor={colors.gray}
      />
    </View>
  );
}
