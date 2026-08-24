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
 * Base shape shared by all normalized callback fields.
 *
 * @remarks
 * `raw` is the original native callback payload and serves as the escape hatch
 * to access any field not surfaced by the specific field type.
 *
 * Use `field.type` (shorthand for `field.ref.type`) as the discriminant to
 * narrow to a specific field subtype.
 */
export type JourneyBaseField = {
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
   * Callback type shorthand — equivalent to `ref.type`.
   *
   * @remarks
   * Use this as the discriminant to narrow the field to a specific subtype.
   */
  type: JourneyCallbackType;
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
   * Original native callback payload (escape hatch).
   */
  raw: JourneyCallback;
};

/**
 * Normalized field for a `ChoiceCallback` with typed named fields.
 *
 * @public
 */
export type JourneyChoiceField = JourneyBaseField & {
  type: 'ChoiceCallback';
  /** Available choices provided by the server. */
  choices: string[];
  /** Zero-based index of the server-suggested default choice. */
  defaultChoice: number;
};

/**
 * Normalized field for a `ConfirmationCallback` with typed named fields.
 *
 * @public
 */
export type JourneyConfirmationField = JourneyBaseField & {
  type: 'ConfirmationCallback';
  /**
   * Currently selected option index.
   *
   * @remarks
   * Normalized option labels are available via the inherited `options` field
   * (typed as `JourneyFieldOption[]`).
   */
  selectedIndex?: number;
  /** Default option label. */
  defaultOption?: string;
  /**
   * Option type discriminator emitted by native (e.g. `YES_NO_OPTION`, `YES_NO_CANCEL_OPTION`).
   *
   * @remarks
   * Use this to determine which button set to render for the confirmation dialog.
   */
  optionType?: string;
  /**
   * Message type discriminator emitted by native (e.g. `INFORMATION`, `WARNING`, `ERROR`).
   *
   * @remarks
   * Use this to apply appropriate styling or severity indicators to the dialog message.
   */
  messageType?: string;
};

/**
 * Normalized field for a `KbaCreateCallback` with typed named fields.
 *
 * @public
 */
export type JourneyKbaCreateField = JourneyBaseField & {
  type: 'KbaCreateCallback';
  /** Server-provided predefined question list. */
  predefinedQuestions: string[];
  /** Whether users may supply a custom question. */
  allowUserDefinedQuestions?: boolean;
};

/**
 * Normalized field for a `TermsAndConditionsCallback` with typed named fields.
 *
 * @public
 */
export type JourneyTermsAndConditionsField = JourneyBaseField & {
  type: 'TermsAndConditionsCallback';
  /** Terms version identifier. */
  version: string;
  /** Terms text. */
  terms: string;
  /** Terms creation date. */
  createDate: string;
};

/**
 * Normalized field for a `ConsentMappingCallback` with typed named fields.
 *
 * @public
 */
export type JourneyConsentMappingField = JourneyBaseField & {
  type: 'ConsentMappingCallback';
  /** Consent mapping name. */
  name: string;
  /** Display name for UI rendering. */
  displayName?: string;
  /** Icon URL or identifier for the consent mapping. */
  icon?: string;
  /** Access level granted by accepting this consent. */
  accessLevel?: string;
  /** Consent field definitions. */
  fields?: unknown[];
};

/**
 * Normalized field for a `HiddenValueCallback` with typed named fields.
 *
 * @public
 */
export type JourneyHiddenValueField = JourneyBaseField & {
  type: 'HiddenValueCallback';
  /**
   * Hidden field parameter name from the native callback.
   *
   * @remarks
   * Named `callbackId` to avoid shadowing the `id` field key on `JourneyBaseField`.
   */
  callbackId: string;
};

/**
 * Normalized field for a `PollingWaitCallback` with typed named fields.
 *
 * @public
 */
export type JourneyPollingWaitField = JourneyBaseField & {
  type: 'PollingWaitCallback';
  /** Suggested polling interval in milliseconds. */
  waitTime: number;
};

/**
 * Normalized field for a `TextOutputCallback` with typed named fields.
 *
 * @public
 */
export type JourneyTextOutputField = JourneyBaseField & {
  type: 'TextOutputCallback';
  /** Message type discriminator (INFO, WARNING, ERROR). */
  messageType: string;
};

/**
 * Normalized field for a `SuspendedTextOutputCallback` with typed named fields.
 *
 * @public
 */
export type JourneySuspendedTextOutputField = JourneyBaseField & {
  type: 'SuspendedTextOutputCallback';
  /** Message type discriminator. */
  messageType: string;
};

/**
 * Normalized field for a `FidoRegistrationCallback` with typed named fields.
 *
 * @remarks
 * Use `rn-fido` (`registerForJourney`) to drive the registration flow.
 *
 * The `value` field is present on iOS only — the native iOS bridge aliases
 * MetadataCallback-backed FIDO flows to `"FidoRegistrationCallback"` and emits the WebAuthn
 * credential creation options as `value`. On Android, MetadataCallback-backed FIDO flows
 * surface as `type: "MetadataCallback"` directly; `value` is always `undefined` on Android
 * for this normalized field type.
 *
 * @public
 */
export type JourneyFidoRegistrationField = JourneyBaseField & {
  type: 'FidoRegistrationCallback';
  /**
   * WebAuthn credential creation options.
   *
   * @remarks
   * iOS only — always `undefined` on Android. See type-level remarks for details.
   */
  value?: Record<string, unknown>;
};

/**
 * Normalized field for a `FidoAuthenticationCallback` with typed named fields.
 *
 * @remarks
 * Use `rn-fido` (`authenticateForJourney`) to drive the authentication flow.
 *
 * The `value` field is present on iOS only — the native iOS bridge aliases
 * MetadataCallback-backed FIDO flows to `"FidoAuthenticationCallback"` and emits the WebAuthn
 * assertion options as `value`. On Android, MetadataCallback-backed FIDO flows surface as
 * `type: "MetadataCallback"` directly; `value` is always `undefined` on Android for this
 * normalized field type.
 *
 * @public
 */
export type JourneyFidoAuthenticationField = JourneyBaseField & {
  type: 'FidoAuthenticationCallback';
  /**
   * WebAuthn assertion options.
   *
   * @remarks
   * iOS only — always `undefined` on Android. See type-level remarks for details.
   */
  value?: Record<string, unknown>;
};

/**
 * Normalized field for a `DeviceBindingCallback`.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-binding` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceBindingField = JourneyBaseField & {
  type: 'DeviceBindingCallback';
};

/**
 * Normalized field for a `DeviceSigningVerifierCallback`.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-binding` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceSigningVerifierField = JourneyBaseField & {
  type: 'DeviceSigningVerifierCallback';
};

/**
 * Normalized field for a `DeviceProfileCallback`.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-device-profile` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceProfileField = JourneyBaseField & {
  type: 'DeviceProfileCallback';
};

/**
 * Normalized field for an `IdpCallback`.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-external-idp` integration to handle this callback.
 *
 * @public
 */
export type JourneyIdpField = JourneyBaseField & {
  type: 'IdpCallback';
};

/**
 * Normalized field for a `SelectIdpCallback`.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-external-idp` integration to handle this callback.
 *
 * @public
 */
export type JourneySelectIdpField = JourneyBaseField & {
  type: 'SelectIdpCallback';
};

/**
 * Normalized callback field shape used by headless callback helpers.
 *
 * @remarks
 * A discriminated union narrowed by `field.type`. Known callback types expose
 * named typed fields directly on the field (for example `JourneyChoiceField`
 * has `choices: string[]` and `defaultChoice: number`). Callbacks from other
 * SDK packages — FIDO (`rn-fido`), device binding (`rn-binding`), device
 * profile (`rn-device-profile`), and external IdP (`rn-external-idp`) — are
 * represented as marker types or typed variants where the bridge emits named
 * fields. All other types fall through to `JourneyBaseField`.
 *
 * `field.raw` is the original native callback payload and is preserved as an
 * escape hatch on every variant.
 *
 * @example
 * ```ts
 * if (field.type === 'ChoiceCallback') {
 *   field.choices        // string[]
 *   field.defaultChoice  // number
 * }
 * ```
 *
 * @public
 */
export type JourneyNormalizedField =
  | JourneyChoiceField
  | JourneyConfirmationField
  | JourneyKbaCreateField
  | JourneyTermsAndConditionsField
  | JourneyConsentMappingField
  | JourneyHiddenValueField
  | JourneyPollingWaitField
  | JourneyTextOutputField
  | JourneySuspendedTextOutputField
  | JourneyFidoRegistrationField
  | JourneyFidoAuthenticationField
  | JourneyDeviceBindingField
  | JourneyDeviceSigningVerifierField
  | JourneyDeviceProfileField
  | JourneyIdpField
  | JourneySelectIdpField
  | JourneyBaseField;

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
   * True after the first {@link JourneyFormResult.markAttempted} call.
   *
   * @remarks
   * Gate error display on this flag so validation messages only appear after
   * the user has attempted submission. Resets to `false` on node change.
   */
  attempted: boolean;
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
  /**
   * Marks the form as attempted.
   *
   * @remarks
   * Call this when the user first tries to submit. Sets {@link JourneyFormResult.attempted}
   * to `true` so the UI can gate error display on submission intent.
   *
   * @returns Void.
   */
  markAttempted: () => void;
};
