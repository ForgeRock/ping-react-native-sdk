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
import type { CallbackEntry } from '../callbacks';
import {
  parseKbaDraft,
  readBoolean,
  readString,
  readStringArray,
} from '../callbacks';
import type { CallbackRenderContext } from './types';
import { rendererStyles } from './styles';

/**
 * Renders `KbaCreateCallback` with question selection and answer inputs.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered KBA form block.
 */
export function renderKbaCreateCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback, absoluteIndex } = entry;
  const { fieldValue, setFieldValue } = context;
  const draft = parseKbaDraft(fieldValue);
  const predefinedQuestions = readStringArray(callback.predefinedQuestions);
  const canUseCustomQuestion = readBoolean(callback.allowUserDefinedQuestions, false);
  const usingCustomQuestion =
    canUseCustomQuestion &&
    draft.selectedQuestion.length > 0 &&
    !predefinedQuestions.includes(draft.selectedQuestion);

  return (
    <View key={`${callback.type}-${absoluteIndex}`} style={rendererStyles.kbaContainer}>
      <Text style={commonStyles.inputLabel}>
        {readString(callback.prompt, 'Select a question')}
      </Text>
      <View style={rendererStyles.choiceRow}>
        {predefinedQuestions.map((question) => (
          <TouchableOpacity
            key={`${callback.type}-${absoluteIndex}-${question}`}
            style={[
              rendererStyles.choiceOutlineButton,
              draft.selectedQuestion === question &&
                rendererStyles.choiceOutlineButtonSelected,
            ]}
            onPress={() =>
              setFieldValue({
                ...draft,
                selectedQuestion: question,
              })
            }
          >
            <Text
              style={[
                rendererStyles.choiceOutlineButtonText,
                draft.selectedQuestion === question &&
                  rendererStyles.choiceOutlineButtonTextSelected,
              ]}
            >
              {question}
            </Text>
          </TouchableOpacity>
        ))}
        {canUseCustomQuestion ? (
          <TouchableOpacity
            style={[
              rendererStyles.choiceOutlineButton,
              usingCustomQuestion && rendererStyles.choiceOutlineButtonSelected,
            ]}
            onPress={() =>
              setFieldValue({
                ...draft,
                selectedQuestion: '',
              })
            }
          >
            <Text
              style={[
                rendererStyles.choiceOutlineButtonText,
                usingCustomQuestion && rendererStyles.choiceOutlineButtonTextSelected,
              ]}
            >
              Provide your own
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {canUseCustomQuestion &&
      (usingCustomQuestion || draft.selectedQuestion === '') ? (
        <TextInput
          style={commonStyles.input}
          value={draft.selectedQuestion}
        placeholder="Your Question"
        placeholderTextColor={colors.gray}
        onChangeText={(value) =>
          setFieldValue({
            ...draft,
            selectedQuestion: value,
          })
        }
      />
      ) : null}

      <TextInput
        style={[commonStyles.input, rendererStyles.kbaAnswerInput]}
        value={draft.selectedAnswer}
        placeholder="Answer"
        placeholderTextColor={colors.gray}
        onChangeText={(value) =>
          setFieldValue({
            ...draft,
            selectedAnswer: value,
          })
        }
      />
    </View>
  );
}
