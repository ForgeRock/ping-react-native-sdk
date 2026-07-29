/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  fromNativeAuthorizeResult,
  getNativeModule,
  toNativeAuthorizeOptions,
  toNativeConfig,
  toNativeSelectOptions,
} from './NativeRNPingExternalIdp';
import { noopLogger } from '@ping-identity/rn-types';
import type {
  DaVinciInstance,
  ExternalIdpAuthorizeOptions,
  ExternalIdpClient,
  ExternalIdpConfig,
  ExternalIdpResult,
  ExternalIdpSelectOptions,
  JourneyInstance,
} from './types';
import { ExternalIdpError } from './types/externalIdp.types';
import type { ExternalIdpClientConfig } from './types/externalIdp.types';

/**
 * Resolve an optional redirect URI and reject values that cannot be used by Auth Tabs.
 *
 * @param redirectUri Optional app return URI configured for Auth Tab-capable devices.
 * @returns Trimmed redirect URI with a scheme, or an empty string to delegate to native defaults.
 * @throws Error when a non-empty `redirectUri` is missing a URI scheme.
 */
function normalizeRedirectUri(redirectUri?: string): string {
  const resolved = redirectUri?.trim();
  if (!resolved) {
    return '';
  }
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(resolved)) {
    throw new ExternalIdpError(
      '[@ping-identity/rn-external-idp] `redirectUri` must include a URI scheme. ' +
        "Provide the app's registered URL scheme (e.g. 'com.myapp://callback').",
      'EXTERNAL_IDP_CONFIG_ERROR',
      'argument_error',
    );
  }
  return resolved;
}

/**
 * Resolve the provider identifier selected for a Journey `SelectIdpCallback`.
 *
 * @param provider Provider identifier chosen by the user.
 * @returns Trimmed provider identifier.
 * @throws Error when `provider` is missing or blank.
 */
function normalizeProvider(provider: string): string {
  const resolved = provider?.trim();
  if (!resolved) {
    throw new ExternalIdpError(
      '[@ping-identity/rn-external-idp] `provider` is required. ' +
        'Pass the provider identifier selected from the Journey callback.',
      'EXTERNAL_IDP_CONFIG_ERROR',
      'argument_error',
    );
  }
  return resolved;
}

/**
 * Creates a reusable External IdP client instance for Journey flows.
 *
 * @param config Runtime External IdP configuration payload.
 * @returns An External IdP client bound to the resolved configuration.
 * @throws Error when a non-empty `redirectUri` is missing a URI scheme.
 *
 * @remarks
 * `redirectUri` is optional and captured once at factory creation time. When omitted,
 * Android delegates Custom Tab redirects to the native `appRedirectUriScheme` manifest
 * placeholder; provide it when you need Auth Tab support with a specific app return URI.
 * Logger integration is optional and uses `logger(...).nativeHandle.id` when provided.
 */
export function createExternalIdpClient(
  config: ExternalIdpConfig,
): ExternalIdpClient {
  const redirectUri = normalizeRedirectUri(config.redirectUri);

  const logger = config.logger ?? noopLogger;
  const resolvedConfig: ExternalIdpClientConfig = {
    redirectUri,
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
  };

  logger.debug(
    `ExternalIdp createClient config ${JSON.stringify(
      {
        hasLogger: Boolean(resolvedConfig.loggerId),
        redirectUri: resolvedConfig.redirectUri,
      },
      null,
      2,
    )}`,
  );
  logger.info('ExternalIdp createClient success');

  async function withLogging<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    logger.info(`ExternalIdp ${operation} requested`);
    try {
      const result = await fn();
      logger.debug(`ExternalIdp ${operation} success`);
      return result;
    } catch (error) {
      logger.error(`ExternalIdp ${operation} failed`);
      throw ExternalIdpError.from(error);
    }
  }

  return {
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
      options: ExternalIdpAuthorizeOptions = {},
    ): Promise<ExternalIdpResult> {
      return withLogging('authorizeForJourney', async () => {
        const journeyId = await journey.getId();
        const result = await getNativeModule().authorizeForJourney(
          journeyId,
          toNativeAuthorizeOptions(options),
          toNativeConfig(resolvedConfig),
        );
        return fromNativeAuthorizeResult(result);
      });
    },

    /**
     * Mutates the native `SelectIdpCallback` state for a Journey-scoped callback.
     *
     * Must be called before `journey.next({})` — calling `next()` with a `SelectIdPCallback`
     * entry directly always throws `MissingIntegrationException` / `missingIntegration` from
     * `JourneyCallbackValueApplier` on both platforms.
     *
     * Note: `SelectIdPCallback` does not involve an OAuth redirect, so `redirectUri` from the
     * client config is not used by the native implementation for this call. The full config is
     * still forwarded so that shared fields (e.g. `loggerId`) are available on the native side.
     *
     * @param journey Active Journey instance.
     * @param provider The provider identifier chosen by the user (e.g. `'google'`).
     * @param options Optional per-call select options (index).
     * @throws ExternalIdpError when the callback cannot be resolved.
     */
    selectProviderForJourney(
      journey: JourneyInstance,
      provider: string,
      options: ExternalIdpSelectOptions = {},
    ): Promise<void> {
      return withLogging('selectProviderForJourney', async () => {
        const journeyId = await journey.getId();
        const selectedProvider = normalizeProvider(provider);
        await getNativeModule().selectProviderForJourney(
          journeyId,
          selectedProvider,
          toNativeSelectOptions(options),
          toNativeConfig(resolvedConfig),
        );
      });
    },

    /**
     * Launches the external IdP authorization flow for a DaVinci-scoped `IdpCollector`.
     *
     * Architecturally different from Journey: the IdP token flows through
     * `daVinci.next({ collectors: [] })` via the native `RequestInterceptor` mechanism
     * — this call resolves void, not a token. Call `daVinci.next()` immediately after.
     *
     * @param daVinci Active DaVinci instance.
     * @param options Optional per-call authorize options (index).
     * @throws ExternalIdpError when authorization fails.
     */
    authorizeForDaVinci(
      daVinci: DaVinciInstance,
      options: ExternalIdpAuthorizeOptions = {},
    ): Promise<void> {
      return withLogging('authorizeForDaVinci', async () => {
        const davinciId = await daVinci.getId();
        await getNativeModule().authorizeForDaVinci(
          davinciId,
          toNativeAuthorizeOptions(options),
          toNativeConfig(resolvedConfig),
        );
      });
    },
  };
}
