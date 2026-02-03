/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError, Tokens } from '@ping-identity/rn-types';
import type { IOSBrowserOpenOptions } from '@react-native-pingidentity/browser';
import type {
  LoggerInstance,
  NativeLoggerHandle,
} from '@react-native-pingidentity/logger';
import type { StorageConfig } from '@react-native-pingidentity/storage';

/**
 * Configuration for creating a native-backed OIDC client.
 *
 * @remarks
 * Values are serialized across the React Native bridge and must remain
 * platform-agnostic.
 *
 * @example
 * Basic configuration:
 * ```ts
 * const client = createOidcClient({
 *   clientId: 'client-id',
 *   discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
 *   redirectUri: 'com.example.app://callback',
 *   scopes: ['openid', 'email', 'profile'],
 * });
 * ```
 *
 * @example
 * With OpenID override and logger:
 * ```ts
 * const log = logger({ level: 'debug' });
 * const client = createOidcClient({
 *   clientId: 'client-id',
 *   redirectUri: 'com.example.app://callback',
 *   scopes: ['openid'],
 *   openId: {
 *     authorizationEndpoint: 'https://issuer/authorize',
 *     tokenEndpoint: 'https://issuer/token',
 *     userinfoEndpoint: 'https://issuer/userinfo',
 *   },
 *   logger: log,
 * });
 * ```
 */
export type OidcClientConfig = {
  /**
   * Client identifier registered with the OIDC provider.
   */
  clientId: string;

  /**
   * Discovery endpoint for the OIDC provider.
   *
   * @remarks
   * Required unless `openId` is provided.
   */
  discoveryEndpoint?: string;

  /**
   * Optional OpenID configuration override.
   *
   * @remarks
   * When provided, the native layer skips discovery and uses these endpoints directly.
   */
  openId?: OidcOpenIdConfiguration;

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
   * iOS-only browser configuration for OIDC web login.
   *
   * @remarks
   * Mirrors Ping iOS SDK `OidcWebConfig` settings. Ignored on Android.
   */
  ios?: IOSBrowserOpenOptions;

  /**
   * Optional authentication context class reference values.
   */
  acrValues?: string;

  /**
   * Optional sign-out redirect URI for end-session flows.
   */
  signOutRedirectUri?: string;

  /**
   * Optional state parameter for the authorization request.
   */
  state?: string;

  /**
   * Optional nonce parameter for the authorization request.
   */
  nonce?: string;

  /**
   * Optional UI locales parameter for the authorization request.
   */
  uiLocales?: string;

  /**
   * Optional token refresh threshold in seconds.
   */
  refreshThreshold?: number;

  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Provide a logger created with `logger()` to control JS log output.
   */
  logger?: LoggerInstance;

  /**
   * Optional native logger handle.
   *
   * @remarks
   * Pass the handle returned by `configureLogger()` to reuse a native logger.
   */
  nativeLogger?: NativeLoggerHandle;

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
 * OpenID configuration override for native clients.
 */
export type OidcOpenIdConfiguration = {
  /**
   * Authorization endpoint URL.
   */
  authorizationEndpoint: string;
  /**
   * Token endpoint URL.
   */
  tokenEndpoint: string;
  /**
   * Userinfo endpoint URL.
   */
  userinfoEndpoint: string;
  /**
   * End-session endpoint URL.
   */
  endSessionEndpoint?: string;
  /**
   * Ping end-session endpoint URL (ID token only).
   */
  pingEndIdpSessionEndpoint?: string;
  /**
   * Token revocation endpoint URL.
   */
  revocationEndpoint?: string;
};

/**
 * Optional overrides when launching an authorization request.
 */
export type OidcAuthorizeOptions = {
  /**
   * Optional ACR values override for this authorization request.
   */
  acrValues?: string;
  /**
   * Optional state override for this authorization request.
   */
  state?: string;
  /**
   * Optional nonce override for this authorization request.
   */
  nonce?: string;
  /**
   * Optional UI locales override for this authorization request.
   */
  uiLocales?: string;
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
  | 'OIDC_REFRESH_ERROR'
  | 'OIDC_USERINFO_ERROR'
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

  /**
   * Retrieve the current token bundle.
   */
  token(): Promise<Omit<Tokens, 'tokenExpiry'>>;

  /**
   * Force-refresh the token bundle.
   */
  refresh(): Promise<Omit<Tokens, 'tokenExpiry'>>;

  /**
   * Fetch user profile data from the userinfo endpoint.
   *
   * @param cache When true, reuse cached userinfo if available.
   */
  userinfo(cache?: boolean): Promise<Record<string, unknown>>;

  /**
   * Revoke the current token bundle.
   */
  revoke(): Promise<void>;

  /**
   * End the current user session.
   *
   * @returns Whether the end-session flow completed successfully.
   */
  endSession(): Promise<boolean>;
};

/**
 * Authenticated user handle scoped to an OIDC web client.
 */
export type OidcUser = {
  /**
   * Retrieve the current token bundle.
   */
  token(): Promise<Omit<Tokens, 'tokenExpiry'>>;

  /**
   * Force-refresh the token bundle.
   */
  refresh(): Promise<Omit<Tokens, 'tokenExpiry'>>;

  /**
   * Fetch user profile data from the userinfo endpoint.
   *
   * @param cache When true, reuse cached userinfo if available.
   */
  userinfo(cache?: boolean): Promise<Record<string, unknown>>;

  /**
   * Revoke the current token bundle.
   */
  revoke(): Promise<void>;

  /**
   * Logout the current user session.
   *
   * @remarks
   * Mirrors native OidcUser.logout() which does not return a value.
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
   *
   * @example
   * ```ts
   * const web = createOidcWebClient(client);
   * const result = await web.authorize({
   *   prompt: 'login',
   *   loginHint: 'user@example.com',
   * });
   * if (result.type === 'success') {
   *   // authorized
   * }
   * ```
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
