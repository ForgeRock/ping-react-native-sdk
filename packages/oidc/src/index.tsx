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
import type { Tokens } from '@ping-identity/rn-types';
import type { LoggerInstance, LogLevel } from '@react-native-pingidentity/logger';

const loggerRegistry = new Map<string, LoggerInstance>();
const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: (_level: LogLevel) => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

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
  const loggerInstance = config.logger ?? noopLogger;
  loggerInstance.debug(
    `OIDC createClient config ${JSON.stringify(
      config,
      (_key, value) => (typeof value === 'function' ? undefined : value),
      2
    )}`
  );
  const loggerId =
    config.nativeLogger?.id ?? config.logger?.nativeHandle?.id ?? undefined;
  const clientId = getNativeModule().createClient({
    ...config,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  loggerRegistry.set(clientId, loggerInstance);
  loggerInstance.info('OIDC createClient success');
  return {
    id: clientId,
    token: async () => {
      loggerInstance.debug('OIDC client token requested');
      try {
        const tokens = await getNativeModule().clientToken(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC client token failed');
        throw error;
      }
    },
    refresh: async () => {
      loggerInstance.debug('OIDC client refresh requested');
      try {
        const tokens = await getNativeModule().clientRefresh(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC client refresh failed');
        throw error;
      }
    },
    userinfo: async (cache?: boolean) => {
      loggerInstance.debug(
        `OIDC client userinfo requested ${JSON.stringify({
          cache: cache ?? false,
        })}`
      );
      try {
        return await getNativeModule().clientUserinfo(clientId, cache ?? false);
      } catch (error) {
        loggerInstance.error('OIDC client userinfo failed');
        throw error;
      }
    },
    revoke: async () => {
      loggerInstance.info('OIDC client revoke requested');
      try {
        return await getNativeModule().clientRevoke(clientId);
      } catch (error) {
        loggerInstance.error('OIDC client revoke failed');
        throw error;
      }
    },
    endSession: async () => {
      loggerInstance.info('OIDC client endSession requested');
      try {
        return await getNativeModule().clientEndSession(clientId);
      } catch (error) {
        loggerInstance.error('OIDC client endSession failed');
        throw error;
      }
    },
  };
}

function resolveStorageId(value?: OidcClientConfig['storage']): string | undefined {
  if (!value) {
    return undefined;
  }
  if (!value.id) {
    throw new Error(
      '[@ping-identity/rn-oidc] Invalid storage handle. Expected a storage config with an id.'
    );
  }
  return value.id;
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
    hasUser: async () => {
      loggerInstance.debug('OIDC hasUser requested');
      try {
        return await getNativeModule().hasUser(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC hasUser failed');
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
