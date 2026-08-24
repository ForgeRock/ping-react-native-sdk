/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  CallbackType,
  NativeExtensionCallbackType,
  Node,
  NodeCallback,
} from '@ping-identity/rn-types';

/**
 * Node discriminator returned by the Journey bridge.
 */
export type JourneyNodeType =
  | 'ContinueNode'
  | 'ErrorNode'
  | 'FailureNode'
  | 'SuccessNode';

/**
 * Callback type union used by Journey types.
 *
 * @remarks
 * Includes known SDK callback literals and declared native-extension callback
 * literals used by React Native Journey integrations.
 */
export type JourneyCallbackType =
  | Exclude<CallbackType, 'RedirectCallback'>
  | NativeExtensionCallbackType;

/**
 * Shared base fields present on every Journey callback payload.
 *
 * @remarks
 * `output` is the AM-level output array (escape hatch to raw AM data).
 * The index signature preserves backwards-compatible access to any property
 * not listed in a specific callback type.
 */
type JourneyCallbackBase = Omit<NodeCallback, 'type'> & {
  /** Optional user-facing prompt string emitted by native. */
  prompt?: string;
  /** Optional user-facing message emitted by native. */
  message?: string;
  /** Optional callback value emitted by native. */
  value?: unknown;
  /** Index signature — all named properties extend `unknown`. */
  [key: string]: unknown;
};

/**
 * ChoiceCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyChoiceCallback = JourneyCallbackBase & {
  type: 'ChoiceCallback';
  /** Available choices provided by the server. */
  choices: string[];
  /** Zero-based index of the server-suggested default choice. */
  defaultChoice: number;
  /** Currently selected choice index. */
  selectedIndex?: number;
};

/**
 * ConfirmationCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyConfirmationCallback = JourneyCallbackBase & {
  type: 'ConfirmationCallback';
  /** Button option labels. */
  options: string[];
  /** Currently selected option index. */
  selectedIndex?: number;
  /** Default option label. */
  defaultOption?: string;
  /** Option type discriminator. */
  optionType?: string;
  /** Message type discriminator. */
  messageType?: string;
};

/**
 * KbaCreateCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyKbaCreateCallback = JourneyCallbackBase & {
  type: 'KbaCreateCallback';
  /** Server-provided predefined question list. */
  predefinedQuestions: string[];
  /** Currently selected question. */
  selectedQuestion?: string;
  /** User-provided answer. */
  selectedAnswer?: string;
  /** Whether users may supply a custom question. */
  allowUserDefinedQuestions?: boolean;
};

/**
 * TermsAndConditionsCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyTermsAndConditionsCallback = JourneyCallbackBase & {
  type: 'TermsAndConditionsCallback';
  /** Terms version identifier. */
  version: string;
  /** Terms text. */
  terms: string;
  /** Terms creation date. */
  createDate: string;
  /** Whether the user has accepted the terms. */
  accepted?: boolean;
};

/**
 * ConsentMappingCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyConsentMappingCallback = JourneyCallbackBase & {
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
  /** Whether the user has accepted. */
  accepted?: boolean;
};

/**
 * HiddenValueCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyHiddenValueCallback = JourneyCallbackBase & {
  type: 'HiddenValueCallback';
  /** Hidden field identifier. */
  id: string;
  /** Hidden field value. */
  value?: string;
};

/**
 * PollingWaitCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyPollingWaitCallback = JourneyCallbackBase & {
  type: 'PollingWaitCallback';
  /** Suggested polling interval in milliseconds. */
  waitTime: number;
};

/**
 * TextOutputCallback payload with typed named fields.
 *
 * @public
 */
export type JourneyTextOutputCallback = JourneyCallbackBase & {
  type: 'TextOutputCallback';
  /** Message type discriminator (INFO, WARNING, ERROR). */
  messageType: string;
};

/**
 * SuspendedTextOutputCallback payload with typed named fields.
 *
 * @public
 */
export type JourneySuspendedTextOutputCallback = JourneyCallbackBase & {
  type: 'SuspendedTextOutputCallback';
  /** Message type discriminator. */
  messageType: string;
};

/**
 * FidoRegistrationCallback payload with typed named fields.
 *
 * @remarks
 * The `value` field is present on iOS only, for MetadataCallback-backed FIDO registration
 * flows where the native iOS bridge aliases the MetadataCallback type to
 * `"FidoRegistrationCallback"` when `_action` is `"webauthn_registration"` and emits the
 * full WebAuthn credential creation options as `value`.
 *
 * On Android, MetadataCallback-backed FIDO flows are not aliased — they surface as
 * `type: "MetadataCallback"` with `value` set directly on that callback. `value` is
 * therefore always `undefined` on Android for this type.
 *
 * @public
 */
export type JourneyFidoRegistrationCallback = JourneyCallbackBase & {
  type: 'FidoRegistrationCallback';
  /**
   * WebAuthn credential creation options.
   *
   * @remarks
   * iOS only — present when the callback originates from a MetadataCallback-backed FIDO
   * registration flow. Always `undefined` on Android.
   */
  value?: Record<string, unknown>;
};

/**
 * FidoAuthenticationCallback payload with typed named fields.
 *
 * @remarks
 * The `value` field is present on iOS only, for MetadataCallback-backed FIDO authentication
 * flows where the native iOS bridge aliases the MetadataCallback type to
 * `"FidoAuthenticationCallback"` when `_action` is `"webauthn_authentication"` and emits the
 * full WebAuthn assertion options as `value`.
 *
 * On Android, MetadataCallback-backed FIDO flows are not aliased — they surface as
 * `type: "MetadataCallback"` with `value` set directly on that callback. `value` is
 * therefore always `undefined` on Android for this type.
 *
 * @public
 */
export type JourneyFidoAuthenticationCallback = JourneyCallbackBase & {
  type: 'FidoAuthenticationCallback';
  /**
   * WebAuthn assertion options.
   *
   * @remarks
   * iOS only — present when the callback originates from a MetadataCallback-backed FIDO
   * authentication flow. Always `undefined` on Android.
   */
  value?: Record<string, unknown>;
};

/**
 * DeviceBindingCallback marker type for explicit union narrowing.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-binding` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceBindingCallback = JourneyCallbackBase & {
  type: 'DeviceBindingCallback';
};

/**
 * DeviceSigningVerifierCallback marker type for explicit union narrowing.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-binding` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceSigningVerifierCallback = JourneyCallbackBase & {
  type: 'DeviceSigningVerifierCallback';
};

/**
 * DeviceProfileCallback marker type for explicit union narrowing.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-device-profile` integration to handle this callback.
 *
 * @public
 */
export type JourneyDeviceProfileCallback = JourneyCallbackBase & {
  type: 'DeviceProfileCallback';
};

/**
 * IdpCallback marker type for explicit union narrowing.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-external-idp` integration to handle this callback.
 *
 * @public
 */
export type JourneyIdpCallback = JourneyCallbackBase & {
  type: 'IdpCallback';
};

/**
 * SelectIdpCallback marker type for explicit union narrowing.
 *
 * @remarks
 * The native bridge does not emit additional named top-level fields for this type.
 * Use `rn-external-idp` integration to handle this callback.
 *
 * @public
 */
export type JourneySelectIdpCallback = JourneyCallbackBase & {
  type: 'SelectIdpCallback';
};

/**
 * Catch-all callback payload for unrecognized or future callback types.
 *
 * @public
 */
export type JourneyUnknownCallback = JourneyCallbackBase & {
  type: JourneyCallbackType;
};

/**
 * Native callback payload surfaced to JavaScript.
 *
 * @remarks
 * A discriminated union narrowed by `type`. Known callback types expose named
 * typed fields (for example `JourneyChoiceCallback` has `choices: string[]`).
 * Callbacks from other SDK packages — FIDO (`rn-fido`), device binding (`rn-binding`),
 * device profile (`rn-device-profile`), and external IdP (`rn-external-idp`) — are
 * represented as marker types or typed variants where the bridge emits named fields.
 * Unrecognized types fall through to `JourneyUnknownCallback`.
 *
 * `callback.output` (the AM output array from `NodeCallback`) and the index
 * signature are preserved on every member as backwards-compatible escape hatches.
 *
 * @example
 * ```ts
 * if (callback.type === 'ChoiceCallback') {
 *   callback.choices        // string[]
 *   callback.defaultChoice  // number
 * }
 * ```
 *
 * @public
 */
export type JourneyCallback =
  | JourneyChoiceCallback
  | JourneyConfirmationCallback
  | JourneyKbaCreateCallback
  | JourneyTermsAndConditionsCallback
  | JourneyConsentMappingCallback
  | JourneyHiddenValueCallback
  | JourneyPollingWaitCallback
  | JourneyTextOutputCallback
  | JourneySuspendedTextOutputCallback
  | JourneyFidoRegistrationCallback
  | JourneyFidoAuthenticationCallback
  | JourneyDeviceBindingCallback
  | JourneyDeviceSigningVerifierCallback
  | JourneyDeviceProfileCallback
  | JourneyIdpCallback
  | JourneySelectIdpCallback
  | JourneyUnknownCallback;

/**
 * Journey node payload returned by native execution.
 *
 * @remarks
 * Extends shared node shape while replacing `callbacks` with Journey-native callback payloads.
 */
export type JourneyNode = Omit<Node, 'callbacks'> & {
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
  /**
   * Optional page header text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. On iOS this normalizes the native
   * `pageHeader` property to this shared field name.
   */
  header?: string;
  /**
   * Optional page description text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. On iOS this normalizes the native
   * `pageDescription` property to this shared field name.
   */
  description?: string;
  /**
   * Optional raw stage JSON string for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`.
   */
  stage?: string;
  /**
   * Optional locale-resolved submit button text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. Resolved by the native SDK from the
   * `stage` locale map using the device's preferred locale.
   */
  submitButtonText?: string;
  /**
   * Optional locale-resolved page footer text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. Resolved by the native SDK from the
   * `stage` locale map using the device's preferred locale.
   */
  pageFooter?: string;
};
