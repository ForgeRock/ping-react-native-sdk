/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  ExternalIdpAuthorizeOptions,
  ExternalIdpResult,
  ExternalIdpSelectOptions,
} from './types';
import type { ExternalIdpClientConfig } from './types/externalIdp.types';

/**
 * Native module specification for RNPingExternalIdp.
 *
 * Defines the interface contract for the native External IDP module.
 * Extends TurboModule for New Architecture support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing external social login.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Launches the external IdP authorization flow for a Journey-scoped `IdpCallback`.
   *
   * The native SDK handles the redirect internally.
   * On success, the callback's internal input state is populated so `journey.next({})` picks up
   * the token without JS re-submitting it.
   *
   * @param journeyId Native Journey instance id.
   * @param options Per-call authorize options payload (index).
   * @param config Per-client runtime configuration payload (loggerId, redirectUri).
   * @returns A promise that resolves to the authorize result payload (`token`, `additionalParameters`).
   */
  authorizeForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Mutates the native `SelectIdpCallback` state for a Journey-scoped callback.
   *
   * Must be called before `journey.next({})` — calling `next()` with a `SelectIdPCallback`
   * entry directly always throws `MissingIntegrationException` / `missingIntegration` from
   * `JourneyCallbackValueApplier` on both platforms.
   *
   * @param journeyId Native Journey instance id.
   * @param provider The provider identifier chosen by the user.
   * @param options Per-call select options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to void after the callback state is mutated.
   */
  selectProviderForJourney(
    journeyId: string,
    provider: string,
    options: Object,
    config: Object,
  ): Promise<void>;

  /**
   * Launches the external IdP authorization flow for a DaVinci-scoped `IdpCollector`.
   *
   * The token is NOT returned — it flows through `daVinci.next()` via the native
   * `RequestInterceptor`. Resolves void when the redirect is complete.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Per-call authorize options payload (index).
   * @param config Per-client runtime configuration payload (loggerId, redirectUri).
   * @returns A promise that resolves to void when authorization completes.
   */
  authorizeForDaVinci(
    davinciId: string,
    options: Object,
    config: Object,
  ): Promise<void>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 *
 * @returns Native module implementation for the current architecture.
 * @throws Error when no native module is registered.
 */
let _nativeModule: Spec | null = null;
/** @internal — resets the module cache for testing only. */
export function _resetNativeModuleForTesting(): void {
  _nativeModule = null;
}
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingExternalIdp');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingExternalIdpClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  // TODO(SDKS-separate-ticket): The __DEV__ guard that previously limited this
  // module list to dev builds was removed to keep all 13 NativeRNPing*.ts files
  // consistent and to avoid Jest test failures (jest environments don't define __DEV__).
  // Revisit with a proper cross-package solution in a future ticket.
  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-external-idp] Native module RNPingExternalIdp not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts authorize options to a codegen-compatible object.
 */
export function toNativeAuthorizeOptions(
  options: ExternalIdpAuthorizeOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts select provider options to a codegen-compatible object.
 */
export function toNativeSelectOptions(
  options: ExternalIdpSelectOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts client config to a codegen-compatible object.
 */
export function toNativeConfig(
  config: ExternalIdpClientConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Validates and maps the native authorize payload to the typed result.
 *
 * Guards against malformed bridge payloads at runtime: result must be a
 * non-null object, token must be a string, and every additionalParameters
 * value must be a string.
 */
export function fromNativeAuthorizeResult(result: unknown): ExternalIdpResult {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(
      'Invalid native authorize result: result must be an object',
    );
  }

  const raw = result as Record<string, unknown>;

  if (typeof raw.token !== 'string') {
    throw new Error('Invalid native authorize result: token must be a string');
  }

  if (raw.additionalParameters !== undefined) {
    if (
      raw.additionalParameters === null ||
      typeof raw.additionalParameters !== 'object' ||
      Array.isArray(raw.additionalParameters)
    ) {
      throw new Error(
        'Invalid native authorize result: additionalParameters must be an object',
      );
    }

    const params = raw.additionalParameters as Record<string, unknown>;
    for (const key of Object.keys(params)) {
      if (typeof params[key] !== 'string') {
        throw new Error(
          `Invalid native authorize result: additionalParameters.${key} must be a string`,
        );
      }
    }
  }

  const validated: ExternalIdpResult = { token: raw.token };
  if (raw.additionalParameters !== undefined) {
    validated.additionalParameters = raw.additionalParameters as Record<
      string,
      string
    >;
  }
  return validated;
}

export default getNativeModule;
