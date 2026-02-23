/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { getNativeModule } from './NativeRNPingOidc';
import type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcClient,
  OidcClientConfig,
  OidcUser,
  OidcWebClient,
} from './types';
import type { LoggerInstance, Tokens } from '@ping-identity/rn-types';
export { OidcProvider, useOidc } from './useOidc';
export type {
  OidcHookActions,
  OidcHookResult,
  OidcHookState,
  OidcProviderProps,
} from './useOidc';

/**
 * In-memory registry mapping native client ids to JS logger instances.
 */
const loggerRegistry = new Map<string, LoggerInstance>();

const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Strip internal token expiry fields before returning tokens to consumers.
 */
const sanitizeTokens = (
  tokens: { tokenExpiry?: number } & Omit<Tokens, never>
): Omit<Tokens, 'tokenExpiry'> => {
  const { tokenExpiry: _tokenExpiry, ...rest } = tokens;
  return rest;
};


/**
 * Create a native-backed OIDC client.
 *
 * @remarks
 * If you configured storage with `configureOidcStorage`, pass the returned
 * configuration in `config.storage` to bind the native token storage.
 *
 * @param config OIDC client configuration payload.
 * @returns OIDC client handle that wraps the native instance.
 * @throws Error when required configuration is missing or invalid.
 */
export function createOidcClient(config: OidcClientConfig): OidcClient {
  if (!config.discoveryEndpoint && !config.openId) {
    throw new Error(
      '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.'
    );
  }
  // TODO(iOS SDK 2.x): enforce full OpenID override requirements to match the native iOS behavior.
  const jsLogger = config.logger ?? noopLogger;
  const loggerId =
    config.nativeLogger?.id ??
    jsLogger.nativeHandle?.id;
  jsLogger.debug(
    `OIDC createClient config ${JSON.stringify(
      config,
      (_key, value) => (typeof value === 'function' ? undefined : value),
      2
    )}`
  );
  const clientId = getNativeModule().createClient({
    ...config,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  loggerRegistry.set(clientId, jsLogger);
  jsLogger.info('OIDC createClient success');
  return {
    id: clientId,
    token: async () => {
      jsLogger.debug('OIDC client token requested');
      try {
        const tokens = await getNativeModule().clientToken(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        jsLogger.error('OIDC client token failed');
        throw error;
      }
    },
    refresh: async () => {
      jsLogger.debug('OIDC client refresh requested');
      try {
        const tokens = await getNativeModule().clientRefresh(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        jsLogger.error('OIDC client refresh failed');
        throw error;
      }
    },
    userinfo: async (cache?: boolean) => {
      jsLogger.debug(
        `OIDC client userinfo requested ${JSON.stringify({
          cache: cache ?? false,
        })}`
      );
      try {
        return await getNativeModule().clientUserinfo(clientId, cache ?? false);
      } catch (error) {
        jsLogger.error('OIDC client userinfo failed');
        throw error;
      }
    },
    revoke: async () => {
      jsLogger.info('OIDC client revoke requested');
      try {
        return await getNativeModule().clientRevoke(clientId);
      } catch (error) {
        jsLogger.error('OIDC client revoke failed');
        throw error;
      }
    },
    endSession: async () => {
      jsLogger.info('OIDC client endSession requested');
      try {
        return await getNativeModule().clientEndSession(clientId);
      } catch (error) {
        jsLogger.error('OIDC client endSession failed');
        throw error;
      }
    },
  };
}

/**
 * Resolve a storage id from a configured storage handle.
 *
 * @throws Error when a storage object is provided without a valid OIDC handle.
 */
function resolveStorageId(value?: OidcClientConfig['storage']): string | undefined {
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
    handle.kind !== 'oidc'
  ) {
    throw new Error(
      '[@ping-identity/rn-oidc] Invalid storage handle. ' +
        'Use configureOidcStorage(...) from @react-native-pingidentity/storage.'
    );
  }
  return handle.id;
}

/**
 * Create a web-capable OIDC client from an existing OIDC client handle.
 *
 * @param client Native OIDC client handle returned by {@link createOidcClient}.
 * @returns Web client handle for browser-based authorization.
 */
export function createOidcWebClient(client: OidcClient): OidcWebClient {
  const loggerInstance = loggerRegistry.get(client.id) ?? noopLogger;
  loggerInstance.debug('OIDC createWebClient requested');
  const webClientId = getNativeModule().createWebClient(client.id);
  loggerInstance.info('OIDC createWebClient success');

  const user: OidcUser = {
    token: async () => {
      loggerInstance.debug('OIDC user token requested');
      try {
        const tokens = await getNativeModule().token(webClientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC user token failed');
        throw error;
      }
    },
    refresh: async () => {
      loggerInstance.debug('OIDC user refresh requested');
      try {
        const tokens = await getNativeModule().refresh(webClientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC user refresh failed');
        throw error;
      }
    },
    userinfo: async (cache?: boolean) => {
      loggerInstance.debug(
        `OIDC user userinfo requested ${JSON.stringify({
          cache: cache ?? false,
        })}`
      );
      try {
        return await getNativeModule().userinfo(webClientId, cache ?? false);
      } catch (error) {
        loggerInstance.error('OIDC user userinfo failed');
        throw error;
      }
    },
    revoke: async () => {
      loggerInstance.info('OIDC user revoke requested');
      try {
        return await getNativeModule().revoke(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC user revoke failed');
        throw error;
      }
    },
    logout: async () => {
      loggerInstance.info('OIDC user logout requested');
      try {
        return await getNativeModule().logout(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC user logout failed');
        throw error;
      }
    },
  };

  return {
    id: webClientId,
    authorize: async (options?: OidcAuthorizeOptions): Promise<OidcAuthorizeResult> => {
      loggerInstance.info('OIDC authorize requested');
      loggerInstance.debug(`OIDC authorize options ${JSON.stringify(options ?? {})}`);
      try {
        return await getNativeModule().authorize(webClientId, options ?? {});
      } catch (error) {
        loggerInstance.error('OIDC authorize failed');
        throw error;
      }
    },
    user: async () => {
      loggerInstance.debug('OIDC user resolve requested');
      let hasUser: boolean;
      try {
        hasUser = await getNativeModule().hasUser(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC hasUser failed');
        throw error;
      }
      if (hasUser) {
        loggerInstance.debug('OIDC hasUser true');
        return user;
      }
      loggerInstance.debug('OIDC hasUser false');
      return null;
    },
  };
}

export type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcClient,
  OidcClientConfig,
  OidcOpenIdConfiguration,
  OidcError,
  OidcErrorCode,
  OidcUser,
  OidcWebClient,
} from './types';
