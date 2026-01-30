/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { configureLogger, logger as createLogger } from '@react-native-pingidentity/logger';
import { getNativeModule } from './NativeRNPingOidc';
import type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcClient,
  OidcClientConfig,
  // OidcError,
  // OidcErrorCode,
  OidcUser,
  OidcWebClient,
} from './types';
const jsLoggerRegistry = new Map<string, ReturnType<typeof createLogger>>();
const noopLogger = {
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
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
  const loggerConfig = config.logger && 'id' in config.logger ? null : config.logger;
  const jsLogger = loggerConfig ? createLogger(loggerConfig) : noopLogger;
  jsLogger.debug('OIDC createClient config', config);
  const loggerId =
    config.logger && 'id' in config.logger
      ? config.logger.id
      : loggerConfig
      ? configureLogger(loggerConfig)
      : undefined;
  const clientId = getNativeModule().createClient({
    ...config,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  if (loggerConfig) {
    jsLoggerRegistry.set(clientId, jsLogger);
  }
  jsLogger.info('OIDC createClient success', { clientId });
  return {
    id: clientId,
    token: () => {
      jsLogger.info('OIDC client token', { clientId });
      return getNativeModule().clientToken(clientId);
    },
    refresh: () => {
      jsLogger.info('OIDC client refresh', { clientId });
      return getNativeModule().clientRefresh(clientId);
    },
    userinfo: (cache?: boolean) => {
      jsLogger.info('OIDC client userinfo', { clientId, cache: cache ?? false });
      return getNativeModule().clientUserinfo(clientId, cache ?? false);
    },
    revoke: () => {
      jsLogger.info('OIDC client revoke', { clientId });
      return getNativeModule().clientRevoke(clientId);
    },
    endSession: () => {
      jsLogger.info('OIDC client endSession', { clientId });
      return getNativeModule().clientEndSession(clientId);
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
  const jsLogger = jsLoggerRegistry.get(client.id) ?? noopLogger;
  jsLogger.info('OIDC createWebClient', { clientId: client.id });
  const webClientId = getNativeModule().createWebClient(client.id);
  jsLogger.info('OIDC createWebClient success', { webClientId, clientId: client.id });

  const user: OidcUser = {
    token: () => {
      jsLogger.info('OIDC user token', { webClientId });
      return getNativeModule().token(webClientId);
    },
    refresh: () => {
      jsLogger.info('OIDC user refresh', { webClientId });
      return getNativeModule().refresh(webClientId);
    },
    userinfo: (cache?: boolean) => {
      jsLogger.info('OIDC user userinfo', { webClientId, cache: cache ?? false });
      return getNativeModule().userinfo(webClientId, cache ?? false);
    },
    revoke: () => {
      jsLogger.info('OIDC user revoke', { webClientId });
      return getNativeModule().revoke(webClientId);
    },
    logout: () => {
      jsLogger.info('OIDC user logout', { webClientId });
      return getNativeModule().logout(webClientId);
    },
  };

  return {
    id: webClientId,
    authorize: (options?: OidcAuthorizeOptions): Promise<OidcAuthorizeResult> => {
      jsLogger.info('OIDC authorize', { webClientId, options: options ?? {} });
      return getNativeModule().authorize(webClientId, options ?? {});
    },
    hasUser: () => {
      jsLogger.info('OIDC hasUser', { webClientId });
      return getNativeModule().hasUser(webClientId);
    },
    user: async () => {
      jsLogger.debug('OIDC user resolve', { webClientId });
      const hasUser = await getNativeModule().hasUser(webClientId);
      return hasUser ? user : null;
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
