/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { callbackType } from '@ping-identity/rn-types';
import type { NodeCallback } from '@ping-identity/rn-types';

/**
 * Journey callback shape used by the sample app renderer.
 *
 * @remarks
 * Based on shared sdk-types (`NodeCallback`) with bridge-specific fields added.
 */
export type JourneyCallbackLike = Omit<NodeCallback, 'type'> & {
  type: string;
  prompt?: string;
  message?: string;
  value?: unknown;
  [key: string]: unknown;
};

/**
 * Draft state for `KbaCreateCallback` in the sample form.
 */
export type KbaDraft = {
  selectedQuestion: string;
  selectedAnswer: string;
  allowUserDefinedQuestions: boolean;
};

/**
 * Local callback input state keyed by callback type/index.
 */
export type InputValues = Record<string, string | number | boolean | KbaDraft>;

/**
 * Callback metadata computed per node for deterministic rendering/submission.
 */
export type CallbackEntry = {
  callback: JourneyCallbackLike;
  absoluteIndex: number;
  typeIndex: number;
};

const sdkIntegrationRequiredCallbackTypes = [
  callbackType.DeviceProfileCallback,
  callbackType.PingOneProtectInitializeCallback,
  callbackType.PingOneProtectEvaluationCallback,
  callbackType.SelectIdPCallback,
  callbackType.ReCaptchaCallback,
  callbackType.ReCaptchaEnterpriseCallback,
] as const;

// Native callback names not yet exported by `@ping-identity/rn-types`.
const nativeExtensionIntegrationRequiredCallbackTypes = [
  'IdPCallback',
  'Fido2RegistrationCallback',
  'Fido2AuthenticationCallback',
  'FidoRegistrationCallback',
  'FidoAuthenticationCallback',
  'BindingCallback',
  'DeviceBindingCallback',
  'DeviceSigningVerifierCallback',
] as const;

const integrationRequiredCallbackTypes = new Set<string>([
  ...sdkIntegrationRequiredCallbackTypes,
  ...nativeExtensionIntegrationRequiredCallbackTypes,
]);

const sdkOutputOnlyCallbackTypes = [
  callbackType.TextOutputCallback,
  callbackType.SuspendedTextOutputCallback,
  callbackType.MetadataCallback,
  callbackType.PollingWaitCallback,
] as const;

const outputOnlyCallbackTypes = new Set<string>(sdkOutputOnlyCallbackTypes);

const sdkManualInputCallbackTypes = [
  callbackType.NameCallback,
  callbackType.PasswordCallback,
  callbackType.TextInputCallback,
  callbackType.StringAttributeInputCallback,
  callbackType.NumberAttributeInputCallback,
  callbackType.BooleanAttributeInputCallback,
  callbackType.ChoiceCallback,
  callbackType.TermsAndConditionsCallback,
  callbackType.KbaCreateCallback,
  callbackType.HiddenValueCallback,
  callbackType.ValidatedCreateUsernameCallback,
  callbackType.ValidatedCreatePasswordCallback,
] as const;

// Currently surfaced by Android Journey sample flows.
const nativeExtensionManualInputCallbackTypes = [
  'ConsentMappingCallback',
] as const;

const manualInputCallbackTypes = new Set<string>([
  ...sdkManualInputCallbackTypes,
  ...nativeExtensionManualInputCallbackTypes,
]);

/**
 * Converts unknown values into display-safe strings.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value when conversion is not possible.
 * @returns Normalized string value.
 */
export function readString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

/**
 * Converts unknown values into numeric values.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value when conversion is not possible.
 * @returns Normalized numeric value.
 */
export function readNumber(value: unknown, fallback = 0): number {
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
 * Converts unknown values into boolean values.
 *
 * @param value - Arbitrary input value.
 * @param fallback - Fallback value when conversion is not possible.
 * @returns Normalized boolean value.
 */
export function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return fallback;
}

/**
 * Converts unknown values into string arrays.
 *
 * @param value - Arbitrary input value.
 * @returns Array of non-empty strings.
 */
export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readString(item)).filter((item) => item.length > 0);
}

/**
 * Builds a stable callback key from callback type and type-local index.
 *
 * @param type - Callback type.
 * @param index - Per-type callback index.
 * @returns Stable callback key.
 */
export function callbackKey(type: string, index: number): string {
  return `${type}:${index}`;
}

/**
 * Builds a stable node key used to deduplicate auto-submission behavior.
 *
 * @param nodeId - Native node id.
 * @param callbacks - Callback list from the node.
 * @returns Deterministic node key.
 */
export function nodeKey(
  nodeId: string | undefined,
  callbacks: JourneyCallbackLike[]
): string {
  if (nodeId && nodeId.length > 0) {
    return nodeId;
  }
  const signature = callbacks.map((callback) => callback.type).join('|');
  return `node:${signature}`;
}

/**
 * Indicates whether a callback requires extra native module integration.
 *
 * @param type - Callback type.
 * @returns `true` when the callback cannot be fulfilled by the generic sample renderer.
 */
export function isIntegrationRequiredCallback(type: string): boolean {
  return integrationRequiredCallbackTypes.has(type);
}

/**
 * Indicates whether callback is informational/output-only.
 *
 * @param type - Callback type.
 * @returns `true` when callback does not require user-submitted input.
 */
export function isOutputOnlyCallback(type: string): boolean {
  return outputOnlyCallbackTypes.has(type);
}

/**
 * Indicates whether callback participates in manual `Continue` submission.
 *
 * @param type - Callback type.
 * @returns `true` when callback contributes form input data.
 */
export function isManualInputCallback(type: string): boolean {
  return manualInputCallbackTypes.has(type);
}

/**
 * Creates a KBA draft from callback defaults.
 *
 * @param callback - Journey callback.
 * @returns Initial KBA draft state.
 */
export function buildKbaDraft(callback: JourneyCallbackLike): KbaDraft {
  const predefinedQuestions = readStringArray(callback.predefinedQuestions);
  const selectedQuestion = readString(
    callback.selectedQuestion,
    predefinedQuestions[0] ?? ''
  );
  const selectedAnswer = readString(callback.selectedAnswer, '');
  const allowUserDefinedQuestions = readBoolean(
    callback.allowUserDefinedQuestions,
    false
  );

  return {
    selectedQuestion,
    selectedAnswer,
    allowUserDefinedQuestions,
  };
}

/**
 * Converts stored input into a normalized KBA draft.
 *
 * @param value - Persisted form input value.
 * @returns Normalized KBA draft.
 */
export function parseKbaDraft(
  value: string | number | boolean | KbaDraft | undefined
): KbaDraft {
  if (!value || typeof value !== 'object') {
    return {
      selectedQuestion: '',
      selectedAnswer: '',
      allowUserDefinedQuestions: false,
    };
  }
  const draft = value as KbaDraft;
  return {
    selectedQuestion: readString(draft.selectedQuestion),
    selectedAnswer: readString(draft.selectedAnswer),
    allowUserDefinedQuestions: readBoolean(draft.allowUserDefinedQuestions),
  };
}
