/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  LoggerInstance,
  OidcStorageHandle,
} from '@ping-identity/rn-types';

/**
 * OIDC module configuration nested under {@link DaVinciModules}.
 *
 * @remarks
 * Contains the required OIDC identity fields and all optional OIDC
 * authorization request parameters. Native SDK source of truth:
 * `OidcClientConfig` on both Android and iOS.
 *
 * @public
 */
export type DaVinciOidcModuleConfig = {
  // ---------------------------------------------------------------------------
  // Required OIDC identity fields (OidcClientConfig)
  // ---------------------------------------------------------------------------

  /**
   * OIDC discovery endpoint URL.
   *
   * @remarks
   * Maps to `OidcClientConfig.discoveryEndpoint` on both platforms.
   * Usually the `.well-known/openid-configuration` base URL of your PingOne tenant.
   */
  discoveryEndpoint: string;

  /**
   * OAuth2 client identifier registered with the OIDC provider.
   *
   * @remarks
   * Maps to `OidcClientConfig.clientId` on both platforms.
   */
  clientId: string;

  /**
   * OAuth2 redirect URI registered for this client.
   *
   * @remarks
   * Maps to `OidcClientConfig.redirectUri` on both platforms.
   */
  redirectUri: string;

  // ---------------------------------------------------------------------------
  // Optional OIDC fields (OidcClientConfig)
  // ---------------------------------------------------------------------------

  /**
   * OAuth2 scopes to request.
   *
   * @remarks
   * Maps to `OidcClientConfig.scopes`. Defaults to `['openid', 'profile']` when omitted.
   */
  scopes?: string[];

  /**
   * Optional OIDC token storage handle created by the storage module.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-storage` (`configureOidcStorage()`).
   */
  storage?: OidcStorageHandle;

  /**
   * Sign-out redirect URI used for end-session flows.
   *
   * @remarks
   * Maps to `OidcClientConfig.signOutRedirectUri` on Android.
   * Not available on iOS `OidcClientConfig` in 2.0.1 — silently ignored on iOS
   * until the iOS SDK exposes it.
   */
  signOutRedirectUri?: string;

  /**
   * Optional login hint forwarded to the authorization endpoint.
   *
   * @remarks
   * Maps to `OidcClientConfig.loginHint` on both platforms.
   */
  loginHint?: string;

  /**
   * Optional nonce parameter for the authorization request.
   *
   * @remarks
   * Maps to `OidcClientConfig.nonce` on both platforms.
   */
  nonce?: string;

  /**
   * Optional state parameter for the authorization request.
   *
   * @remarks
   * Maps to `OidcClientConfig.state` on both platforms.
   */
  state?: string;

  /**
   * Optional prompt parameter for the authorization request.
   *
   * @remarks
   * Maps to `OidcClientConfig.prompt` on both platforms.
   * Typical values: `'login'`, `'consent'`, `'none'`, `'select_account'`.
   */
  prompt?: string;

  /**
   * Optional display parameter for the authorization request.
   *
   * @remarks
   * Maps to `OidcClientConfig.display` on both platforms.
   * Typical values: `'page'`, `'popup'`, `'touch'`, `'wap'`.
   */
  display?: string;

  /**
   * Optional space-separated list of end-user preferred UI locales.
   *
   * @remarks
   * Maps to `OidcClientConfig.uiLocales` on both platforms.
   */
  uiLocales?: string;

  /**
   * Optional authentication context class reference values.
   *
   * @remarks
   * Maps to `OidcClientConfig.acrValues` on both platforms.
   */
  acrValues?: string;

  /**
   * Optional token refresh threshold in seconds.
   *
   * @remarks
   * Maps to `OidcClientConfig.refreshThreshold` on both platforms.
   * When the remaining token lifetime falls below this value, the SDK
   * proactively refreshes the token on the next `user()` call.
   */
  refreshThreshold?: number;

  /**
   * Additional provider-specific authorization request parameters.
   *
   * @remarks
   * Maps to `OidcClientConfig.additionalParameters` on both platforms.
   */
  additionalParameters?: Record<string, string>;
};

/**
 * DaVinci module integrations.
 *
 * @public
 */
export type DaVinciModules = {
  /**
   * OIDC module configuration — required OIDC identity fields, optional request
   * parameters, and optional custom token storage.
   */
  oidc: DaVinciOidcModuleConfig;
};

/**
 * DaVinci client configuration.
 *
 * @remarks
 * All OIDC fields (required and optional) live under `modules.oidc`.
 * Only transport and logging options belong at the top level, as they map to
 * `WorkflowConfig` rather than `OidcClientConfig`.
 *
 * @example
 * ```ts
 * const client = createDaVinciClient({
 *   modules: {
 *     oidc: {
 *       discoveryEndpoint: 'https://auth.example.com/.well-known/openid-configuration',
 *       clientId: 'my-client-id',
 *       redirectUri: 'myapp://callback',
 *       scopes: ['openid', 'profile'],
 *     },
 *   },
 * });
 * ```
 *
 * @example
 * With logger and custom storage:
 * ```ts
 * import { logger } from '@ping-identity/rn-logger';
 * import { configureOidcStorage } from '@ping-identity/rn-storage';
 *
 * const client = createDaVinciClient({
 *   timeout: 20000,
 *   logger: logger({ level: 'debug' }),
 *   modules: {
 *     oidc: {
 *       discoveryEndpoint: 'https://auth.example.com/.well-known/openid-configuration',
 *       clientId: 'my-client-id',
 *       redirectUri: 'myapp://callback',
 *       storage: configureOidcStorage({ android: { keyAlias: 'davinci_key' } }),
 *     },
 *   },
 * });
 * ```
 *
 * @public
 */
export type DaVinciConfig = {
  /**
   * Network timeout in milliseconds.
   *
   * @remarks
   * Maps to `WorkflowConfig.timeout` on both platforms (iOS stores it as seconds
   * internally; the bridge converts). Defaults to 15 000 ms when omitted.
   */
  timeout?: number;

  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   * Maps to `WorkflowConfig.logger` on both platforms.
   */
  logger?: LoggerInstance;

  /**
   * DaVinci module integrations, including required OIDC configuration.
   */
  modules: DaVinciModules;
};

/**
 * Key-indexed collector value submitted to {@link DaVinciClient.next}.
 *
 * @public
 */
export type DaVinciCollectorInput = {
  /** Collector key from the active {@link ContinueNode}. */
  key: string;
  /** Value to apply to the collector. */
  value: unknown;
};

/**
 * Payload for advancing a DaVinci flow node.
 *
 * @public
 */
export type DaVinciNextInput = {
  /** Collector key-value pairs to apply before calling native `next()`. */
  collectors: DaVinciCollectorInput[];
};
