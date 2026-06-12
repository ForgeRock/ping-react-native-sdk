/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { JourneyNextInput } from './config.types';
import type { JourneyCallback, JourneyCallbackType } from './node.types';

/**
 * Headless callback form helper type contracts.
 */

/**
 * Supported form value shape for normalized callback fields.
 */
export type JourneyFormValue =
  | string
  | number
  | boolean
  | null
  | {
      selectedQuestion: string;
      selectedAnswer: string;
      allowUserDefinedQuestions: boolean;
    };

/**
 * Form value map keyed by normalized callback field id.
 */
export type JourneyFormValues = Record<string, JourneyFormValue | undefined>;

/**
 * High-level field kind used by headless callback helpers.
 */
export type JourneyFieldKind =
  | 'text'
  | 'password'
  | 'number'
  | 'boolean'
  | 'choice'
  | 'kba'
  | 'output'
  | 'unknown';

/**
 * Callback execution mode classification for normalized fields.
 */
export type JourneyExecutionMode =
  | 'manual'
  | 'auto_capable'
  | 'integration_required'
  | 'output_only'
  | 'unsupported';

/**
 * Choice-style option surfaced by normalized callback helpers.
 */
export type JourneyFieldOption = {
  /**
   * Zero-based option index.
   */
  index: number;
  /**
   * Display label provided by callback payload.
   *
   * @remarks
   * This value may be empty when callback data omits an explicit label.
   */
  label: string;
  /**
   * Original option payload from native callback data.
   */
  value: unknown;
};

/**
 * Strongly typed callback reference for one callback instance in a node.
 */
export type JourneyFieldRef = {
  /**
   * Native callback type.
   */
  type: JourneyCallbackType;
  /**
   * Per-type callback index.
   */
  typeIndex: number;
};

/**
 * Normalized callback field shape used by headless callback helpers.
 */
export type JourneyNormalizedField = {
  /**
   * Stable internal field key.
   *
   * @remarks
   * Treat this as an opaque identifier and do not rely on its string format.
   */
  id: string;
  /**
   * Typed callback reference for this field.
   */
  ref: JourneyFieldRef;
  /**
   * Prompt text provided by the native callback payload.
   *
   * @remarks
   * This value may be empty when the callback does not provide a prompt.
   */
  prompt: string;
  /**
   * Optional callback message value.
   */
  message?: string;
  /**
   * Indicates whether this callback is marked as required by callback payload.
   */
  required: boolean;
  /**
   * UI-oriented field kind.
   */
  kind: JourneyFieldKind;
  /**
   * Execution mode classification for submit behavior.
   */
  executionMode: JourneyExecutionMode;
  /**
   * Indicates whether user interaction is required before submission.
   */
  requiresUserInput: boolean;
  /**
   * Optional default value derived from callback payload.
   */
  defaultValue?: JourneyFormValue;
  /**
   * Option collection for choice/confirmation callbacks.
   */
  options?: JourneyFieldOption[];
  /**
   * Original native callback payload.
   */
  raw: JourneyCallback;
};

/**
 * Stable issue code surfaced by callback submit helper.
 */
export type JourneySubmitIssueCode =
  | 'NO_ACTIVE_CONTINUE_NODE'
  | 'INTEGRATION_REQUIRED'
  | 'UNSUPPORTED_CALLBACK'
  | 'REQUIRED_CONSENT_MISSING'
  | 'INVALID_VALUE';

/**
 * Helper issue record for callback submit planning.
 */
export type JourneySubmitIssue = {
  /**
   * Stable issue code.
   */
  code: JourneySubmitIssueCode;
  /**
   * Human-readable issue message for UI display.
   */
  message: string;
  /**
   * Optional normalized field id associated with the issue.
   */
  fieldId?: string;
  /**
   * Optional callback type associated with the issue.
   */
  callbackType?: JourneyCallbackType;
};

/**
 * Result shape returned by callback submit builder helper.
 */
export type JourneyBuildNextInputResult = {
  /**
   * Indicates whether `input` can be safely submitted to `next()`.
   */
  canSubmit: boolean;
  /**
   * Callback payload built from normalized fields and form values.
   */
  input: JourneyNextInput;
  /**
   * Blocking/non-blocking issues found while building payload.
   */
  issues: JourneySubmitIssue[];
};

/**
 * Derived metadata returned by {@link useJourneyForm}.
 */
export type JourneyFormMeta = {
  /**
   * True when at least one callback requires manual value submission.
   */
  hasManual: boolean;
  /**
   * True when at least one callback is output-only.
   */
  hasOutputOnly: boolean;
  /**
   * True when at least one callback can be executed automatically.
   */
  hasAutoCapable: boolean;
  /**
   * True when at least one callback requires additional native integration.
   */
  hasIntegrationRequired: boolean;
  /**
   * True when at least one callback type is currently unsupported by helper logic.
   */
  hasUnsupported: boolean;
  /**
   * True when helper planner reports missing required consent callbacks.
   */
  hasRequiredConsentMissing: boolean;
};

/**
 * Options accepted by {@link useJourneyForm}.
 */
export type JourneyFormOptions = {
  /**
   * Callback types that the app has already handled via native integration
   * (for example FIDO, binding, or external IdP). When provided, matching
   * `integration_required` fields are excluded from submit issues so that
   * `canSubmit` reflects true readiness rather than blocking on already-handled
   * integrations.
   */
  handledCallbackTypes?: ReadonlySet<JourneyCallbackType>;
};

/**
 * Updater argument accepted by `setValues` from {@link useJourneyForm}.
 */
export type JourneyFormValuesUpdater =
  | Partial<JourneyFormValues>
  | ((previous: JourneyFormValues) => Partial<JourneyFormValues>);

/**
 * Return contract for {@link useJourneyForm}.
 */
export type JourneyFormResult = {
  /**
   * Normalized callback fields for the active Journey node.
   */
  fields: JourneyNormalizedField[];
  /**
   * Current form value map keyed by normalized field id.
   */
  values: JourneyFormValues;
  /**
   * Submit payload derived from `node + values`.
   */
  input: JourneyNextInput;
  /**
   * Indicates whether `input` can be safely submitted.
   */
  canSubmit: boolean;
  /**
   * Planning issues detected for the current submit payload.
   */
  issues: JourneySubmitIssue[];
  /**
   * Derived callback execution metadata.
   */
  meta: JourneyFormMeta;
  /**
   * Sets one normalized field value.
   *
   * @param fieldId - Normalized field id.
   * @param value - New field value.
   * @returns Void.
   */
  setValue: (fieldId: string, value: JourneyFormValue) => void;
  /**
   * Merges one or more field values.
   *
   * @param updater - Static patch object or updater function.
   * @returns Void.
   */
  setValues: (updater: JourneyFormValuesUpdater) => void;
  /**
   * Removes one field value.
   *
   * @param fieldId - Normalized field id.
   * @returns Void.
   */
  clearValue: (fieldId: string) => void;
  /**
   * Resets the full value map, then reapplies callback-provided defaults.
   *
   * @param nextValues - Optional reset base values.
   * @returns Void.
   */
  reset: (nextValues?: JourneyFormValues) => void;
  /**
   * Builds a submit plan from current values plus optional overrides.
   *
   * @param overrides - Optional value overrides applied before planning.
   * @returns Submit planning result.
   */
  buildInput: (
    overrides?: Partial<JourneyFormValues>,
  ) => JourneyBuildNextInputResult;
  /**
   * Returns one normalized field by id.
   *
   * @param fieldId - Normalized field id.
   * @returns Matching field or undefined.
   */
  getField: (fieldId: string) => JourneyNormalizedField | undefined;
  /**
   * Returns normalized fields for a callback type.
   *
   * @param callbackType - Native callback type.
   * @returns Matching fields for the callback type, or an empty list.
   */
  getFieldsByType: (
    callbackType: JourneyCallbackType,
  ) => JourneyNormalizedField[];
  /**
   * Returns one normalized field by callback type and per-type index.
   *
   * @param callbackType - Native callback type.
   * @param typeIndex - Optional per-type index (defaults to 0).
   * @returns Matching field or undefined.
   */
  getFieldByType: (
    callbackType: JourneyCallbackType,
    typeIndex?: number,
  ) => JourneyNormalizedField | undefined;
  /**
   * Sets one field value by callback type and per-type index.
   *
   * @param callbackType - Native callback type.
   * @param value - New field value.
   * @param typeIndex - Optional per-type index (defaults to 0).
   * @returns True when a matching field was found and updated.
   */
  setValueByType: (
    callbackType: JourneyCallbackType,
    value: JourneyFormValue,
    typeIndex?: number,
  ) => boolean;
};
