/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  callbackType,
  nativeExtensionCallbackType,
} from '@ping-identity/rn-types';
import type {
  JourneyBuildNextInputResult,
  JourneyCallback,
  JourneyCallbackType,
  JourneyCallbackInput,
  JourneyExecutionMode,
  JourneyFieldKind,
  JourneyFieldOption,
  JourneyFormValue,
  JourneyFormValues,
  JourneyNextInput,
  JourneyNode,
  JourneyNormalizedField,
  JourneySubmitIssue,
} from './types';

const integrationRequiredCallbackTypes = new Set<JourneyCallbackType>([
  nativeExtensionCallbackType.FidoRegistrationCallback,
  nativeExtensionCallbackType.FidoAuthenticationCallback,
  callbackType.PingOneProtectInitializeCallback,
  callbackType.PingOneProtectEvaluationCallback,
  callbackType.SelectIdPCallback,
  callbackType.ReCaptchaCallback,
  callbackType.ReCaptchaEnterpriseCallback,
  nativeExtensionCallbackType.IdPCallback,
  nativeExtensionCallbackType.BindingCallback,
  nativeExtensionCallbackType.DeviceBindingCallback,
  nativeExtensionCallbackType.DeviceSigningVerifierCallback,
]);

const outputOnlyCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.DeviceProfileCallback,
  callbackType.TextOutputCallback,
  callbackType.SuspendedTextOutputCallback,
  callbackType.MetadataCallback,
  callbackType.PollingWaitCallback,
]);

const manualCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.NameCallback,
  callbackType.PasswordCallback,
  callbackType.TextInputCallback,
  callbackType.StringAttributeInputCallback,
  callbackType.NumberAttributeInputCallback,
  callbackType.BooleanAttributeInputCallback,
  callbackType.ChoiceCallback,
  callbackType.ConfirmationCallback,
  callbackType.KbaCreateCallback,
  callbackType.HiddenValueCallback,
  callbackType.TermsAndConditionsCallback,
  callbackType.ValidatedCreateUsernameCallback,
  callbackType.ValidatedCreatePasswordCallback,
  nativeExtensionCallbackType.ConsentMappingCallback,
]);

const booleanCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.BooleanAttributeInputCallback,
  callbackType.TermsAndConditionsCallback,
  nativeExtensionCallbackType.ConsentMappingCallback,
]);

const numberCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.NumberAttributeInputCallback,
]);

const choiceCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.ChoiceCallback,
  callbackType.ConfirmationCallback,
]);

const passwordCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.PasswordCallback,
  callbackType.ValidatedCreatePasswordCallback,
]);

const textCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.NameCallback,
  callbackType.TextInputCallback,
  callbackType.StringAttributeInputCallback,
  callbackType.ValidatedCreateUsernameCallback,
  callbackType.HiddenValueCallback,
]);

const kbaCallbackTypes = new Set<JourneyCallbackType>([
  callbackType.KbaCreateCallback,
]);

/**
 * Creates a stable callback key from callback type and type-local index.
 *
 * @param type - Callback type.
 * @param index - Per-type callback index.
 * @returns Deterministic callback key.
 */
function callbackKey(type: JourneyCallbackType, index: number): string {
  return `${type}:${index}`;
}

/**
 * Converts unknown values to strings.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value.
 * @returns Normalized string.
 */
function readString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

/**
 * Converts unknown values to numbers.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value.
 * @returns Normalized number.
 */
function readNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return fallback;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Converts unknown values to booleans.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value.
 * @returns Normalized boolean.
 */
function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return fallback;
}

/**
 * Converts unknown array-like values to a list.
 *
 * @param value - Candidate array value.
 * @returns Array value or empty array.
 */
function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Returns true when a callback payload explicitly provides a key.
 *
 * @param callback - Journey callback payload.
 * @param key - Property key.
 * @returns True when the key exists on the callback object.
 */
function hasCallbackKey(callback: JourneyCallback, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(callback, key);
}

/**
 * Resolves required flag from callback payload using common key variants.
 *
 * @param callback - Journey callback payload.
 * @returns Required flag.
 */
function resolveRequired(callback: JourneyCallback): boolean {
  if (hasCallbackKey(callback, 'required')) {
    return readBoolean(callback.required, false);
  }
  if (hasCallbackKey(callback, 'isRequired')) {
    return readBoolean(callback.isRequired, false);
  }
  return false;
}

/**
 * Resolves a high-level field kind for a callback type.
 *
 * @param type - Callback type.
 * @returns Field kind.
 */
function resolveFieldKind(type: JourneyCallbackType): JourneyFieldKind {
  if (outputOnlyCallbackTypes.has(type)) {
    return 'output';
  }
  if (passwordCallbackTypes.has(type)) {
    return 'password';
  }
  if (booleanCallbackTypes.has(type)) {
    return 'boolean';
  }
  if (numberCallbackTypes.has(type)) {
    return 'number';
  }
  if (choiceCallbackTypes.has(type)) {
    return 'choice';
  }
  if (kbaCallbackTypes.has(type)) {
    return 'kba';
  }
  if (textCallbackTypes.has(type)) {
    return 'text';
  }
  return 'unknown';
}

/**
 * Resolves callback execution mode for a callback type.
 *
 * @param type - Callback type.
 * @returns Callback execution mode.
 */
function resolveExecutionMode(type: JourneyCallbackType): JourneyExecutionMode {
  if (integrationRequiredCallbackTypes.has(type)) {
    return 'integration_required';
  }
  if (outputOnlyCallbackTypes.has(type)) {
    return 'output_only';
  }
  if (manualCallbackTypes.has(type)) {
    return 'manual';
  }
  return 'unsupported';
}

/**
 * Resolves whether a callback requires explicit user input.
 *
 * @param type - Callback type.
 * @param executionMode - Callback execution mode.
 * @returns True when the user must provide input.
 */
function resolveRequiresUserInput(
  type: JourneyCallbackType,
  executionMode: JourneyExecutionMode,
): boolean {
  if (executionMode !== 'manual') {
    return false;
  }

  return type !== callbackType.HiddenValueCallback;
}

/**
 * Resolves callback option list for choice/confirmation/kba callbacks.
 *
 * @param callback - Journey callback payload.
 * @returns Option list.
 */
function resolveCallbackOptions(
  callback: JourneyCallback,
): JourneyFieldOption[] {
  const mapOptions = (items: unknown[]): JourneyFieldOption[] =>
    items.map((option, index) => ({
      index,
      value: option,
      label:
        typeof option === 'string'
          ? option
          : readString((option as Record<string, unknown>).label, ''),
    }));

  // Confirmation callbacks expose `options`; Choice callbacks from native map to `choices`.
  const options = readArray(callback.options);
  if (options.length > 0) {
    return mapOptions(options);
  }

  const choices = readArray(callback.choices);
  if (choices.length > 0) {
    return mapOptions(choices);
  }

  const predefinedQuestions = readArray(callback.predefinedQuestions);
  if (predefinedQuestions.length > 0) {
    return predefinedQuestions.map((question, index) => ({
      index,
      value: question,
      label: readString(question, `Question ${index}`),
    }));
  }

  return [];
}

/**
 * Resolves a default value for a callback field.
 *
 * @param callback - Journey callback payload.
 * @param type - Callback type.
 * @returns Default form value when available.
 */
function resolveDefaultValue(
  callback: JourneyCallback,
  type: JourneyCallbackType,
): JourneyFormValue | undefined {
  if (booleanCallbackTypes.has(type)) {
    if (hasCallbackKey(callback, 'accepted')) {
      return readBoolean(callback.accepted, false);
    }
    if (hasCallbackKey(callback, 'value')) {
      return readBoolean(callback.value, false);
    }
    return undefined;
  }
  if (
    type === callbackType.ChoiceCallback ||
    type === callbackType.ConfirmationCallback
  ) {
    if (!hasCallbackKey(callback, 'selectedIndex')) {
      return undefined;
    }
    const selectedIndex = readNumber(callback.selectedIndex, Number.NaN);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 0) {
      return undefined;
    }
    return selectedIndex;
  }
  if (numberCallbackTypes.has(type)) {
    if (!hasCallbackKey(callback, 'value')) {
      return undefined;
    }
    const numberValue = readNumber(callback.value, Number.NaN);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
  if (kbaCallbackTypes.has(type)) {
    const hasSelectedQuestion = hasCallbackKey(callback, 'selectedQuestion');
    const hasSelectedAnswer = hasCallbackKey(callback, 'selectedAnswer');
    const hasAllowUserDefinedQuestions = hasCallbackKey(
      callback,
      'allowUserDefinedQuestions',
    );
    if (
      !hasSelectedQuestion &&
      !hasSelectedAnswer &&
      !hasAllowUserDefinedQuestions
    ) {
      return undefined;
    }
    return {
      selectedQuestion: readString(callback.selectedQuestion, ''),
      selectedAnswer: readString(callback.selectedAnswer, ''),
      allowUserDefinedQuestions: readBoolean(
        callback.allowUserDefinedQuestions,
        false,
      ),
    };
  }
  if (textCallbackTypes.has(type) || passwordCallbackTypes.has(type)) {
    if (!hasCallbackKey(callback, 'value')) {
      return undefined;
    }
    return readString(callback.value, '');
  }
  return undefined;
}

/**
 * Returns normalized callback fields for a ContinueNode.
 *
 * @param node - Journey node from `useJourney`.
 * @returns Normalized field list with deterministic ids and execution-mode metadata.
 */
export function normalizeCallbacks(
  node: JourneyNode | null | undefined,
): JourneyNormalizedField[] {
  if (!node || node.type !== 'ContinueNode' || !Array.isArray(node.callbacks)) {
    return [];
  }

  const counts = new Map<JourneyCallbackType, number>();

  return node.callbacks.map((rawCallback) => {
    const callback = rawCallback as JourneyCallback;
    const type: JourneyCallbackType = callback.type;
    const typeIndex = counts.get(type) ?? 0;
    counts.set(type, typeIndex + 1);

    const kind = resolveFieldKind(type);
    const executionMode = resolveExecutionMode(type);
    const requiresUserInput = resolveRequiresUserInput(type, executionMode);
    const options = resolveCallbackOptions(callback);
    const prompt = readString(callback.prompt, '');
    const message = readString(callback.message, '');
    const required = resolveRequired(callback);

    return {
      id: callbackKey(type, typeIndex),
      ref: {
        type,
        typeIndex,
      },
      prompt,
      message: message.length > 0 ? message : undefined,
      required,
      kind,
      executionMode,
      requiresUserInput,
      defaultValue: resolveDefaultValue(callback, type),
      options: options.length > 0 ? options : undefined,
      raw: callback,
    };
  });
}

/**
 * Builds a `next()` payload from normalized callback fields and form values.
 *
 * @param node - Journey node from `useJourney`.
 * @param values - Form values keyed by normalized field id.
 * @returns Submit planning result with payload and issues.
 */
export function buildNextInput(
  node: JourneyNode | null | undefined,
  values: JourneyFormValues,
): JourneyBuildNextInputResult {
  if (!node || node.type !== 'ContinueNode') {
    return {
      canSubmit: false,
      input: {},
      issues: [
        {
          code: 'NO_ACTIVE_CONTINUE_NODE',
          message: 'No active ContinueNode. Call start() or resume() first.',
        },
      ],
    };
  }

  const fields = normalizeCallbacks(node);
  const callbacks: JourneyCallbackInput[] = [];
  const issues: JourneySubmitIssue[] = [];

  fields.forEach((field) => {
    const callbackType = field.ref.type;
    const callbackIndex = field.ref.typeIndex;

    if (field.executionMode === 'output_only') {
      return;
    }

    if (field.executionMode === 'auto_capable') {
      issues.push({
        code: 'INTEGRATION_REQUIRED',
        message: `Callback "${callbackType}" requires additional integration.`,
        fieldId: field.id,
        callbackType,
      });
      return;
    }

    if (field.executionMode === 'integration_required') {
      issues.push({
        code: 'INTEGRATION_REQUIRED',
        message: `Callback "${callbackType}" requires additional integration.`,
        fieldId: field.id,
        callbackType,
      });
      return;
    }

    if (field.executionMode === 'unsupported') {
      issues.push({
        code: 'UNSUPPORTED_CALLBACK',
        message: `Callback "${callbackType}" is not supported by the helper submit builder.`,
        fieldId: field.id,
        callbackType,
      });
      return;
    }

    const resolvedValue = values[field.id] ?? field.defaultValue;

    if (field.kind === 'boolean') {
      const accepted = readBoolean(resolvedValue, false);
      if (field.required && !accepted) {
        issues.push({
          code: 'REQUIRED_CONSENT_MISSING',
          message: `Required callback "${callbackType}" must be accepted to continue.`,
          fieldId: field.id,
          callbackType,
        });
      }
      callbacks.push({
        type: callbackType,
        index: callbackIndex,
        value: accepted,
      });
      return;
    }

    if (field.kind === 'number') {
      const numericValue = readNumber(resolvedValue, Number.NaN);
      if (!Number.isFinite(numericValue)) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" requires a numeric value.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }
      callbacks.push({
        type: callbackType,
        index: callbackIndex,
        value: numericValue,
      });
      return;
    }

    if (field.kind === 'choice') {
      const selected = readNumber(resolvedValue, Number.NaN);
      if (
        !Number.isFinite(selected) ||
        !Number.isInteger(selected) ||
        selected < 0
      ) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" requires a selected option index.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }

      if (field.options && selected >= field.options.length) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" selected option index is out of range.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }

      callbacks.push({
        type: callbackType,
        index: callbackIndex,
        value: selected,
      });
      return;
    }

    if (field.kind === 'kba') {
      const kba = resolvedValue as JourneyFormValue;
      if (!kba || typeof kba !== 'object') {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" requires KBA question and answer values.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }

      const selectedQuestion = readString(
        (kba as Record<string, unknown>).selectedQuestion,
        '',
      );
      const selectedAnswer = readString(
        (kba as Record<string, unknown>).selectedAnswer,
        '',
      );
      const allowUserDefinedQuestions = readBoolean(
        (kba as Record<string, unknown>).allowUserDefinedQuestions,
        false,
      );
      if (
        field.required &&
        (selectedQuestion.trim().length === 0 ||
          selectedAnswer.trim().length === 0)
      ) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" requires non-empty KBA question and answer values.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }

      callbacks.push({
        type: callbackType,
        index: callbackIndex,
        value: {
          selectedQuestion,
          selectedAnswer,
          allowUserDefinedQuestions,
        },
      });
      return;
    }

    if (field.kind === 'text' || field.kind === 'password') {
      const textValue = readString(resolvedValue, '');
      if (field.required && textValue.trim().length === 0) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${callbackType}" requires a non-empty value.`,
          fieldId: field.id,
          callbackType,
        });
        return;
      }
      callbacks.push({
        type: callbackType,
        index: callbackIndex,
        value: textValue,
      });
      return;
    }

    callbacks.push({
      type: callbackType,
      index: callbackIndex,
      value: readString(resolvedValue, ''),
    });
  });

  const input: JourneyNextInput = callbacks.length > 0 ? { callbacks } : {};

  return {
    canSubmit: issues.length === 0,
    input,
    issues,
  };
}
