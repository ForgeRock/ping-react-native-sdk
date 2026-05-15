/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  GenericError,
  LoggerInstance,
  OathPolicyEvaluatorHandle,
  OathStorageHandle,
} from '@ping-identity/rn-types';

/**
 * A registered OATH credential stored in the native OATH store.
 *
 * @remarks
 * The `type` field is always uppercase on both iOS and Android (`'TOTP'` or
 * `'HOTP'`). The `secret` field is never exposed over the bridge.
 *
 * @example
 * ```ts
 * const credential = await client.getCredential('my-credential-id');
 * if (credential?.type === 'TOTP') {
 *   console.log('TOTP period:', credential.period);
 * }
 * ```
 */
export type OathCredential = {
  /**
   * Unique identifier for the credential.
   */
  id: string;

  /**
   * Issuer name as encoded in the credential URI.
   */
  issuer: string;

  /**
   * Human-readable issuer name used for display purposes.
   */
  displayIssuer: string;

  /**
   * Account name (username / e-mail) as encoded in the credential URI.
   */
  accountName: string;

  /**
   * Human-readable account name used for display purposes.
   */
  displayAccountName: string;

  /**
   * OATH algorithm type.
   *
   * @remarks
   * Always uppercase on both platforms: `'TOTP'` or `'HOTP'`.
   */
  type: 'TOTP' | 'HOTP';

  /**
   * User identifier associated with the credential, or `null` if not set.
   */
  userId: string | null;

  /**
   * Resource identifier associated with the credential, or `null` if not set.
   */
  resourceId: string | null;

  /**
   * Number of OTP digits (typically 6 or 8).
   */
  digits: number;

  /**
   * TOTP period in seconds. Unused for HOTP credentials.
   */
  period: number;

  /**
   * HOTP counter value. Unused for TOTP credentials.
   */
  counter: number;

  /**
   * Optional URL for the credential issuer logo image.
   */
  imageURL: string | null;

  /**
   * Optional background colour associated with the credential, as a hex string.
   */
  backgroundColor: string | null;

  /**
   * Whether this credential is currently locked by a device policy.
   */
  isLocked: boolean;

  /**
   * HMAC algorithm used to generate OTP codes.
   *
   * @remarks
   * Always uppercase on both platforms. Maps to the native `OathAlgorithm`
   * enum on Android and `OathAlgorithmType` on iOS.
   */
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';

  /**
   * Timestamp (milliseconds since Unix epoch) at which the credential was created.
   *
   * @remarks
   * Derived from `Date.time.toDouble()` on Android and
   * `timeIntervalSince1970 * 1000` on iOS.
   */
  createdAt: number;

  /**
   * JSON-encoded policy configuration string, or `null` if no policies are attached.
   */
  policies: string | null;

  /**
   * Name of the policy currently locking the credential, or `null` if not locked by a policy.
   */
  lockingPolicy: string | null;
};

/**
 * A single OATH policy to be enforced by the policy evaluator.
 *
 * @remarks
 * Both kinds are available on both iOS and Android. The `score` threshold
 * for `deviceTampering` is a server-supplied parameter embedded in the
 * credential's `policies` JSON — it is **not** a bridge-config parameter.
 *
 * // MfaPolicy parity check — verified against ping-android-sdk@c939521 / ping-ios-sdk@2d6e3eb
 */
export type OathMfaPolicy =
  | {
      /**
       * Checks whether biometric authentication is enrolled and available on
       * the device. Fails when no biometric hardware is present or no
       * credentials are enrolled.
       */
      kind: 'biometricAvailable';
    }
  | {
      /**
       * Checks the device for root / jailbreak indicators using the native
       * TamperDetector module. Fails when the tampering score meets or exceeds
       * the server-configured threshold (default 0.8).
       */
      kind: 'deviceTampering';
    };

/**
 * Configuration for {@link configureOathPolicyEvaluator}.
 *
 * @example
 * ```ts
 * const evaluator = configureOathPolicyEvaluator({
 *   policies: [{ kind: 'biometricAvailable' }, { kind: 'deviceTampering' }],
 * });
 * const client = await createOathClient({ policyEvaluator: evaluator });
 * ```
 */
export type OathPolicyEvaluatorConfig = {
  /**
   * Non-empty list of OATH policies the evaluator will enforce.
   *
   * @remarks
   * Throws an `argument_error` when empty or when a kind is not in the
   * {@link OathMfaPolicy} union.
   */
  policies: OathMfaPolicy[];
  /**
   * Optional native logger id to use for the evaluator.
   *
   * @remarks
   * When omitted, the evaluator inherits the logger supplied to
   * `OathClientConfig.logger` at client-creation time (Amendment 6 wiring).
   * Pass an explicit id here only when you need a different log channel for
   * policy evaluation.
   */
  loggerId?: string;
};

/**
 * OTP code along with timing and validity metadata returned by
 * {@link OathClient.generateCodeWithValidity}.
 *
 * @remarks
 * Fields that are not applicable to a credential type are set to sentinel
 * values: `-1` for HOTP numeric timing fields and `0.0` / `0` for HOTP
 * progress/period fields.
 *
 * @example
 * ```ts
 * const info = await client.generateCodeWithValidity('my-totp-id');
 * console.log(`OTP: ${info.code} — valid for ${info.timeRemaining}s`);
 * ```
 */
export type OathCodeInfo = {
  /**
   * The one-time password string.
   */
  code: string;

  /**
   * Seconds remaining in the current TOTP window.
   *
   * @remarks
   * Set to `-1` for HOTP credentials.
   */
  timeRemaining: number;

  /**
   * HOTP counter value after code generation.
   *
   * @remarks
   * Set to `-1` for TOTP credentials.
   */
  counter: number;

  /**
   * Fraction of the TOTP period that has elapsed, in the range `0.0`–`1.0`.
   *
   * @remarks
   * Set to `0.0` for HOTP credentials.
   */
  progress: number;

  /**
   * Total TOTP period in seconds.
   *
   * @remarks
   * Set to `0` for HOTP credentials.
   */
  totalPeriod: number;
};

/**
 * Configuration options for {@link createOathClient}.
 *
 * @example
 * ```ts
 * import { logger } from '@ping-identity/rn-logger';
 *
 * const log = logger({ level: 'debug' });
 * const client = await createOathClient({ logger: log });
 * ```
 */
export type OathClientConfig = {
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   */
  logger?: LoggerInstance;

  /**
   * Network timeout for OATH operations, in seconds.
   *
   * @remarks
   * When omitted, the native SDK default (15 s) applies. Both Android and iOS
   * natively use seconds, so no conversion is needed:
   * - Android maps to `OathConfiguration.timeout` as a `Duration` via
   *   `kotlin.time.Duration.Companion.seconds`.
   * - iOS maps directly to `OathConfiguration.timeoutMs` which, despite the
   *   misleading `Ms` suffix, stores seconds as a `TimeInterval`.
   */
  timeout?: number;

  /**
   * Whether the in-memory credential cache is enabled.
   *
   * @remarks
   * Direct passthrough on both Android and iOS. Defaults to `false` on both
   * platforms when omitted.
   */
  enableCredentialCache?: boolean;

  /**
   * Whether OATH credential storage is encrypted at rest.
   *
   * @remarks
   * iOS-only. On Android this field is silently ignored — Android has no
   * equivalent toggle in `OathConfiguration` (encryption is governed by the
   * underlying storage provider). When omitted on iOS the SDK default
   * (`true`) applies.
   */
  encryptionEnabled?: boolean;

  /**
   * Optional custom storage handle for the OATH credential store.
   *
   * @remarks
   * Pattern A: obtain an `OathStorageHandle` from `configureOathStorage(...)` in
   * `@ping-identity/rn-storage` and pass it here to override the native SDK
   * default storage backend. The resolved `storage.id` is forwarded to the native
   * `create` call as `storageId`.
   *
   * When omitted the native SDK uses its default storage provider on both
   * Android and iOS.
   */
  storage?: OathStorageHandle;

  /**
   * Optional custom policy evaluator handle.
   *
   * @remarks
   * Pattern A: obtain an `OathPolicyEvaluatorHandle` from
   * {@link configureOathPolicyEvaluator} and pass it here to override the
   * native SDK default policy evaluator. The resolved `policyEvaluator.id` is
   * forwarded to the native `create` call as `policyEvaluatorId`.
   *
   * When omitted the native SDK creates a default evaluator that enforces both
   * `biometricAvailable` and `deviceTampering` policies on both platforms.
   */
  policyEvaluator?: OathPolicyEvaluatorHandle;
};

/**
 * Native-backed OATH client handle returned by {@link createOathClient}.
 *
 * @remarks
 * The client holds a reference to a native OATH session. Call {@link close}
 * when the client is no longer needed to release native resources. Any method
 * called after `close()` will throw an {@link OathError} with
 * `error: 'OATH_STATE_ERROR'`.
 *
 * @example
 * ```ts
 * const client = await createOathClient();
 * try {
 *   const credentials = await client.getCredentials();
 *   console.log('Stored credentials:', credentials.length);
 * } finally {
 *   await client.close();
 * }
 * ```
 */
export type OathClient = {
  /**
   * Parse an `otpauth://` URI and register the credential in the native store.
   *
   * @param uri - The URI string encoding the credential.
   * @returns A promise that resolves to the newly created {@link OathCredential}.
   * @throws {@link OathError} when the URI is invalid or a duplicate credential exists.
   *
   * @remarks
   * Both `otpauth://` and `mfauth://` URIs are accepted directly by this method and
   * parsed by the native SDK. The `mfauth://` scheme uses the same query parameters as
   * `otpauth://` (e.g. `secret`, `algorithm`, `digits`, `period`) — pass the raw URI
   * and the native SDK will extract the OATH credential.
   */
  addCredentialFromUri(uri: string): Promise<OathCredential>;

  /**
   * Retrieve a single credential by its identifier.
   *
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to the {@link OathCredential}, or `null` if not found.
   * @throws {@link OathError} on storage access failure.
   */
  getCredential(credentialId: string): Promise<OathCredential | null>;

  /**
   * Retrieve all credentials stored in the native OATH store.
   *
   * @returns A promise that resolves to an array of {@link OathCredential} objects.
   * @throws {@link OathError} on storage access failure.
   */
  getCredentials(): Promise<OathCredential[]>;

  /**
   * Persist an updated credential to the native OATH store.
   *
   * @param credential - The {@link OathCredential} object to save.
   * @returns A promise that resolves to the saved {@link OathCredential}.
   * @throws {@link OathError} when the credential is not found or storage fails.
   */
  saveCredential(credential: OathCredential): Promise<OathCredential>;

  /**
   * Remove a credential from the native OATH store.
   *
   * @param credentialId - Unique identifier for the credential to delete.
   * @returns A promise that resolves to `true` when deletion succeeded.
   * @throws {@link OathError} when the credential is not found or deletion fails.
   */
  deleteCredential(credentialId: string): Promise<boolean>;

  /**
   * Generate a one-time password for a credential.
   *
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to the OTP string.
   * @throws {@link OathError} when the credential is locked or code generation fails.
   */
  generateCode(credentialId: string): Promise<string>;

  /**
   * Generate a one-time password along with validity metadata.
   *
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to an {@link OathCodeInfo} payload.
   * @throws {@link OathError} when the credential is locked or code generation fails.
   */
  generateCodeWithValidity(credentialId: string): Promise<OathCodeInfo>;

  /**
   * Release all resources held by the native OATH client.
   *
   * @remarks
   * After this call, any method invocation on this client will throw an
   * {@link OathError} with `error: 'OATH_STATE_ERROR'`.
   *
   * @returns A promise that resolves when the client has been closed.
   * @throws {@link OathError} when native cleanup fails.
   */
  close(): Promise<void>;
};

/**
 * Error payload returned when OATH operations fail.
 *
 * @remarks
 * Matches the shared native/JS error contract defined in `@ping-identity/rn-types`.
 */
export type OathError = GenericError;

/**
 * Stable error codes emitted by the OATH module.
 *
 * @remarks
 * Keep these in sync with the native error constants on both iOS and Android.
 */
export type OathErrorCode =
  | 'OATH_INVALID_URI'
  | 'OATH_INVALID_PARAMETER'
  | 'OATH_CREDENTIAL_NOT_FOUND'
  | 'OATH_CREDENTIAL_LOCKED'
  | 'OATH_DUPLICATE_CREDENTIAL'
  | 'OATH_CODE_GENERATION_FAILED'
  | 'OATH_INITIALIZATION_FAILED'
  | 'OATH_STORAGE_FAILURE'
  | 'OATH_POLICY_VIOLATION'
  | 'OATH_STATE_ERROR'
  | 'OATH_UNKNOWN_ERROR'
  | 'OATH_MISSING_PARAMETER'
  | 'OATH_URI_FORMATTING'
  | 'OATH_CLEANUP_FAILED'
  | 'OATH_STORAGE_CORRUPTED'
  | 'OATH_STORAGE_ACCESS_DENIED';
