/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  LoggerInstance,
  OidcCoreConfig,
  OidcStorageHandle,
} from '@ping-identity/rn-types';

/**
 * OIDC module configuration nested under {@link DaVinciModules}.
 *
 * @remarks
 * Extends {@link OidcCoreConfig} from `@ping-identity/rn-types` with DaVinci-specific
 * overrides: `discoveryEndpoint` is required (DaVinci does not support manual
 * endpoint override via `openId`), and `scopes` is optional (defaults to
 * `['openid', 'profile']` when omitted).
 *
 * Native SDK source of truth: `OidcClientConfig` on both Android and iOS.
 *
 * @remarks
 * `signOutRedirectUri` maps to `OidcClientConfig.signOutRedirectUri` on Android.
 * Not available on iOS `OidcClientConfig` in 2.0.1 — silently ignored on iOS
 * until the iOS SDK exposes it.
 *
 * @public
 */
export type DaVinciOidcModuleConfig = Omit<
  OidcCoreConfig,
  'discoveryEndpoint' | 'scopes' | 'openId'
> & {
  /**
   * OIDC discovery endpoint URL.
   *
   * @remarks
   * Required for DaVinci — manual endpoint override via `openId` is not
   * supported. Usually the `.well-known/openid-configuration` base URL of
   * your PingOne tenant.
   */
  discoveryEndpoint: string;

  /**
   * OAuth2 scopes to request.
   *
   * @remarks
   * Defaults to `['openid', 'profile']` when omitted.
   */
  scopes?: string[];

  /**
   * Optional OIDC token storage handle created by the storage module.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-storage` (`configureOidcStorage()`).
   */
  storage?: OidcStorageHandle;
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
