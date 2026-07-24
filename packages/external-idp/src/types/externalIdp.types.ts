/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type { DaVinciInstance } from '@ping-identity/rn-types';
import type { JourneyInstance } from '@ping-identity/rn-types';
import type { LoggerInstance } from '@ping-identity/rn-types';

/**
 * Result returned by `authorizeForJourney()`.
 *
 * Maps the native `IdpResult` data class:
 * - Android: `com.pingidentity.idp.IdpResult`
 * - iOS: `IdpResult`
 */
export type ExternalIdpResult = {
  /** The token returned by the IdP authorization flow. */
  token: string;
  /** Additional parameters returned by the IdP. */
  additionalParameters?: Record<string, string>;
};

/**
 * Per-call options for `authorizeForJourney()`.
 *
 * `redirectUri` is NOT included here — it is captured once at factory creation time
 * via `createExternalIdpClient({ redirectUri })` when Auth Tab support is needed.
 */
export type ExternalIdpAuthorizeOptions = {
  /** Index of the `IdpCallback` to authorize when multiple are present. Defaults to 0. */
  index?: number;
};

/**
 * Per-call options for `selectProviderForJourney()`.
 */
export type ExternalIdpSelectOptions = {
  /** Index of the `SelectIdpCallback` to mutate when multiple are present. Defaults to 0. */
  index?: number;
};

/**
 * Public factory configuration for `createExternalIdpClient()`.
 */
export type ExternalIdpConfig = {
  /**
   * Optional app return URI used by Auth Tab-capable Android devices.
   *
   * When omitted, Android passes the native SDK's empty redirect URI default and
   * Custom Tab fallback returns through `appRedirectUriScheme`.
   *
   * @example
   * ```ts
   * createExternalIdpClient({ redirectUri: 'com.myapp://callback' })
   * ```
   */
  redirectUri?: string;
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   */
  logger?: LoggerInstance;
};

/**
 * Resolved internal configuration consumed by native bridge calls.
 *
 * Created once at factory time from `ExternalIdpConfig`.
 */
export type ExternalIdpClientConfig = {
  /** App return URI reused across calls, or an empty string for native defaults. */
  redirectUri: string;
  /** Optional native logger handle id resolved from `logger.nativeHandle.id`. */
  loggerId?: string;
};

/**
 * Reusable client for external IdP operations in Journey and DaVinci flows.
 */
export type ExternalIdpClient = {
  /**
   * Launches the external IdP authorization flow for a Journey-scoped `IdpCallback`.
   *
   * The native SDK handles the redirect internally — no JS-side deep-link listener
   * or `journey.resume(uri)` call is needed. On success, the callback's internal input
   * state is populated so `journey.next({})` picks up the token.
   *
   * @param journey Active Journey instance.
   * @param options Optional per-call authorize options (index).
   * @returns A promise that resolves to the authorize result (`token`, `additionalParameters`).
   * @throws ExternalIdpError when authorization fails.
   */
  authorizeForJourney(
    journey: JourneyInstance,
    options?: ExternalIdpAuthorizeOptions,
  ): Promise<ExternalIdpResult>;

  /**
   * Mutates the native `SelectIdpCallback` state for a Journey-scoped callback.
   *
   * Must be called before `journey.next({})` — calling `next()` with a `SelectIdPCallback`
   * entry directly always throws `MissingIntegrationException` / `missingIntegration` from
   * `JourneyCallbackValueApplier` on both platforms.
   *
   * @param journey Active Journey instance.
   * @param provider The provider identifier chosen by the user (e.g. `'google'`).
   * @param options Optional per-call select options (index).
   * @throws ExternalIdpError when the callback cannot be resolved.
   */
  selectProviderForJourney(
    journey: JourneyInstance,
    provider: string,
    options?: ExternalIdpSelectOptions,
  ): Promise<void>;

  /**
   * Launches the external IdP authorization flow for a DaVinci-scoped `IdpCollector`.
   *
   * Architecturally different from Journey: the IdP token flows through
   * `daVinci.next({ collectors: [] })` via the native `RequestInterceptor` mechanism
   * — this call does NOT return the token directly. Call `daVinci.next()` immediately
   * after this resolves to advance the flow.
   *
   * @remarks
   * No `selectProviderForDaVinci` equivalent exists — each social login option is its
   * own `IdpCollector` with `idpId`/`idpType`/`label` pre-set. The `index` option
   * handles the rare case of multiple `IdpCollector` instances on the same node.
   *
   * @param daVinci Active DaVinci instance.
   * @param options Optional per-call authorize options (index).
   * @returns A promise that resolves to void when the IdP redirect is complete.
   * @throws ExternalIdpError when authorization fails.
   */
  authorizeForDaVinci(
    daVinci: DaVinciInstance,
    options?: ExternalIdpAuthorizeOptions,
  ): Promise<void>;
};

/**
 * Error thrown when external IdP operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class ExternalIdpError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'ExternalIdpError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): ExternalIdpError {
    return PingError.fromAs(raw, ExternalIdpError);
  }
}

/**
 * Stable error codes emitted by the external IdP module.
 *
 * @remarks
 * Keep these in sync with native error constants:
 * - Android: `ExternalIdpErrorCodes.kt`
 * - iOS: `ExternalIdpErrorCode` Swift enum
 */
export type ExternalIdpErrorCode =
  | 'EXTERNAL_IDP_AUTHORIZE_ERROR'
  | 'EXTERNAL_IDP_CANCELLED'
  | 'EXTERNAL_IDP_UNSUPPORTED_PROVIDER'
  | 'EXTERNAL_IDP_CALLBACK_NOT_FOUND'
  | 'EXTERNAL_IDP_CONFIG_ERROR'
  | 'EXTERNAL_IDP_ACTIVITY_UNAVAILABLE' // Android only
  | 'EXTERNAL_IDP_WINDOW_UNAVAILABLE'; // iOS only

export type { DaVinciInstance, JourneyInstance };
