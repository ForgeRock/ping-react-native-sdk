/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { callbackType } from '@ping-identity/rn-types';
import type {
  JourneyBuildNextInputResult,
  JourneyCallback,
  JourneyCallbackInput,
  JourneyFieldCapability,
  JourneyFieldKind,
  JourneyFieldOption,
  JourneyFormValue,
  JourneyFormValues,
  JourneyNextInput,
  JourneyNode,
  JourneyNormalizedField,
  JourneySubmitIssue,
} from './types';

const integrationRequiredCallbackTypes = new Set<string>([
  callbackType.PingOneProtectInitializeCallback,
  callbackType.PingOneProtectEvaluationCallback,
  callbackType.SelectIdPCallback,
  callbackType.ReCaptchaCallback,
  callbackType.ReCaptchaEnterpriseCallback,
  'IdPCallback',
  'Fido2RegistrationCallback',
  'Fido2AuthenticationCallback',
  'FidoRegistrationCallback',
  'FidoAuthenticationCallback',
  'BindingCallback',
  'DeviceBindingCallback',
  'DeviceSigningVerifierCallback',
]);

const outputOnlyCallbackTypes = new Set<string>([
  callbackType.DeviceProfileCallback,
  callbackType.TextOutputCallback,
  callbackType.SuspendedTextOutputCallback,
  callbackType.MetadataCallback,
  callbackType.PollingWaitCallback,
]);

const manualCallbackTypes = new Set<string>([
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
  'ConsentMappingCallback',
]);

const booleanCallbackTypes = new Set<string>([
  callbackType.BooleanAttributeInputCallback,
  callbackType.TermsAndConditionsCallback,
  'ConsentMappingCallback',
]);

const numberCallbackTypes = new Set<string>([
  callbackType.NumberAttributeInputCallback,
]);

const choiceCallbackTypes = new Set<string>([
  callbackType.ChoiceCallback,
  callbackType.ConfirmationCallback,
]);

const passwordCallbackTypes = new Set<string>([
  callbackType.PasswordCallback,
  callbackType.ValidatedCreatePasswordCallback,
]);

const textCallbackTypes = new Set<string>([
  callbackType.NameCallback,
  callbackType.TextInputCallback,
  callbackType.StringAttributeInputCallback,
  callbackType.ValidatedCreateUsernameCallback,
  callbackType.HiddenValueCallback,
]);

const kbaCallbackTypes = new Set<string>([
  callbackType.KbaCreateCallback,
]);

/**
 * Creates a stable callback key from callback type and type-local index.
 *
 * @param type - Callback type.
 * @param index - Per-type callback index.
 * @returns Deterministic callback key.
 */
function callbackKey(type: string, index: number): string {
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
    const parsed = Number(value);
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
function resolveFieldKind(type: string): JourneyFieldKind {
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
 * Resolves callback execution capability for a callback type.
 *
 * @param type - Callback type.
 * @returns Callback capability.
 */
function resolveFieldCapability(type: string): JourneyFieldCapability {
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
 * Resolves callback option list for choice/confirmation/kba callbacks.
 *
 * @param callback - Journey callback payload.
 * @returns Option list.
 */
function resolveCallbackOptions(callback: JourneyCallback): JourneyFieldOption[] {
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
  type: string
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
  if (type === callbackType.ChoiceCallback || type === callbackType.ConfirmationCallback) {
    if (!hasCallbackKey(callback, 'selectedIndex')) {
      return undefined;
    }
    const selectedIndex = readNumber(callback.selectedIndex, Number.NaN);
    return Number.isFinite(selectedIndex) ? selectedIndex : undefined;
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
      'allowUserDefinedQuestions'
    );
    if (!hasSelectedQuestion && !hasSelectedAnswer && !hasAllowUserDefinedQuestions) {
      return undefined;
    }
    return {
      selectedQuestion: readString(callback.selectedQuestion, ''),
      selectedAnswer: readString(callback.selectedAnswer, ''),
      allowUserDefinedQuestions: readBoolean(callback.allowUserDefinedQuestions, false),
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
 * @returns Normalized field list with deterministic ids and capability metadata.
 */
export function normalizeCallbacks(node: JourneyNode | null | undefined): JourneyNormalizedField[] {
  if (!node || node.type !== 'ContinueNode' || !Array.isArray(node.callbacks)) {
    return [];
  }

  const counts: Record<string, number> = {};

  return node.callbacks.map((rawCallback) => {
    const callback = rawCallback as JourneyCallback;
    const type = readString(callback.type, 'UnknownCallback');
    const typeIndex = counts[type] ?? 0;
    counts[type] = typeIndex + 1;

    const kind = resolveFieldKind(type);
    const capability = resolveFieldCapability(type);
    const options = resolveCallbackOptions(callback);
    const prompt = readString(callback.prompt, '');
    const message = readString(callback.message, '');
    const required = resolveRequired(callback);

    return {
      id: callbackKey(type, typeIndex),
      type,
      typeIndex,
      prompt,
      message: message.length > 0 ? message : undefined,
      required,
      kind,
      capability,
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
  values: JourneyFormValues
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
    if (field.capability === 'output_only') {
      return;
    }

    if (field.capability === 'integration_required') {
      issues.push({
        code: 'INTEGRATION_REQUIRED',
        message: `Callback "${field.type}" requires additional integration.`,
        fieldId: field.id,
        callbackType: field.type,
      });
      return;
    }

    if (field.capability === 'unsupported') {
      issues.push({
        code: 'UNSUPPORTED_CALLBACK',
        message: `Callback "${field.type}" is not supported by the helper submit builder.`,
        fieldId: field.id,
        callbackType: field.type,
      });
      return;
    }

    const resolvedValue = values[field.id] ?? field.defaultValue;

    if (field.kind === 'boolean') {
      const accepted = readBoolean(resolvedValue, false);
      if (field.required && !accepted) {
        issues.push({
          code: 'REQUIRED_CONSENT_MISSING',
          message: `Required callback "${field.type}" must be accepted to continue.`,
          fieldId: field.id,
          callbackType: field.type,
        });
      }
      callbacks.push({
        type: field.type,
        index: field.typeIndex,
        value: accepted,
      });
      return;
    }

    if (field.kind === 'number') {
      const numericValue = readNumber(resolvedValue, Number.NaN);
      if (!Number.isFinite(numericValue)) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${field.type}" requires a numeric value.`,
          fieldId: field.id,
          callbackType: field.type,
        });
        return;
      }
      callbacks.push({
        type: field.type,
        index: field.typeIndex,
        value: numericValue,
      });
      return;
    }

    if (field.kind === 'choice') {
      const selected = readNumber(resolvedValue, Number.NaN);
      if (!Number.isFinite(selected)) {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${field.type}" requires a selected option index.`,
          fieldId: field.id,
          callbackType: field.type,
        });
        return;
      }
      callbacks.push({
        type: field.type,
        index: field.typeIndex,
        value: Math.max(0, Math.floor(selected)),
      });
      return;
    }

    if (field.kind === 'kba') {
      const kba = resolvedValue as JourneyFormValue;
      if (!kba || typeof kba !== 'object') {
        issues.push({
          code: 'INVALID_VALUE',
          message: `Callback "${field.type}" requires KBA question and answer values.`,
          fieldId: field.id,
          callbackType: field.type,
        });
        return;
      }

      const selectedQuestion = readString(
        (kba as Record<string, unknown>).selectedQuestion,
        ''
      );
      const selectedAnswer = readString(
        (kba as Record<string, unknown>).selectedAnswer,
        ''
      );
      const allowUserDefinedQuestions = readBoolean(
        (kba as Record<string, unknown>).allowUserDefinedQuestions,
        false
      );

      callbacks.push({
        type: field.type,
        index: field.typeIndex,
        value: {
          selectedQuestion,
          selectedAnswer,
          allowUserDefinedQuestions,
        },
      });
      return;
    }

    callbacks.push({
      type: field.type,
      index: field.typeIndex,
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
