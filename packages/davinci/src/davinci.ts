/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  configureDaVinci,
  disposeDaVinci,
  getDaVinciSession,
  getDaVinciUserInfo,
  logoutDaVinci,
  nextDaVinci,
  refreshDaVinciSession,
  revokeDaVinciSession,
  startDaVinci,
} from './davinciMethods';
import type { NativeDaVinciConfig } from './NativeRNPingDavinci';
import type { DaVinciClient, DaVinciConfig, DaVinciNextInput } from './types';
import { DaVinciError } from './types/error.types';
import { noopLogger } from '@ping-identity/rn-types';

/**
 * Resolves and validates the OIDC storage handle id from the config.
 *
 * @param value - Candidate storage handle value.
 * @returns Resolved storage id string, or `undefined` when absent.
 * @throws {DaVinciError} When the handle is present but has an invalid shape.
 */
function resolveOidcStorageId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  const handle = value as { id?: unknown; kind?: unknown };

  if (
    typeof handle.id !== 'string' ||
    !handle.id.trim() ||
    handle.kind !== 'oidc'
  ) {
    throw new DaVinciError(
      '[@ping-identity/rn-davinci] Invalid modules.oidc.storage handle. ' +
        'Use configureOidcStorage(...) from @ping-identity/rn-storage.',
      'DAVINCI_CONFIG_ERROR',
      'argument_error',
    );
  }

  return handle.id;
}

/**
 * Creates a native-backed DaVinci client instance.
 *
 * @remarks
 * The native workflow instance is configured lazily on the first method call.
 * All OIDC fields are sourced from `config.modules.oidc`; transport and logging
 * options (`timeout`, `logger`) are top-level and map to `WorkflowConfig`.
 *
 * TODO-SDK-FUTURE-SUPPORT: Both SDKs resolve a server field to a collector by
 * looking up `inputType` first and falling back to `type` (Android
 * `CollectorFactory.collector()`, iOS `CollectorFactory.collector(daVinci:from:)`).
 * In practice DaVinci payloads always carry `inputType`, so the iOS-only
 * registrations for FLOW_BUTTON / FLOW_LINK / DROPDOWN / RADIO / COMBOBOX /
 * CHECKBOX behave as redundant aliases — payloads with those `type` values
 * still resolve via their `inputType` (ACTION / SINGLE_SELECT / MULTI_SELECT)
 * on Android. The genuine gap is for field types where neither `inputType` nor
 * `type` matches a registered entry on a given platform (e.g. SINGLE_CHECKBOX,
 * AGREEMENT, or any future server-only types). Those are surfaced to JS via
 * `ContinueNode.unsupportedFields` on both platforms so consumers can detect
 * them and render a placeholder, log, or block submit rather than silently
 * missing inputs. Re-evaluate once the SDKs add registrations for any newly
 * server-introduced field types.
 *
 * @param config - DaVinci client configuration.
 * @returns A `DaVinciClient` handle for driving DaVinci flows.
 * @throws {DaVinciError} When required configuration fields are missing or invalid.
 *
 * @example
 * ```ts
 * const client = createDaVinciClient({
 *   modules: {
 *     oidc: {
 *       discoveryEndpoint: 'https://auth.example.com/.well-known/openid-configuration',
 *       clientId: 'my-client-id',
 *       redirectUri: 'myapp://callback',
 *     },
 *   },
 * });
 *
 * const node = await client.start();
 * ```
 */
export function createDaVinciClient(config: DaVinciConfig): DaVinciClient {
  const oidcConfig = config.modules?.oidc;

  if (!oidcConfig?.discoveryEndpoint?.trim()) {
    throw new DaVinciError(
      '[@ping-identity/rn-davinci] Missing configuration. ' +
        'Provide a non-empty modules.oidc.discoveryEndpoint.',
      'DAVINCI_CONFIG_ERROR',
      'argument_error',
    );
  }

  if (!oidcConfig.clientId?.trim()) {
    throw new DaVinciError(
      '[@ping-identity/rn-davinci] Missing configuration. ' +
        'Provide a non-empty modules.oidc.clientId.',
      'DAVINCI_CONFIG_ERROR',
      'argument_error',
    );
  }

  if (!oidcConfig.redirectUri?.trim()) {
    throw new DaVinciError(
      '[@ping-identity/rn-davinci] Missing configuration. ' +
        'Provide a non-empty modules.oidc.redirectUri.',
      'DAVINCI_CONFIG_ERROR',
      'argument_error',
    );
  }

  const storageId = resolveOidcStorageId(oidcConfig.storage);
  const jsLogger = config.logger ?? noopLogger;
  const rawLoggerId = config.logger?.nativeHandle?.id;
  const loggerId = rawLoggerId?.trim() ? rawLoggerId : undefined;

  const nativeConfig: NativeDaVinciConfig = {
    discoveryEndpoint: oidcConfig.discoveryEndpoint,
    clientId: oidcConfig.clientId,
    redirectUri: oidcConfig.redirectUri,
    scopes: oidcConfig.scopes,
    storageId,
    signOutRedirectUri: oidcConfig.signOutRedirectUri,
    loginHint: oidcConfig.loginHint,
    nonce: oidcConfig.nonce,
    state: oidcConfig.state,
    prompt: oidcConfig.prompt,
    display: oidcConfig.display,
    uiLocales: oidcConfig.uiLocales,
    acrValues: oidcConfig.acrValues,
    refreshThreshold: oidcConfig.refreshThreshold,
    additionalParameters: oidcConfig.additionalParameters,
    timeout: config.timeout,
    loggerId,
  };

  let davinciId: string | null = null;

  const serialize = (payload: Record<string, unknown>): string =>
    JSON.stringify(payload, (_key, value) =>
      typeof value === 'function' ? undefined : value,
    );

  const logDebug = (
    message: string,
    payload?: Record<string, unknown>,
  ): void => {
    if (payload) {
      jsLogger.debug(`${message} ${serialize(payload)}`);
      return;
    }
    jsLogger.debug(message);
  };

  const logInfo = (message: string, payload: Record<string, unknown>): void => {
    jsLogger.info(`${message} ${serialize(payload)}`);
  };

  const logError = (
    message: string,
    error: unknown,
    payload?: Record<string, unknown>,
  ): void => {
    const errorPayload: Record<string, unknown> = {
      ...(payload ?? {}),
      cause: error instanceof Error ? error.message : String(error),
    };
    jsLogger.error(`${message} ${serialize(errorPayload)}`);
  };

  /**
   * Ensures the native DaVinci instance has been configured.
   *
   * @returns Native DaVinci identifier.
   * @throws {DaVinciError} When configuration fails.
   */
  const ensureConfigured = async (): Promise<string> => {
    if (!davinciId) {
      logDebug('DaVinci configure requested');
      try {
        davinciId = await configureDaVinci(nativeConfig);
        logInfo('DaVinci configure succeeded', { davinciId });
      } catch (error) {
        logError('DaVinci configure failed', error);
        throw error;
      }
    }
    return davinciId;
  };

  return {
    async start() {
      const id = await ensureConfigured();
      logDebug('DaVinci start requested', { davinciId: id });
      try {
        const node = await startDaVinci(id);
        logInfo('DaVinci start succeeded', { davinciId: id });
        return node;
      } catch (error) {
        logError('DaVinci start failed', error, { davinciId: id });
        throw error;
      }
    },

    async next(input: DaVinciNextInput) {
      const id = await ensureConfigured();
      logDebug('DaVinci next requested', { davinciId: id });
      try {
        const node = await nextDaVinci(id, input);
        logInfo('DaVinci next succeeded', { davinciId: id });
        return node;
      } catch (error) {
        logError('DaVinci next failed', error, { davinciId: id });
        throw error;
      }
    },

    async user() {
      const id = await ensureConfigured();
      logDebug('DaVinci user requested', { davinciId: id });
      try {
        const session = await getDaVinciSession(id);
        logInfo('DaVinci user resolved', {
          davinciId: id,
          hasSession: Boolean(session),
        });
        return session;
      } catch (error) {
        logError('DaVinci user failed', error, { davinciId: id });
        throw error;
      }
    },

    async refresh() {
      const id = await ensureConfigured();
      logDebug('DaVinci refresh requested', { davinciId: id });
      try {
        const session = await refreshDaVinciSession(id);
        logInfo('DaVinci refresh succeeded', {
          davinciId: id,
          hasSession: Boolean(session),
        });
        return session;
      } catch (error) {
        logError('DaVinci refresh failed', error, { davinciId: id });
        throw error;
      }
    },

    async revoke() {
      const id = await ensureConfigured();
      logDebug('DaVinci revoke requested', { davinciId: id });
      try {
        const revoked = await revokeDaVinciSession(id);
        logInfo('DaVinci revoke succeeded', { davinciId: id, revoked });
        return revoked;
      } catch (error) {
        logError('DaVinci revoke failed', error, { davinciId: id });
        throw error;
      }
    },

    async userinfo() {
      const id = await ensureConfigured();
      logDebug('DaVinci userinfo requested', { davinciId: id });
      try {
        const info = await getDaVinciUserInfo(id);
        logInfo('DaVinci userinfo resolved', {
          davinciId: id,
          hasUserInfo: Boolean(info),
        });
        return info;
      } catch (error) {
        logError('DaVinci userinfo failed', error, { davinciId: id });
        throw error;
      }
    },

    async logoutUser() {
      const id = await ensureConfigured();
      logDebug('DaVinci logout requested', { davinciId: id });
      try {
        await logoutDaVinci(id);
        logInfo('DaVinci logout succeeded', { davinciId: id });
      } catch (error) {
        logError('DaVinci logout failed', error, { davinciId: id });
        throw error;
      }
    },

    async dispose() {
      if (!davinciId) {
        logDebug('DaVinci dispose skipped (no active davinciId)');
        return;
      }
      const id = davinciId;
      logDebug('DaVinci dispose requested', { davinciId: id });
      try {
        await disposeDaVinci(id);
        logInfo('DaVinci dispose succeeded', { davinciId: id });
        davinciId = null;
      } catch (error) {
        logError('DaVinci dispose failed', error, { davinciId: id });
        throw error;
      }
    },
  };
}
