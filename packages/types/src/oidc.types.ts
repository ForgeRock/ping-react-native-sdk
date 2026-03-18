/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * OpenID endpoint override configuration shared across React Native modules.
 *
 * @remarks
 * This shape is intentionally runtime-serializable and module-agnostic.
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
 * iOS-only browser options shared by Browser and OIDC modules.
 *
 * @remarks
 * These values map to native iOS browser session configuration.
 */
export type IOSBrowserOpenOptions = {
  /**
   * Browser type for iOS.
   */
  browserType?: 'authSession' | 'ephemeralAuthSession' | 'nativeBrowserApp' | 'sfViewController';

  /**
   * Browser mode (reserved; currently informational).
   */
  browserMode?: 'login' | 'logout' | 'custom';
};

/**
 * Base OIDC client configuration shared across React Native modules.
 *
 * @remarks
 * Keep this type free of package-specific concerns (for example, native
 * logger handles, storage handles, and platform-only browser options).
 */
export type OidcCoreConfig = {
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
   */
  openId?: OidcOpenIdConfiguration;
  /**
   * Redirect URI for authorization responses.
   */
  redirectUri: string;
  /**
   * OIDC scopes to request (for example, `openid`, `profile`).
   */
  scopes: string[];
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
