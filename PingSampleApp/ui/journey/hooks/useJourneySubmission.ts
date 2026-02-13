/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import type { JourneyCallbackInput, JourneyClient } from '@ping-identity/rn-journey';
import {
  type CallbackEntry,
  type InputValues,
  callbackKey,
  isIntegrationRequiredCallback,
  isManualInputCallback,
  isOutputOnlyCallback,
  parseKbaDraft,
  readBoolean,
  readNumber,
  readString,
} from '../utils/callbacks';

/**
 * Input contract for Journey callback submission hook.
 */
export type UseJourneySubmissionParams = {
  callbackEntries: CallbackEntry[];
  inputValues: InputValues;
  next: JourneyClient['next'];
  loading: boolean;
  autoSubmitting: boolean;
  onSubmitPayload?: (
    callbacks: JourneyCallbackInput[],
    source: 'manual' | 'confirmation'
  ) => void;
};

/**
 * Result contract for Journey callback submission hook
 */
export type UseJourneySubmissionResult = {
  onSubmit: () => Promise<void>;
  onConfirmationSelect: (
    callbackType: string,
    typeIndex: number,
    optionIndex: number
  ) => Promise<void>;
  hasManualSubmit: boolean;
  hasBlockingIntegration: boolean;
  hasUnacceptedRequiredAgreements: boolean;
};

/**
 * Builds and submits callback mutation payloads for Journey progression.
 *
 * @param params - Hook input params.
 * @returns Submit handlers and derived callback flags.
 */
export function useJourneySubmission(
  params: UseJourneySubmissionParams
): UseJourneySubmissionResult {
  const {
    callbackEntries,
    inputValues,
    next,
    loading,
    autoSubmitting,
    onSubmitPayload,
  } = params;

  const buildMutations = useCallback((): JourneyCallbackInput[] => {
    const mutations: JourneyCallbackInput[] = [];

    callbackEntries.forEach(({ callback, typeIndex }) => {
      // These callback types are handled outside manual submit flow.
      if (callback.type === 'DeviceProfileCallback') {
        return;
      }
      if (callback.type === 'ConfirmationCallback') {
        return;
      }
      if (isOutputOnlyCallback(callback.type)) {
        return;
      }
      if (isIntegrationRequiredCallback(callback.type)) {
        return;
      }

      const key = callbackKey(callback.type, typeIndex);
      const currentValue = inputValues[key];

      switch (callback.type) {
        case 'BooleanAttributeInputCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readBoolean(currentValue, readBoolean(callback.value, false)),
          });
          break;
        case 'TermsAndConditionsCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readBoolean(
              currentValue,
              readBoolean(callback.accepted ?? callback.value, false)
            ),
          });
          break;
        case 'ConsentMappingCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readBoolean(
              currentValue,
              readBoolean(callback.accepted ?? callback.value, false)
            ),
          });
          break;
        case 'ChoiceCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: Math.max(
              0,
              Math.floor(readNumber(currentValue, readNumber(callback.selectedIndex, 0)))
            ),
          });
          break;
        case 'NumberAttributeInputCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readNumber(currentValue, readNumber(callback.value, 0)),
          });
          break;
        case 'KbaCreateCallback': {
          const draft = parseKbaDraft(currentValue);
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: {
              selectedQuestion: draft.selectedQuestion,
              selectedAnswer: draft.selectedAnswer,
              allowUserDefinedQuestions: draft.allowUserDefinedQuestions,
            },
          });
          break;
        }
        case 'HiddenValueCallback':
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readString(currentValue, readString(callback.value, '')),
          });
          break;
        default:
          // String fallback keeps sample behavior resilient for simple unknown
          // input callbacks while native stays authoritative for validation.
          mutations.push({
            type: callback.type,
            index: typeIndex,
            value: readString(currentValue, readString(callback.value, '')),
          });
          break;
      }
    });

    return mutations;
  }, [callbackEntries, inputValues]);

  const hasUnacceptedRequiredAgreements = useMemo(
    () =>
      callbackEntries.some(({ callback, typeIndex }) => {
        if (callback.type === 'TermsAndConditionsCallback') {
          const key = callbackKey(callback.type, typeIndex);
          const accepted = readBoolean(
            inputValues[key],
            readBoolean(callback.accepted ?? callback.value, false)
          );
          const required = readBoolean(callback.required, true);
          return required && !accepted;
        }

        if (callback.type === 'ConsentMappingCallback') {
          const key = callbackKey(callback.type, typeIndex);
          const accepted = readBoolean(
            inputValues[key],
            readBoolean(callback.accepted ?? callback.value, false)
          );
          const required = readBoolean(callback.required, false);
          return required && !accepted;
        }

        return false;
      }),
    [callbackEntries, inputValues]
  );

  const onSubmit = useCallback(async (): Promise<void> => {
    if (autoSubmitting || loading) {
      return;
    }
    if (hasUnacceptedRequiredAgreements) {
      Alert.alert('Accept required terms/consent to continue');
      return;
    }

    try {
      const callbacks = buildMutations();
      // Emit the exact payload to sample debug panel before progression.
      onSubmitPayload?.(callbacks, 'manual');
      await next({ callbacks });
    } catch (cause) {
      Alert.alert('Submit failed', String(cause));
    }
  }, [
    autoSubmitting,
    buildMutations,
    hasUnacceptedRequiredAgreements,
    loading,
    next,
    onSubmitPayload,
  ]);

  const onConfirmationSelect = useCallback(
    async (
      callbackType: string,
      typeIndex: number,
      optionIndex: number
    ): Promise<void> => {
      try {
        const callbacks: JourneyCallbackInput[] = [
          {
            type: callbackType,
            index: typeIndex,
            value: optionIndex,
          },
        ];
        onSubmitPayload?.(callbacks, 'confirmation');
        await next({
          callbacks,
        });
      } catch (cause) {
        Alert.alert('Submit failed', String(cause));
      }
    },
    [next, onSubmitPayload]
  );

  const hasManualSubmit = useMemo(
    () =>
      callbackEntries.some(({ callback }) => isManualInputCallback(callback.type)),
    [callbackEntries]
  );

  const hasBlockingIntegration = useMemo(
    () =>
      callbackEntries.some(
        ({ callback }) =>
          callback.type !== 'DeviceProfileCallback' &&
          isIntegrationRequiredCallback(callback.type)
      ),
    [callbackEntries]
  );

  return {
    onSubmit,
    onConfirmationSelect,
    hasManualSubmit,
    hasBlockingIntegration,
    hasUnacceptedRequiredAgreements,
  };
}
