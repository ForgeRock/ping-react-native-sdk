/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError } from '@ping-identity/rn-types';
import type { JourneyInstance } from '@ping-identity/rn-types';
import type { LoggerInstance } from '@ping-identity/rn-types';

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
 * Android-specific FIDO runtime configuration options.
 */
export type FidoAndroidConfig = {
  /**
   * When true, prefers Google Play Services FIDO2 APIs.
   *
   * @remarks
   * Applies on Android only.
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
   * Optional Android API selection toggle.
   */
  useFido2Client?: boolean;
};

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
    options: FidoAuthenticationOptions
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
    options?: FidoJourneyRegistrationOptions
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
    options?: FidoJourneyAuthenticationOptions
  ): Promise<FidoJourneyResult>;
}

/**
 * Error payload returned when FIDO operations fail.
 *
 * @remarks
 * Rejections use this shape; success resolves with a JSON-compatible payload.
 */
export type FidoError = GenericError;

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
  | 'FIDO_CALLBACK_NOT_FOUND';

export type { JourneyInstance };
