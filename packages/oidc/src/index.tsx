/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { configureLogger } from '@react-native-pingidentity/logger';
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

/**
 * Create a native-backed OIDC client.
 *
 * @remarks
 * If you configured storage with `configureOidcStorage`, pass the returned
 * configuration in `config.storage` to bind the native token storage.
 */
export function createOidcClient(config: OidcClientConfig): OidcClient {
  if (!config.discoveryEndpoint && !config.openId) {
    throw new Error(
      '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.'
    );
  }
  const loggerId =
    config.logger && 'id' in config.logger
      ? config.logger.id
      : config.logger
      ? configureLogger(config.logger)
      : undefined;
  const clientId = getNativeModule().createClient({
    ...config,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  return {
    id: clientId,
    token: () => getNativeModule().clientToken(clientId),
    refresh: () => getNativeModule().clientRefresh(clientId),
    userinfo: (cache?: boolean) => getNativeModule().clientUserinfo(clientId, cache ?? false),
    revoke: () => getNativeModule().clientRevoke(clientId),
    endSession: () => getNativeModule().clientEndSession(clientId),
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
 */
export function createOidcWebClient(client: OidcClient): OidcWebClient {
  const webClientId = getNativeModule().createWebClient(client.id);

  const user: OidcUser = {
    token: () => getNativeModule().token(webClientId),
    refresh: () => getNativeModule().refresh(webClientId),
    userinfo: (cache?: boolean) => getNativeModule().userinfo(webClientId, cache ?? false),
    revoke: () => getNativeModule().revoke(webClientId),
    logout: () => getNativeModule().logout(webClientId),
  };

  return {
    id: webClientId,
    authorize: (options?: OidcAuthorizeOptions): Promise<OidcAuthorizeResult> =>
      getNativeModule().authorize(webClientId, options ?? {}),
    hasUser: () => getNativeModule().hasUser(webClientId),
    user: async () => {
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
