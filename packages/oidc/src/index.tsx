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

/**
 * Create a native-backed OIDC client.
 */
export function createOidcClient(config: OidcClientConfig): OidcClient {
  const clientId = getNativeModule().createClient(config);
  return { id: clientId };
}

/**
 * Create a web-capable OIDC client from an existing OIDC client handle.
 */
export function createOidcWebClient(client: OidcClient): OidcWebClient {
  const webClientId = getNativeModule().createWebClient(client.id);

  const user: OidcUser = {
    token: () => getNativeModule().token(webClientId),
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
  OidcUser,
  OidcWebClient,
} from './types';
