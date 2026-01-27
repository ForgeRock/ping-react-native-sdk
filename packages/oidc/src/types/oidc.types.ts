/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError, Tokens } from '@ping-identity/rn-types';
import type { StorageConfig } from '@react-native-pingidentity/storage';

/**
 * Configuration for creating a native-backed OIDC client.
 *
 * @remarks
 * Values are serialized across the React Native bridge and must remain
 * platform-agnostic.
 */
export type OidcClientConfig = {
  /**
   * Client identifier registered with the OIDC provider.
   */
  clientId: string;

  /**
   * Discovery endpoint for the OIDC provider.
   */
  discoveryEndpoint: string;

  /**
   * Redirect URI for authorization responses.
   */
  redirectUri: string;

  /**
   * OIDC scopes to request (e.g. `openid`, `profile`).
   */
  scopes: string[];

  /**
   * Optional storage configuration created by the storage module.
   *
   * @remarks
   * Pass the object returned by `configureOidcStorage`. The native layer uses
   * the embedded `id` to resolve the registered storage configuration.
   */
  storage?: StorageConfig;

  /**
   * Optional authentication context class reference values.
   */
  acrValues?: string;

  /**
   * Optional login hint for the authorization request.
   */
  loginHint?: string;

  /**
   * Optional display parameter for the authorization request.
   */
  display?: string;

  /**
   * Optional prompt parameter for the authorization request.
   */
  prompt?: string;

  /**
   * Additional provider-specific parameters.
   */
  additionalParameters?: Record<string, string>;
};

/**
 * Optional overrides when launching an authorization request.
 */
export type OidcAuthorizeOptions = {
  acrValues?: string;
  loginHint?: string;
  display?: string;
  prompt?: string;
  additionalParameters?: Record<string, string>;
};

/**
 * Result of an authorization attempt.
 */
export type OidcAuthorizeResult =
  | {
      type: 'success';
    }
  | {
      type: 'cancel';
    };

/**
 * Error payload returned when OIDC operations fail.
 *
 * Matches the shared native/JS error contract defined in @ping-identity/rn-types.
 */
export type OidcError = GenericError;

/**
 * Stable error codes emitted by the OIDC module.
 *
 * @remarks
 * Keep these in sync with the native error constants.
 */
export type OidcErrorCode =
  | 'OIDC_AUTHORIZE_ERROR'
  | 'OIDC_HAS_USER_ERROR'
  | 'OIDC_TOKEN_ERROR'
  | 'OIDC_REVOKE_ERROR'
  | 'OIDC_LOGOUT_ERROR';

/**
 * Native-backed OIDC client handle.
 */
export type OidcClient = {
  /**
   * Internal native identifier for the client.
   */
  id: string;
};

/**
 * Authenticated user handle scoped to an OIDC web client.
 */
export type OidcUser = {
  /**
   * Retrieve the current token bundle.
   */
  token(): Promise<Tokens>;

  /**
   * Revoke the current token bundle.
   */
  revoke(): Promise<void>;

  /**
   * Logout the current user session.
   */
  logout(): Promise<void>;
};

/**
 * Web-capable OIDC client handle.
 */
export type OidcWebClient = {
  /**
   * Internal native identifier for the web client.
   */
  id: string;

  /**
   * Launch the authorization flow.
   */
  authorize(options?: OidcAuthorizeOptions): Promise<OidcAuthorizeResult>;

  /**
   * Check if a user is available for the current web client.
   */
  hasUser(): Promise<boolean>;

  /**
   * Resolve the current user handle, if present.
   */
  user(): Promise<OidcUser | null>;
};
