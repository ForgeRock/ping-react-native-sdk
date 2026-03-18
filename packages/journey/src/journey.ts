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
        `Use ${configureMethod}(...) from @ping-identity/rn-storage.`
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
  const jsLogger = config.logger ?? noopLogger;
  const rawLoggerId =
    config.logger?.nativeHandle?.id ??
    oidcConfig?.nativeLogger?.id ??
    jsLogger.nativeHandle?.id;
  const loggerId = rawLoggerId?.trim() ? rawLoggerId : undefined;

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

  const serialize = (payload: Record<string, unknown>): string => (
    JSON.stringify(payload, (_key, value) => (
      typeof value === 'function' ? undefined : value
    ))
  );

  const logDebug = (message: string, payload?: Record<string, unknown>): void => {
    if (payload) {
      jsLogger.debug(`${message} ${serialize(payload)}`);
      return;
    }
    jsLogger.debug(message);
  };

  const logInfo = (message: string, payload?: Record<string, unknown>): void => {
    if (payload) {
      jsLogger.info(`${message} ${serialize(payload)}`);
      return;
    }
    jsLogger.info(message);
  };

  const logError = (
    message: string,
    error: unknown,
    payload?: Record<string, unknown>
  ): void => {
    const errorPayload: Record<string, unknown> = {
      ...(payload ?? {}),
      cause: error instanceof Error ? error.message : String(error),
    };
    jsLogger.error(`${message} ${serialize(errorPayload)}`);
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
      try {
        journeyId = await configureJourney(nativeConfig);
        logInfo('Journey configure succeeded', { journeyId });
      } catch (error) {
        logError('Journey configure failed', error);
        throw error;
      }
    }
    return journeyId;
  };

  return {
    async init(): Promise<string> {
      logDebug('Journey init requested');
      const id = await ensureConfigured();
      logInfo('Journey init succeeded', { journeyId: id });
      return id;
    },

    async getId(): Promise<string> {
      const id = await ensureConfigured();
      logDebug('Journey getId resolved', { journeyId: id });
      return id;
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
      try {
        const node = await startJourney(id, journeyName, options);
        logInfo('Journey start succeeded', { journeyId: id, journeyName });
        return node;
      } catch (error) {
        logError('Journey start failed', error, { journeyId: id, journeyName });
        throw error;
      }
    },

    async next(input: JourneyNextInput = {}) {
      const id = await ensureConfigured();
      logDebug('Journey next requested');
      try {
        const node = await nextNode(id, input);
        logInfo('Journey next succeeded', { journeyId: id });
        return node;
      } catch (error) {
        logError('Journey next failed', error, { journeyId: id });
        throw error;
      }
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
      try {
        const node = await resumeJourney(id, uri);
        logInfo('Journey resume succeeded', { journeyId: id });
        return node;
      } catch (error) {
        logError('Journey resume failed', error, { journeyId: id });
        throw error;
      }
    },

    async user() {
      const id = await ensureConfigured();
      logDebug('Journey user requested', { journeyId: id });
      try {
        const session = await getSession(id);
        logInfo('Journey user resolved', { journeyId: id, hasSession: Boolean(session) });
        return session;
      } catch (error) {
        logError('Journey user failed', error, { journeyId: id });
        throw error;
      }
    },

    async refresh() {
      const id = await ensureConfigured();
      logDebug('Journey refresh requested', { journeyId: id });
      try {
        const session = await refreshSession(id);
        logInfo('Journey refresh succeeded', { journeyId: id, hasSession: Boolean(session) });
        return session;
      } catch (error) {
        logError('Journey refresh failed', error, { journeyId: id });
        throw error;
      }
    },

    async revoke() {
      const id = await ensureConfigured();
      logDebug('Journey revoke requested', { journeyId: id });
      try {
        const revoked = await revokeSession(id);
        logInfo('Journey revoke succeeded', { journeyId: id, revoked });
        return revoked;
      } catch (error) {
        logError('Journey revoke failed', error, { journeyId: id });
        throw error;
      }
    },

    async userinfo() {
      const id = await ensureConfigured();
      logDebug('Journey userinfo requested', { journeyId: id });
      try {
        const info = await getUserInfo(id);
        logInfo('Journey userinfo resolved', { journeyId: id, hasUserInfo: Boolean(info) });
        return info;
      } catch (error) {
        logError('Journey userinfo failed', error, { journeyId: id });
        throw error;
      }
    },

    async ssoToken() {
      const id = await ensureConfigured();
      logDebug('Journey ssoToken requested', { journeyId: id });
      try {
        const token = await getSSOToken(id);
        logInfo('Journey ssoToken resolved', { journeyId: id, hasSsoToken: Boolean(token) });
        return token;
      } catch (error) {
        logError('Journey ssoToken failed', error, { journeyId: id });
        throw error;
      }
    },

    async logoutUser() {
      const id = await ensureConfigured();
      logDebug('Journey logout requested', { journeyId: id });
      try {
        const loggedOut = await logout(id);
        logInfo('Journey logout succeeded', { journeyId: id, loggedOut });
        return loggedOut;
      } catch (error) {
        logError('Journey logout failed', error, { journeyId: id });
        throw error;
      }
    },

    async dispose() {
      if (!journeyId) {
        logDebug('Journey dispose skipped (no active journey id)');
        return;
      }
      const id = journeyId;
      logDebug('Journey dispose requested', { journeyId: id });
      try {
        await disposeJourney(id);
        logInfo('Journey dispose succeeded', { journeyId: id });
        journeyId = null;
      } catch (error) {
        logError('Journey dispose failed', error, { journeyId: id });
        throw error;
      }
    },
  };
}
