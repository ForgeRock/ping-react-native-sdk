/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Node and collector contracts returned by the DaVinci native bridge.
 */

/**
 * Common fields present on every field-level collector.
 *
 * @public
 */
export type BaseCollector = {
  /** Unique collector key identifying this field in the form. */
  key: string;
  /** Server-side collector type string. */
  type: string;
  /** Human-readable field label. */
  label: string;
  /** Whether this field must have a value before submitting. */
  required: boolean;
  /**
   * Raw server-side field JSON from `node.input.form.components.fields[]`.
   *
   * @remarks
   * Populated by the native mapper. `undefined` for collectors with no
   * matching field entry in the server payload (e.g. certain action buttons).
   */
  raw?: Record<string, unknown>;
};

/**
 * Collector-level validation error returned by the native SDK's `validate()` method.
 *
 * @remarks
 * In 2.0.1 the bridge emits only `REQUIRED` (iOS only) and `REGEX_ERROR` (both platforms).
 * TODO-SDK-FUTURE-SUPPORT: Password-policy cases (`INVALID_LENGTH`, `UNIQUE_CHARACTER`,
 * `MAX_REPEAT`, `MIN_CHARACTERS`) exist in both the iOS and Android SDKs but their
 * policy-validation blocks are behind `// TODO` markers in `PasswordCollector.validate()`
 * (iOS `PasswordCollector.swift:49-81`, Android `PasswordCollector.kt:63-91`) and are
 * never emitted at runtime — add them when both SDKs remove those blocks.
 *
 * @public
 */
export type DaVinciFieldValidationError =
  | { code: 'REQUIRED' }
  | { code: 'REGEX_ERROR'; message: string };

/**
 * Validation rule attached to text and select collectors, including the current
 * evaluation result from the native SDK's `validate()` call.
 *
 * @public
 */
export type DaVinciValidation = {
  /** Regular expression pattern the value must satisfy. */
  regex: string;
  /**
   * Validation errors produced by the native SDK's `validate()` call on the
   * current collector value. Empty when the value is valid; absent when
   * `validate()` has not yet been called.
   */
  errors?: DaVinciFieldValidationError[];
};

/**
 * Rich-content payload for label and text collectors.
 *
 * @public
 */
export type RichContent = {
  /** Raw content string (may contain placeholder tokens). */
  content: string;
  /**
   * Named replacements keyed by placeholder token.
   *
   * @remarks
   * Values may include an optional `href` (for hyperlinks), `type`, and `target`.
   */
  replacements: Record<
    string,
    { value: string; href?: string; type?: string; target?: string }
  >;
};

/**
 * Password policy constraints associated with a {@link PasswordCollector}.
 *
 * @remarks
 * The bridge reads this from `continueNode.input.form.components.fields[]`
 * because the SDK's own `passwordPolicy()` method targets the wrong JSON path
 * in 2.0.1 (it reads from `continueNode.input["passwordPolicy"]`).
 *
 * @public
 */
export type PasswordPolicy = {
  /** A name identifying this password policy. */
  name: string;
  /** A human-readable description of the policy. */
  description: string;
  /** Minimum and maximum length constraints. */
  length: {
    /** The minimum required length for a password. */
    min: number;
    /** The maximum allowed length for a password. */
    max: number;
  };
  /** A dictionary specifying minimum required counts for certain character types. */
  minCharacters: Record<string, number>;
  /** The maximum number of repeated characters allowed in a password. */
  maxRepeatedCharacters: number;
  /** The minimum number of unique characters required in a password. */
  minUniqueCharacters: number;
  /** Whether profile data is excluded from allowed password values. */
  excludesProfileData: boolean;
  /** Whether new passwords must not be similar to the current password. */
  notSimilarToCurrent: boolean;
  /** Whether commonly used passwords are excluded. */
  excludesCommonlyUsed: boolean;
  /** Password history restrictions, if any. */
  history?: {
    /** The number of recent passwords to keep in history to disallow reuse. */
    count: number;
    /** The retention period (in days) for password history entries. */
    retentionDays: number;
  };
  /** Lockout rules, if any. */
  lockout?: {
    /** The number of failed login attempts that trigger a lockout. */
    failureCount: number;
    /** The lockout duration in seconds once the failure threshold is reached. */
    durationSeconds: number;
  };
  /** The maximum number of days a password is valid before it must be changed. */
  maxAgeDays: number;
  /** The minimum number of days a password must be used before it can be changed. */
  minAgeDays: number;
  /** An integer denoting how many users or "population" this policy applies to. */
  populationCount: number;
  /** The creation timestamp of this policy. */
  createdAt: string;
  /** The last update timestamp of this policy. */
  updatedAt: string;
  /** Indicates whether this is the default password policy for the environment. */
  default: boolean;
};

/**
 * Selectable device option returned by device collectors.
 *
 * @public
 */
export type DeviceOption = {
  /** Optional device identifier. */
  id?: string;
  /** Device type string. */
  type: string;
  /** Human-readable device title. */
  title: string;
  /** Optional device description. */
  description?: string;
  /** URL of the device icon image. */
  iconSrc: string;
  /** Whether this device is selected by default. */
  isDefault?: boolean;
};

// ---------------------------------------------------------------------------
// Collector shapes
// ---------------------------------------------------------------------------

/**
 * Single-line text input collector.
 *
 * @public
 */
export type TextCollector = BaseCollector & {
  type: 'TEXT';
  /** Current text value. */
  value: string;
  /** Optional server-provided validation rule. */
  validation?: DaVinciValidation;
};

/**
 * Password input collector.
 *
 * @remarks
 * `PASSWORD_VERIFY` is a password-confirmation variant of the same collector class.
 *
 * @public
 */
export type PasswordCollector = BaseCollector & {
  type: 'PASSWORD' | 'PASSWORD_VERIFY';
  /** Current password value (always `""` in bridge output — cleared before serialisation). */
  value: string;
  /**
   * Whether the native collector clears its value when `close()` is called on node exit.
   *
   * @remarks
   * Defaults to `true` on both platforms. Set to `false` to retain the password value
   * across node transitions (e.g. validation-error retry loops).
   */
  clearPassword?: boolean;
  /**
   * Optional password policy constraints.
   *
   * @remarks
   * Present only when the server includes a `passwordPolicy` object in the field
   * definition. The bridge reads it directly from the raw JSON because the SDK's
   * `passwordPolicy()` method targets the wrong path in 2.0.1.
   */
  passwordPolicy?: PasswordPolicy;
};

/**
 * Submit button collector — triggers form submission.
 *
 * @public
 */
export type SubmitCollector = BaseCollector & {
  type: 'SUBMIT_BUTTON';
};

/**
 * Flow/action button collector — immediately advances the flow without
 * including other field values.
 *
 * @remarks
 * Selecting a `FlowCollector` sends only its own key with `eventType = "action"`,
 * bypassing all other form fields. The bridge handles this automatically.
 *
 * @public
 */
export type FlowCollector = BaseCollector & {
  type: 'ACTION' | 'FLOW_BUTTON' | 'FLOW_LINK';
};

/**
 * Label (read-only content) collector.
 *
 * @remarks
 * Does not extend {@link BaseCollector} — `LabelCollector` does not implement
 * `FieldCollector` in the native SDK and therefore has no `label` or `required`.
 *
 * `richContent` is absent from the 2.0.1 iOS/Android SDK sources (`LabelCollector`
 * has only `key` and `content`). Add it when the SDK version that includes it is adopted.
 *
 * @public
 */
export type LabelCollector = {
  /** Unique collector key identifying this field in the form. */
  key: string;
  type: 'LABEL';
  /** Raw display content for this label. */
  content: string;
  // TODO-SDK-FUTURE-SUPPORT: add richContent?: RichContent when the SDK version that exposes it on LabelCollector is adopted
  /**
   * Raw server-side field JSON from `node.input.form.components.fields[]`.
   *
   * @remarks
   * Populated by the native mapper.
   */
  raw?: Record<string, unknown>;
};

/**
 * Single-select input collector (dropdown, radio group, or generic single-select).
 *
 * @public
 */
export type SingleSelectCollector = BaseCollector & {
  type: 'SINGLE_SELECT' | 'DROPDOWN' | 'RADIO';
  /** Currently selected option value. */
  value: string;
  /** Available options. */
  options: Array<{ label: string; value: string }>;
  /** Optional validation rule. */
  validation?: DaVinciValidation;
};

/**
 * Multi-select input collector (combobox, checkbox group, or generic multi-select).
 *
 * @public
 */
export type MultiSelectCollector = BaseCollector & {
  type: 'MULTI_SELECT' | 'COMBOBOX' | 'CHECKBOX';
  /** Currently selected option values. */
  value: string[];
  /** Available options. */
  options: Array<{ label: string; value: string }>;
};

/**
 * Phone number input collector.
 *
 * @remarks
 * `extension`, `showExtension`, and `extensionLabel` do not exist in the 2.0.1
 * Android/iOS SDK sources and are therefore absent from this contract.
 * TODO-SDK-FUTURE-SUPPORT: add `extension`, `showExtension`, and `extensionLabel` when the SDK version that exposes it.
 * @public
 */
export type PhoneNumberCollector = BaseCollector & {
  type: 'PHONE_NUMBER';
  /** Default country code from server configuration (read-only). */
  defaultCountryCode: string;
  /** Whether phone number format validation is enabled (read-only). */
  validatePhoneNumber: boolean;
  /** Currently entered country code (mutable). */
  countryCode: string;
  /** Currently entered phone number (mutable). */
  phoneNumber: string;
};

/**
 * Device registration collector.
 *
 * @remarks
 * JS selects a device by passing `value: { type: string }` (the `type` field of
 * the chosen {@link DeviceOption}) to `next()`.
 *
 * @public
 */
export type DeviceRegistrationCollector = BaseCollector & {
  type: 'DEVICE_REGISTRATION';
  /** Available devices to register. */
  devices: DeviceOption[];
  /** Selected device type string (undefined until JS sets a value). */
  value?: string;
};

/**
 * Device authentication collector.
 *
 * @remarks
 * JS selects a device by passing `value: { type, id?, description? }` to `next()`.
 *
 * @public
 */
export type DeviceAuthenticationCollector = BaseCollector & {
  type: 'DEVICE_AUTHENTICATION';
  /** Available devices to authenticate with. */
  devices: DeviceOption[];
  /** Selected device value (undefined until JS sets a value). */
  value?: { type: string; id?: string; description?: string };
};

/**
 * Social login / external IdP collector.
 *
 * @remarks
 * Corresponds to the native `SOCIAL_LOGIN_BUTTON` server type.
 *
 * The `key` field is set to `idpId` (the stable server-assigned identifier) rather than the
 * native collector's own `.id` property, which returns a new UUID on every access.
 *
 * Handled entirely by `@ping-identity/rn-external-idp` — appears as `executionMode:
 * 'integration_required'` and `kind: 'integration'` in normalized collectors.
 *
 * @public
 */
export type IdpCollector = {
  /** Stable server-assigned IdP identifier, used as the form field key. */
  key: string;
  type: 'SOCIAL_LOGIN_BUTTON';
  /** Human-readable button label (e.g. 'Sign in with Google'). */
  label: string;
  /** Server IdP identifier (same as `key`). */
  idpId: string;
  /**
   * Provider type string.
   *
   * @remarks
   * Verified against iOS `DavinciPlugin/Constants.swift` and Android
   * `IdpCollector` bytecode — the SDK registers `'GOOGLE'`, `'FACEBOOK'`,
   * and `'APPLE'` (uppercase). `'APPLE'` is iOS-only; Android has no native
   * Apple sign-in handler. The union is left open (`| string`) to accommodate
   * future providers without a breaking change.
   */
  idpType: 'GOOGLE' | 'FACEBOOK' | 'APPLE' | string;
  /** Whether the IdP is currently enabled. */
  idpEnabled: boolean;
  /** IdP authentication URL (informational — not used directly by JS). */
  link?: string;
  raw?: Record<string, unknown>;
};

/**
 * Discriminated union of all collector types returned by the DaVinci bridge.
 *
 * @remarks
 * Collector types `BooleanCollector` and `ReadOnlyTextCollector` are absent from
 * the 2.0.1 Android/iOS SDK sources and are therefore not included here.
 *
 * @public
 */
export type DaVinciCollector =
  | TextCollector
  | PasswordCollector
  | SubmitCollector
  | FlowCollector
  | LabelCollector
  | SingleSelectCollector
  | MultiSelectCollector
  | PhoneNumberCollector
  | DeviceRegistrationCollector
  | DeviceAuthenticationCollector
  | IdpCollector;

// ---------------------------------------------------------------------------
// Node shapes
// ---------------------------------------------------------------------------

/**
 * Form field present in the server payload that the native SDK could not
 * instantiate because its `type`/`inputType` is not registered.
 *
 * @remarks
 * Present only on Android while the native `CollectorRegistry` lags iOS
 * (FLOW_BUTTON, FLOW_LINK, DROPDOWN, RADIO, COMBOBOX, CHECKBOX). UI
 * consumers can render a placeholder, log, or block submission when these
 * are present rather than silently omitting the field.
 *
 * @public
 */
export type UnsupportedDaVinciField = {
  /** Stable field key from the server payload. */
  key: string;
  /** Server-declared `inputType` (falling back to `type`) for the dropped field. */
  type: string;
};

/**
 * Node requiring user input — contains a list of collectors.
 *
 * @public
 */
export type ContinueNode = {
  type: 'ContinueNode';
  /** Collectors representing the form fields for this step. */
  collectors: DaVinciCollector[];
  /**
   * Form fields the native SDK skipped because their type was not registered.
   *
   * @remarks
   * Populated on both iOS and Android when the native SDK drops one or more
   * fields (see {@link UnsupportedDaVinciField}). Omitted when every server
   * field has a matching collector.
   */
  unsupportedFields?: UnsupportedDaVinciField[];
  /**
   * Full server `input` payload for this node.
   *
   * @remarks
   * Parity with Journey's `ContinueNode.input`. Useful for integration
   * collectors that need the full server context beyond the typed collector
   * projection.
   */
  input?: Record<string, unknown>;
};

/**
 * Terminal success node — flow completed successfully.
 *
 * @public
 */
export type SuccessNode = {
  type: 'SuccessNode';
  /** Session token payload. */
  session: { value: string };
};

/**
 * Terminal error node — flow encountered a recoverable server error.
 *
 * @remarks
 * TODO-SDK-FUTURE-PARITY:`status` is present on iOS (the native `ErrorNode` carries the HTTP status code from the
 * server response). Android Orchestrate 2.0.1 does not expose an HTTP status field on
 * `ErrorNode`, so this field is absent on Android until the SDK is updated.
 *
 * @public
 */
export type ErrorNode = {
  type: 'ErrorNode';
  /** Human-readable error message. */
  message: string;
  /**
   * HTTP status code from the server error response.
   *
   * @remarks
   * Present on iOS only — absent on Android (SDK parity gap, see Android `DaVinciNodeMapper`).
   */
  status?: number;
  /**
   * Full server `input` payload associated with this error node.
   *
   * @remarks
   * Parity with Journey's `ErrorNode.input`.
   */
  input?: Record<string, unknown>;
};

/**
 * Terminal failure node — flow encountered an unrecoverable error.
 *
 * @public
 */
export type FailureNode = {
  type: 'FailureNode';
  /** Human-readable failure message. */
  message: string;
  /**
   * Underlying cause description, when the native SDK provides one.
   *
   * @remarks
   * Parity with Journey's `FailureNode.cause`.
   */
  cause?: string;
};

/**
 * Discriminated union of all node types returned by DaVinci flow operations.
 *
 * @example
 * ```ts
 * const node = await client.start();
 * switch (node.type) {
 *   case 'ContinueNode':
 *     // render form using node.collectors
 *     break;
 *   case 'SuccessNode':
 *     console.log('Session token:', node.session.value);
 *     break;
 *   case 'ErrorNode':
 *     console.error('Flow error:', node.message);
 *     break;
 *   case 'FailureNode':
 *     console.error('Flow failure:', node.cause);
 *     break;
 * }
 * ```
 *
 * @public
 */
export type DaVinciNode = ContinueNode | SuccessNode | ErrorNode | FailureNode;

/**
 * User session payload exposed by {@link DaVinciClient.user} and
 * {@link DaVinciClient.refresh}.
 *
 * @example
 * ```ts
 * const session = await client.user();
 * if (session) {
 *   console.log('Access token:', session.accessToken);
 *   console.log('Expires in:', session.expiresIn, 'seconds');
 * }
 * ```
 *
 * @public
 */
export type DaVinciUserSession = {
  /** OAuth2 access token. */
  accessToken: string;
  /** Optional OAuth2 refresh token. */
  refreshToken?: string;
  /** Optional token expiry in seconds. */
  expiresIn?: number;
};
