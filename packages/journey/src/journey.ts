/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  configureJourney,
  disposeJourney,
  getSSOToken,
  getSession,
  getUserInfo,
  logout,
  nextNode,
  refreshSession,
  revokeSession,
  resumeJourney,
  startJourney,
} from './journeyMethods';
import type {
  JourneyClient,
  JourneyConfig,
  JourneyError,
  JourneyNextInput,
  JourneyStartOptions,
} from './types';
import type { NativeJourneyConfig } from './NativeRNPingJourney';
import type { LoggerInstance } from '@ping-identity/rn-types';

type StorageHandleKind = 'session' | 'oidc';

const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Resolves and validates a storage handle id for Journey module config.
 *
 * @param value - Candidate storage handle value
 * @param expectedKind - Required storage handle kind
 * @param modulePath - Config path used in error messages
 * @param configureMethod - Expected storage configure method name
 * @returns Resolved handle id when present
 * @throws {Error} When the handle shape is invalid
 */
function resolveStorageHandleId(
  value: unknown,
  expectedKind: StorageHandleKind,
  modulePath: string,
  configureMethod: 'configureSessionStorage' | 'configureOidcStorage'
): string | undefined {
  if (!value) {
    return undefined;
  }

  const handle = value as {
    id?: unknown;
    kind?: unknown;
  };

  if (
    typeof handle.id !== 'string' ||
    !handle.id.trim() ||
    handle.kind !== expectedKind
  ) {
    throw new Error(
      `[@ping-identity/rn-journey] Invalid ${modulePath} handle. ` +
        `Use ${configureMethod}(...) from @react-native-pingidentity/storage.`
    );
  }

  return handle.id;
}

/**
 * Creates a native-backed Journey client instance.
 *
 * @param config - Journey configuration payload.
 * @returns A `JourneyClient` handle for imperative Journey flows.
 * @throws {Error} When required configuration is missing.
 */
export function createJourneyClient(
  config: JourneyConfig
): JourneyClient {
  if (!config.serverUrl?.trim()) {
    throw new Error(
      '[@ping-identity/rn-journey] Missing configuration. Provide a non-empty serverUrl.'
    );
  }

  let journeyId: string | null = null;
  const sessionStorageId = resolveStorageHandleId(
    config.modules?.session?.storage,
    'session',
    'modules.session.storage',
    'configureSessionStorage'
  );
  const oidcStorageId = resolveStorageHandleId(
    config.modules?.oidc?.storage,
    'oidc',
    'modules.oidc.storage',
    'configureOidcStorage'
  );
  const oidcConfig = config.modules?.oidc;
  const jsLogger = config.logger ?? oidcConfig?.logger ?? noopLogger;
  const loggerId =
    config.logger?.nativeHandle?.id ??
    oidcConfig?.nativeLogger?.id ??
    jsLogger.nativeHandle?.id;

  const nativeConfig: NativeJourneyConfig = {
    serverUrl: config.serverUrl,
    timeout: config.timeout,
    realm: config.realm,
    cookie: config.cookie,
    clientId: oidcConfig?.clientId,
    discoveryEndpoint: oidcConfig?.discoveryEndpoint,
    openId: oidcConfig?.openId,
    redirectUri: oidcConfig?.redirectUri,
    scopes: oidcConfig?.scopes,
    acrValues: oidcConfig?.acrValues,
    signOutRedirectUri: oidcConfig?.signOutRedirectUri,
    state: oidcConfig?.state,
    nonce: oidcConfig?.nonce,
    uiLocales: oidcConfig?.uiLocales,
    refreshThreshold: oidcConfig?.refreshThreshold,
    loginHint: oidcConfig?.loginHint,
    display: oidcConfig?.display,
    prompt: oidcConfig?.prompt,
    additionalParameters: oidcConfig?.additionalParameters,
    sessionStorageId,
    oidcStorageId,
    loggerId,
  };

  const logDebug = (message: string, payload?: Record<string, unknown>): void => {
    if (payload) {
      jsLogger.debug(
        `${message} ${JSON.stringify(payload, (_key, value) => (
          typeof value === 'function' ? undefined : value
        ))}`
      );
      return;
    }
    jsLogger.debug(message);
  };

  /**
   * Ensures the native Journey instance has been configured.
   *
   * @returns Native Journey identifier.
   * @throws {JourneyError} When configuration fails.
   */
  const ensureConfigured = async (): Promise<string> => {
    if (!journeyId) {
      logDebug('Journey configure requested');
      journeyId = await configureJourney(nativeConfig);
      logDebug('Journey configure succeeded', { journeyId });
    }
    return journeyId;
  };

  return {
    async init(): Promise<string> {
      return await ensureConfigured();
    },

    async getId(): Promise<string> {
      return await ensureConfigured();
    },

    async start(
      journeyName: string,
      options?: JourneyStartOptions
    ) {
      if (!journeyName.trim()) {
        throw {
          type: 'argument_error',
          error: 'JOURNEY_START_ERROR',
          message: 'Journey name must not be empty.',
        } satisfies JourneyError;
      }

      const id = await ensureConfigured();
      logDebug('Journey start requested', { journeyName });
      return await startJourney(id, journeyName, options);
    },

    async next(input: JourneyNextInput = {}) {
      const id = await ensureConfigured();
      logDebug('Journey next requested');
      return await nextNode(id, input);
    },

    async resume(uri: string) {
      if (!uri.trim()) {
        throw {
          type: 'argument_error',
          error: 'JOURNEY_RESUME_ERROR',
          message: 'Resume URI must not be empty.',
        } satisfies JourneyError;
      }

      const id = await ensureConfigured();
      logDebug('Journey resume requested');
      return await resumeJourney(id, uri);
    },

    async user() {
      const id = await ensureConfigured();
      return await getSession(id);
    },

    async refresh() {
      const id = await ensureConfigured();
      return await refreshSession(id);
    },

    async revoke() {
      const id = await ensureConfigured();
      return await revokeSession(id);
    },

    async userinfo() {
      const id = await ensureConfigured();
      return await getUserInfo(id);
    },

    async ssoToken() {
      const id = await ensureConfigured();
      return await getSSOToken(id);
    },

    async logoutUser() {
      const id = await ensureConfigured();
      return await logout(id);
    },

    async dispose() {
      if (!journeyId) {
        return;
      }
      await disposeJourney(journeyId);
      journeyId = null;
    },
  };
}
