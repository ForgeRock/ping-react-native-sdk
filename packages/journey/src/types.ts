/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  GenericError,
  Node,
  NodeCallback,
} from '@ping-identity/rn-types';
import type { LoggerInstance, NativeLoggerHandle } from '@react-native-pingidentity/logger';
import type { SessionStorage } from '@react-native-pingidentity/storage';

/**
 * Node discriminator returned by the Journey bridge.
 */
export type JourneyNodeType =
  | 'ContinueNode'
  | 'ErrorNode'
  | 'FailureNode'
  | 'SuccessNode';

/**
 * Native callback payload surfaced to JavaScript.
 */
export type JourneyCallback = NodeCallback & {
  /** Native callback type (for example, `NameCallback`). */
  type: string;
  /** Optional user-facing prompt string emitted by native. */
  prompt?: string;
  /** Optional user-facing message emitted by native. */
  message?: string;
  /** Optional callback value emitted by native. */
  value?: unknown;
  /** Optional callback metadata emitted by native. */
  [key: string]: unknown;
};

/**
 * Journey node payload returned by native execution.
 */
export type JourneyNode = Node & {
  /** Terminal/non-terminal node discriminator. */
  type?: JourneyNodeType;
  /** Optional node-level message from native/server. */
  message?: string;
  /** Optional failure cause message for `FailureNode`. */
  cause?: string;
  /** Optional raw input payload from native node. */
  input?: Record<string, unknown>;
  /** Callback collection when additional user input is required. */
  callbacks?: JourneyCallback[];
};

/**
 * Journey client base configuration.
 */
export type JourneyConfig = {
  /**
   * Base AM/Ping server URL.
   */
  serverUrl: string;
  /**
   * Optional Journey realm.
   */
  realm?: string;
  /**
   * Optional Journey cookie name override.
   */
  cookie?: string;
  /**
   * Optional OIDC client identifier for Journey+OIDC composition.
   */
  clientId?: string;
  /**
   * Optional OIDC discovery endpoint.
   */
  discoveryEndpoint?: string;
  /**
   * Optional OIDC redirect URI.
   */
  redirectUri?: string;
  /**
   * Optional OIDC scopes for post-auth token flows.
   */
  scopes?: string[];
  /**
   * Optional JavaScript logger instance.
   */
  logger?: LoggerInstance;
  /**
   * Optional native logger handle.
   */
  nativeLogger?: NativeLoggerHandle;
};

/**
 * Optional Journey module integrations.
 */
export type JourneyModules = {
  /**
   * Session module configuration.
   */
  session?: {
    /**
     * Session storage handle created by the storage module.
     */
    storage?: SessionStorage;
  };
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyStartOptions = {
  /**
   * Force authentication even if an SSO session exists.
   */
  forceAuth?: boolean;
  /**
   * Ignore existing session state and start a fresh flow.
   */
  noSession?: boolean;
};

/**
 * Callback input value submitted to `next()`.
 */
export type JourneyCallbackInputValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | Array<unknown>;

/**
 * Callback mutation entry submitted to `next()`.
 */
export type JourneyCallbackInput = {
  /** Callback type to mutate. */
  type: string;
  /** Callback value to apply. */
  value?: JourneyCallbackInputValue;
  /**
   * Optional zero-based index when multiple callbacks share the same `type`.
   */
  index?: number;
};

/**
 * Payload for advancing a Journey node.
 */
export type JourneyNextInput = {
  /**
   * Callback mutations to apply before calling native `next()`.
   */
  callbacks?: JourneyCallbackInput[];
};

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
 * Callback execution capability classification for normalized fields.
 */
export type JourneyFieldCapability =
  | 'manual'
  | 'output_only'
  | 'integration_required'
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
 * Normalized callback field shape used by headless callback helpers.
 */
export type JourneyNormalizedField = {
  /**
   * Stable callback field id (`<type>:<typeIndex>`).
   */
  id: string;
  /**
   * Native callback type string.
   */
  type: string;
  /**
   * Per-type callback index for deterministic `next()` payloads.
   */
  typeIndex: number;
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
   * Capability classification for submit behavior.
   */
  capability: JourneyFieldCapability;
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
  callbackType?: string;
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
 * Seeding policy used by {@link useJourneyForm}.
 */
export type JourneyFormSeedStrategy = 'defaultValueOnly' | 'smart';

/**
 * Optional configuration for {@link useJourneyForm}.
 */
export type JourneyFormOptions = {
  /**
   * Optional initial values keyed by normalized field id.
   */
  initialValues?: JourneyFormValues;
  /**
   * Resets value map when the active Journey node changes.
   *
   * @defaultValue true
   */
  resetOnNodeChange?: boolean;
  /**
   * Controls how missing field values are seeded.
   *
   * - `defaultValueOnly`: only callback-provided defaults are applied.
   * - `smart`: callback defaults plus ergonomic kind-based defaults.
   *
   * @defaultValue 'smart'
   */
  seedStrategy?: JourneyFormSeedStrategy;
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
   * True when at least one callback requires extra module integration.
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
   * Derived callback capability metadata.
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
   * Resets the full value map, then reapplies field seeding policy.
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
  buildInput: (overrides?: Partial<JourneyFormValues>) => JourneyBuildNextInputResult;
  /**
   * Returns one normalized field by id.
   *
   * @param fieldId - Normalized field id.
   * @returns Matching field or undefined.
   */
  getField: (fieldId: string) => JourneyNormalizedField | undefined;
};

/**
 * User profile claims resolved from OIDC userinfo.
 */
export type JourneyUserInfo = Record<string, unknown>;

/**
 * Session payload exposed by `user()`.
 */
export type JourneyUserSession = {
  /**
   * Access token string.
   */
  accessToken: string;
  /**
   * Optional refresh token string.
   */
  refreshToken?: string;
  /**
   * Optional token expiry in seconds.
   */
  expiresIn?: number;
  /**
   * Optional user profile claims.
   */
  userInfo?: JourneyUserInfo;
};

/**
 * Journey error payload contract.
 */
export type JourneyError = GenericError;

/**
 * Stable Journey error codes surfaced by native and JS guardrails.
 */
export type JourneyErrorCode =
  | 'JOURNEY_CONFIG_ERROR'
  | 'JOURNEY_INIT_ERROR'
  | 'JOURNEY_START_ERROR'
  | 'JOURNEY_NEXT_ERROR'
  | 'JOURNEY_RESUME_ERROR'
  | 'JOURNEY_USER_ERROR'
  | 'JOURNEY_LOGOUT_ERROR'
  | 'JOURNEY_DISPOSE_ERROR'
  | 'JOURNEY_STATE_ERROR'
  | 'JOURNEY_CALLBACK_APPLY_ERROR'
  | 'JOURNEY_UNSUPPORTED_CALLBACK_ERROR'
  | 'JOURNEY_MISSING_INTEGRATION_ERROR';

/**
 * Native-backed Journey client contract.
 */
export type JourneyClient = {
  /**
   * Explicitly initialize the native Journey instance.
   *
   * @returns Native Journey instance identifier.
   * @throws {JourneyError} When the Journey cannot be configured.
   */
  init: () => Promise<string>;

  /**
   * Returns the native Journey instance identifier.
   *
   * @returns Native Journey instance identifier.
   * @throws {JourneyError} When the Journey is not configured.
   */
  getId: () => Promise<string>;

  /**
   * Start a Journey by name.
   *
   * @param journeyName - Journey/tree name configured on the server.
   * @param options - Optional start flags.
   * @returns The first Journey node.
   * @throws {JourneyError} When start fails.
   */
  start: (
    journeyName: string,
    options?: JourneyStartOptions
  ) => Promise<JourneyNode>;

  /**
   * Advance an active Journey by applying callback input.
   *
   * @param input - Callback value payload for the active node.
   * @returns Next Journey node.
   * @throws {JourneyError} When callback application or progression fails.
   */
  next: (input?: JourneyNextInput) => Promise<JourneyNode>;

  /**
   * Resume a suspended Journey flow from a deep link URL.
   *
   * @param uri - Resume URI provided by native/server.
   * @returns Resumed Journey node.
   * @throws {JourneyError} When resume fails.
   */
  resume: (uri: string) => Promise<JourneyNode>;

  /**
   * Resolve active user session details.
   *
   * @returns Session payload, or `null` when no active session exists.
   * @throws {JourneyError} When session retrieval fails.
   */
  user: () => Promise<JourneyUserSession | null>;

  /**
   * Logout active Journey user/session.
   *
   * @returns `true` when logout succeeds.
   * @throws {JourneyError} When logout fails.
   */
  logoutUser: () => Promise<boolean>;

  /**
   * Dispose the native Journey instance and release runtime state.
   *
   * @returns Promise resolved when disposal completes.
   * @throws {JourneyError} When disposal fails.
   */
  dispose: () => Promise<void>;
};
