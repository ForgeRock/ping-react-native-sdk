/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type {
  DaVinciInstance,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-types';

/**
 * JSON-compatible value used by FIDO bridge payloads.
 */
export type FidoJsonValue =
  | string
  | number
  | boolean
  | null
  | FidoJsonValue[]
  | { [key: string]: FidoJsonValue };

/**
 * Dictionary-style FIDO registration options passed to native.
 *
 * @remarks
 * This v1 type intentionally stays flexible to match platform SDK payloads.
 */
export type FidoRegistrationOptions = { [key: string]: FidoJsonValue };

/**
 * Dictionary-style FIDO authentication options passed to native.
 *
 * @remarks
 * This v1 type intentionally stays flexible to match platform SDK payloads.
 */
export type FidoAuthenticationOptions = { [key: string]: FidoJsonValue };

/**
 * JSON-compatible FIDO registration result returned by native.
 */
export type FidoRegistrationResult = { [key: string]: FidoJsonValue };

/**
 * JSON-compatible FIDO authentication result returned by native.
 */
export type FidoAuthenticationResult = { [key: string]: FidoJsonValue };

/**
 * Success payload returned by Journey-scoped FIDO operations.
 */
export type FidoJourneyResult = {
  type: 'success';
};

/**
 * Options for Journey-scoped FIDO registration callback execution.
 */
export type FidoJourneyRegistrationOptions = {
  /**
   * Optional callback index when multiple FIDO registration callbacks are present.
   */
  index?: number;
  /**
   * Optional user-facing device name passed to native registration.
   */
  deviceName?: string;
};

/**
 * Options for Journey-scoped FIDO authentication callback execution.
 */
export type FidoJourneyAuthenticationOptions = {
  /**
   * Optional callback index when multiple FIDO authentication callbacks are present.
   */
  index?: number;
};

/**
 * DaVinci collector type emitted for FIDO collectors.
 *
 * @remarks
 * Both native DaVinci FIDO plugins register a single `FIDO2` collector type,
 * discriminated by `action` into registration and authentication variants.
 */
export const fidoCollectorType = 'FIDO2' as const;

/**
 * DaVinci collector requesting FIDO passkey registration.
 *
 * @public
 */
export type FidoRegistrationCollector = {
  /** Stable server-assigned identifier used as the collector key. */
  key: string;
  /** FIDO collector type. */
  type: typeof fidoCollectorType;
  /** Ceremony action dispatched by the native collector factory. */
  action: 'REGISTER';
  /** Human-readable label rendered for the collector. */
  label: string;
  /** Whether the collector must be completed before submission. */
  required: boolean;
  /**
   * Android-only trigger string surfaced by the native collector.
   *
   * @remarks
   * The iOS collector does not expose `trigger`, so the bridge omits the field
   * on that platform.
   *
   * TODO: iOS SDK will release this as part of 2.2. Update this comment remark after
   * upgrading dependencies to 2.2.0.
   */
  trigger?: string;
  /**
   * WebAuthn public key credential creation options returned by the server.
   *
   * @remarks
   * The native SDKs encode raw identifier arrays before the payload crosses the
   * bridge. Android emits unpadded base64url and iOS emits standard base64, so
   * consumers that decode these values must accept both flavours.
   */
  publicKeyCredentialCreationOptions?: Record<string, unknown>;
  /** Original server-side field JSON when available. */
  raw?: Record<string, unknown>;
};

/**
 * DaVinci collector requesting FIDO passkey authentication.
 *
 * @public
 */
export type FidoAuthenticationCollector = {
  /** Stable server-assigned identifier used as the collector key. */
  key: string;
  /** FIDO collector type. */
  type: typeof fidoCollectorType;
  /** Ceremony action dispatched by the native collector factory. */
  action: 'AUTHENTICATE';
  /** Human-readable label rendered for the collector. */
  label: string;
  /** Whether the collector must be completed before submission. */
  required: boolean;
  /**
   * Android-only trigger string surfaced by the native collector.
   *
   * @remarks
   * The iOS collector does not expose `trigger`, so the bridge omits the field
   * on that platform.
   */
  trigger?: string;
  /**
   * WebAuthn public key credential request options returned by the server.
   *
   * @remarks
   * The native SDKs encode raw identifier arrays before the payload crosses the
   * bridge. Android emits unpadded base64url and iOS emits standard base64, so
   * consumers that decode these values must accept both flavours.
   */
  publicKeyCredentialRequestOptions?: Record<string, unknown>;
  /** Original server-side field JSON when available. */
  raw?: Record<string, unknown>;
};

/**
 * DaVinci collector supplied by the FIDO plugin.
 *
 * @remarks
 * Discriminated by `action` into {@link FidoRegistrationCollector} and
 * {@link FidoAuthenticationCollector}. Deliberately does not extend the
 * DaVinci `BaseCollector` because the native FIDO base class is not a field
 * collector.
 *
 * @public
 */
export type FidoCollector =
  | FidoRegistrationCollector
  | FidoAuthenticationCollector;

/**
 * Options for DaVinci-scoped FIDO registration ceremony execution.
 *
 * @public
 */
export type FidoDaVinciRegistrationOptions = {
  /**
   * Optional collector index when multiple FIDO2 registration collectors are present.
   */
  index?: number;
};

/**
 * Options for DaVinci-scoped FIDO authentication ceremony execution.
 *
 * @public
 */
export type FidoDaVinciAuthenticationOptions = {
  /**
   * Optional collector index when multiple FIDO2 authentication collectors are present.
   */
  index?: number;
};

/**
 * Android-specific FIDO runtime configuration options.
 */
export type FidoAndroidConfig = {
  /**
   * Android API selection override.
   *
   * @remarks
   * Applies on Android only.
   * - `undefined`: Use native SDK auto-detection/default behavior.
   * - `true`: Force Google Play Services FIDO2 APIs.
   * - `false`: Force Android Credential Manager APIs.
   */
  useFido2Client?: boolean;
};

/**
 * Runtime configuration for the FIDO module.
 */
export type FidoConfig = {
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   * JavaScript-side FIDO logs use this logger on both platforms.
   * Native logger forwarding applies to standalone operations on both platforms.
   * Journey callback operations retain their Journey-configured native logger.
   */
  logger?: LoggerInstance;
  /**
   * Optional Android-specific configuration.
   */
  android?: FidoAndroidConfig;
};

/**
 * Resolved per-client configuration consumed by native FIDO operations.
 */
export type FidoClientConfig = {
  /**
   * Optional native logger handle id resolved from `logger.nativeHandle.id`.
   */
  loggerId?: string;
  /**
   * Optional Android API selection override.
   *
   * @remarks
   * - `undefined`: Use native SDK auto-detection/default behavior.
   * - `true`: Force Google Play Services FIDO2 APIs.
   * - `false`: Force Android Credential Manager APIs.
   */
  useFido2Client?: boolean;
};

/**
 * Result payload returned by a successful DaVinci FIDO ceremony.
 *
 * @remarks
 * The payload is the raw WebAuthn attestation or assertion produced by the native
 * ceremony. It is informational only: submission to the DaVinci flow happens
 * natively through the collector, so callers advance the flow with
 * `daVinci.next({ collectors: [] })`.
 *
 * @public
 */
export type FidoDaVinciResult = { [key: string]: FidoJsonValue };

/**
 * Reusable client for FIDO operations.
 */
export interface FidoClient {
  /**
   * Registers a new FIDO credential using native platform APIs.
   *
   * @param options Registration options payload.
   * @returns A promise that resolves to the registration result payload.
   * @throws FidoError when native registration fails.
   */
  register(options: FidoRegistrationOptions): Promise<FidoRegistrationResult>;
  /**
   * Authenticates with an existing FIDO credential using native platform APIs.
   *
   * @param options Authentication options payload.
   * @returns A promise that resolves to the authentication result payload.
   * @throws FidoError when native authentication fails.
   */
  authenticate(
    options: FidoAuthenticationOptions,
  ): Promise<FidoAuthenticationResult>;
  /**
   * Executes an active Journey FIDO registration callback.
   *
   * @param journey Active Journey instance.
   * @param options Optional registration callback execution options.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws FidoError when native callback execution fails.
   */
  registerForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyRegistrationOptions,
  ): Promise<FidoJourneyResult>;
  /**
   * Executes an active Journey FIDO authentication callback.
   *
   * @param journey Active Journey instance.
   * @param options Optional authentication callback execution options.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws FidoError when native callback execution fails.
   */
  authenticateForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyAuthenticationOptions,
  ): Promise<FidoJourneyResult>;
  /**
   * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` registration collector.
   *
   * @param daVinci Active DaVinci instance.
   * @param options Optional registration ceremony options.
   * @returns A promise that resolves to the WebAuthn attestation payload. Informational
   * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
   * @throws FidoError when the ceremony fails or the collector cannot be resolved.
   */
  registerForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciRegistrationOptions,
  ): Promise<FidoDaVinciResult>;
  /**
   * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` authentication collector.
   *
   * @param daVinci Active DaVinci instance.
   * @param options Optional authentication ceremony options.
   * @returns A promise that resolves to the WebAuthn assertion payload. Informational
   * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
   * @throws FidoError when the ceremony fails or the collector cannot be resolved.
   */
  authenticateForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciAuthenticationOptions,
  ): Promise<FidoDaVinciResult>;
}

/**
 * Error thrown when FIDO operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class FidoError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'FidoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): FidoError {
    return PingError.fromAs(raw, FidoError);
  }
}

/**
 * Stable error codes emitted by the FIDO module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 */
export type FidoErrorCode =
  | 'FIDO_ERROR'
  | 'FIDO_REGISTER_ERROR'
  | 'FIDO_AUTHENTICATE_ERROR'
  | 'FIDO_AUTHENTICATE_CANCELLED'
  | 'FIDO_ACTIVITY_UNAVAILABLE'
  | 'FIDO_WINDOW_UNAVAILABLE'
  | 'FIDO_CALLBACK_NOT_FOUND'
  | (string & {});

export type { DaVinciInstance, JourneyInstance };
