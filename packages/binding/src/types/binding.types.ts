/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type { JourneyInstance, LoggerInstance } from '@ping-identity/rn-types';

/**
 * Prompt text sent from AM for biometric / PIN authentication dialogs.
 */
export type BindingPrompt = {
  title: string;
  subtitle: string;
  description: string;
};

/**
 * A registered device key available for selection during a signing operation.
 */
export type UserKeyOption = {
  /** Unique key identifier (kid). */
  id: string;
  /** User identifier associated with this key. */
  userId: string;
  /** Human-readable username associated with this key. */
  username: string;
  /** Authentication type (e.g. `"BIOMETRIC_ONLY"`, `"APPLICATION_PIN"`). */
  authenticationType: string;
};

/**
 * App PIN authenticator options.
 */
export type BindingAppPinConfig = {
  maxAttempts?: number;
  prompt?: Partial<BindingPrompt>;
  /**
   * Keychain key tag for the app PIN authenticator key (iOS only, bind only).
   *
   * @remarks
   * Only applied during bind — the tag is stored with the key at creation time
   * and used automatically on subsequent sign operations.
   */
  keyTag?: string;
  /**
   * KeyStore type used for app PIN key storage (Android only).
   *
   * @remarks
   * Defaults to `"PKCS12"` when omitted. Only change this if you have a specific
   * compatibility requirement.
   */
  keystoreType?: string;
};

/**
 * Android-specific biometric authenticator options.
 */
export type BindingBiometricAndroidConfig = {
  /** Biometric prompt text shown to the user during authentication. */
  prompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
    /** Label for the negative/cancel button (shown for BIOMETRIC_ONLY auth type). */
    negativeButtonText?: string;
  };
  /**
   * Prefer StrongBox-backed key storage when available (Android only).
   *
   * @remarks
   * StrongBox provides a higher level of hardware security than the default TEE.
   * Falls back to TEE when StrongBox is unavailable on the device.
   * Defaults to `false` when omitted.
   */
  strongBoxPreferred?: boolean;
};

/**
 * iOS-specific biometric options for bind operations.
 */
export type BindingBiometricIosBindConfig = {
  /**
   * Keychain key tag for the biometric authenticator key (bind only).
   *
   * @remarks
   * Only applied during bind — the tag is stored with the key at creation time
   * and used automatically on subsequent sign operations.
   */
  keyTag?: string;
};

/**
 * iOS-specific biometric options for sign operations.
 */
export type BindingBiometricIosSignConfig = {
  /**
   * Keychain key tag for the biometric authenticator key.
   *
   * @remarks
   * Ignored during sign — the tag stored at bind time is used automatically.
   */
  keyTag?: string;
};

/**
 * Biometric authenticator options for bind operations.
 */
export type BindingBiometricBindConfig = {
  android?: BindingBiometricAndroidConfig;
  ios?: BindingBiometricIosBindConfig;
};

/**
 * Biometric authenticator options for sign operations.
 */
export type BindingBiometricSignConfig = {
  android?: BindingBiometricAndroidConfig;
  ios?: BindingBiometricIosSignConfig;
};

/**
 * JWT proof timing options.
 */
export type BindingJwtConfig = {
  issueTimeEpochSeconds?: number;
  notBeforeTimeEpochSeconds?: number;
  expirationTimeEpochSeconds?: number;
};

/**
 * Options for Journey-scoped device binding callback execution.
 */
export type BindingJourneyBindOptions = {
  /** Optional callback index when multiple DeviceBindingCallback instances are present. */
  index?: number;
  /**
   * Optional human-readable device name sent to the server during binding.
   *
   * @remarks
   * Defaults to the native device model name when omitted.
   */
  deviceName?: string;
  /**
   * JWS algorithm for the signed JWT proof (Android only).
   *
   * @remarks
   * Defaults to `"RS512"` when omitted. Common values: `"RS256"`, `"RS384"`, `"RS512"`.
   * iOS uses ES256 exclusively (Secure Enclave) and ignores this option.
   */
  signingAlgorithm?: string;
  appPin?: BindingAppPinConfig;
  biometric?: BindingBiometricBindConfig;
  jwt?: BindingJwtConfig;
};

/**
 * Options for Journey-scoped device signing-verifier callback execution.
 */
export type BindingJourneySignOptions = {
  /** Optional callback index when multiple DeviceSigningVerifierCallback instances are present. */
  index?: number;
  /**
   * Optional custom claims to include in the signed JWT payload.
   *
   * @remarks
   * Reserved claim names (`sub`, `exp`, `iat`, `nbf`, `iss`, `challenge`) are
   * not allowed and will cause the operation to fail.
   */
  claims?: Record<string, unknown>;
  /**
   * JWS algorithm for the signed JWT proof (Android only).
   *
   * @remarks
   * Defaults to `"RS512"` when omitted. Common values: `"RS256"`, `"RS384"`, `"RS512"`.
   * iOS uses ES256 exclusively (Secure Enclave) and ignores this option.
   */
  signingAlgorithm?: string;
  appPin?: BindingAppPinConfig;
  biometric?: BindingBiometricSignConfig;
  jwt?: BindingJwtConfig;
};

declare const userKeyStorageHandleBrand: unique symbol;

export type UserKeyStorage = Readonly<{
  id: string;
  kind: 'binding_user_key_storage';
  [userKeyStorageHandleBrand]: true;
}>;

/**
 * Optional custom collectors/selectors for app-owned UI.
 */
export type BindingUiConfig = {
  pinCollector?: (prompt: BindingPrompt) => Promise<string>;
  userKeySelector?: (keys: UserKeyOption[]) => Promise<UserKeyOption>;
};

/**
 * Runtime configuration for the Binding client.
 *
 * @remarks
 * Only stateful, client-level concerns belong here: the logger, UI callbacks,
 * and custom key storage. Per-operation options (appPin, biometric, jwt,
 * signingAlgorithm) are passed directly to `bindForJourney` / `signForJourney`.
 */
export type BindingConfig = {
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   * JavaScript-side binding logs use this logger on both platforms.
   * Native logger forwarding applies on both Android and iOS.
   */
  logger?: LoggerInstance;
  /**
   * Optional custom PIN collector and user-key selector for app-owned UI.
   *
   * @remarks
   * When `pinCollector` is provided, the native default PIN dialog is bypassed.
   * When `userKeySelector` is provided, the native default key-picker is bypassed.
   * When omitted the native default UI is used on each platform.
   */
  ui?: BindingUiConfig;
  /**
   * Handle returned by `configureBindingUserKeyStorage(...)` that configures
   * per-client user-key metadata storage.
   */
  userKeyStorage?: UserKeyStorage;
};

/**
 * Resolved per-client configuration consumed by native binding operations.
 */
export type BindingClientConfig = {
  /** Optional native logger handle id resolved from `logger.nativeHandle.id`. */
  loggerId?: string;
  /**
   * Whether a JS pinCollector was registered for this client.
   * When true, native installs the bridge PIN collector instead of the default UI.
   */
  hasPinCollector?: boolean;
  /**
   * Whether a JS userKeySelector was registered for this client.
   * When true, native installs the bridge key selector instead of the default UI.
   */
  hasUserKeySelector?: boolean;
  /** Optional registered user key storage handle identifier. */
  userKeyStorageId?: string;
};

/**
 * Reusable client for device binding and signing-verifier operations.
 */
export interface BindingClient {
  /**
   * Executes an active Journey DeviceBindingCallback.
   *
   * @param journey - Active Journey instance.
   * @param options - Optional bind callback execution options.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws BindingError when callback execution fails.
   */
  bindForJourney(
    journey: JourneyInstance,
    options?: BindingJourneyBindOptions,
  ): Promise<BindingJourneyResult>;

  /**
   * Executes an active Journey DeviceSigningVerifierCallback.
   *
   * @param journey - Active Journey instance.
   * @param options - Optional sign callback execution options.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws BindingError when callback execution fails.
   */
  signForJourney(
    journey: JourneyInstance,
    options?: BindingJourneySignOptions,
  ): Promise<BindingJourneyResult>;
}

/**
 * Success payload returned by Journey-scoped binding operations.
 */
export type BindingJourneyResult = {
  type: 'success';
};

/**
 * Error thrown when binding operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class BindingError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'BindingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): BindingError {
    return PingError.fromAs(raw, BindingError);
  }
}

/**
 * Stable error codes emitted by the Binding module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 *
 * TODO(SDKS-semver): See packages/binding/TODOS.md for the full semver widening plan.
 */
export type BindingErrorCode =
  | 'BINDING_ERROR'
  | 'BINDING_BIND_ERROR'
  | 'BINDING_SIGN_ERROR'
  | 'BINDING_CANCELLED'
  | 'BINDING_UNSUPPORTED_DEVICE'
  | 'BINDING_NOT_REGISTERED'
  | 'BINDING_UI_UNAVAILABLE'
  | 'BINDING_CALLBACK_NOT_FOUND'
  | 'BINDING_INVALID_CONFIG'
  | 'BINDING_KEY_READ_ERROR'
  | 'BINDING_KEY_DELETE_ERROR'
  | 'BINDING_KEY_INVALIDATED'
  | 'BINDING_AUTH_FAILED';

export type { JourneyInstance };
