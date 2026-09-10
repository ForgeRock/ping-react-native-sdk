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
 * Uses the shared OIDC contract for the fields supported by DaVinci. The
 * discovery endpoint is required because DaVinci's current native OIDC path
 * requires it. `scopes` is optional because the native `OidcClientConfig`
 * property DaVinci's factory sets it through defaults to an empty scope set
 * on both platforms. `openId` is intentionally omitted because DaVinci's
 * native OIDC path does not expose endpoint overrides.
 *
 * @public
 */
export type DaVinciOidcModuleConfig = Omit<
  OidcCoreConfig,
  'discoveryEndpoint' | 'openId' | 'scopes'
> & {
  /** OIDC discovery endpoint URL required by DaVinci's native OIDC path. */
  discoveryEndpoint: string;
  /**
   * OAuth2 scopes to request.
   *
   * @remarks
   * Optional. The native `OidcClientConfig.scopes` property defaults to an
   * empty scope set on both platforms when omitted.
   */
  scopes?: string[];
  /** Optional OIDC token storage handle created by the storage module. */
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
 *       scopes: ['openid', 'profile'],
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
 * Optional flags when starting a DaVinci flow.
 *
 * @public
 */
export type DaVinciStartOptions = {
  /**
   * RFC 8628 `verification_uri_complete` URL from a device authorization
   * response. Set this when the current device is acting as the approving
   * device: the DaVinci flow extracts the `user_code` from this URL and
   * approves the requesting device.
   *
   * @remarks Requires native SDK 2.1.0 or later on both platforms.
   */
  verificationUri?: string;
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
