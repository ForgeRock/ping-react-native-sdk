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
 * Protect lifecycle module configuration nested under {@link DaVinciModules}.
 *
 * @remarks
 * When present, the native DaVinci workflow registers the `ProtectLifecycleModule`
 * at creation time. This wires behavioral-data initialization, pause-on-success,
 * and resume-on-start hooks directly into the workflow lifecycle — no manual
 * `protect.start()` / `protect.pauseBehavioralData()` calls are needed.
 *
 * Requires `@ping-identity/rn-protect` to be installed. If the package is absent
 * at runtime the lifecycle module is silently skipped and collection does not run.
 *
 * @public
 */
// Intentionally mirrors ProtectConfig from @ping-identity/rn-protect field-for-field.
// Kept as a separate declaration to avoid a hard davinci → protect dependency (protect is optional).
export type DaVinciProtectModuleConfig = {
  /**
   * Optional JavaScript logger instance for Protect operations.
   *
   * @remarks
   * When provided, native `collectProtect` calls resolve this logger for
   * operation-level logging. Falls back to the top-level DaVinci logger when absent.
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   */
  logger?: LoggerInstance;

  /**
   * PingOne environment ID used by the Protect SDK.
   *
   * @remarks
   * Maps to `ProtectConfig.envId` on both platforms.
   */
  envId?: string;

  /**
   * Whether to enable behavioral data collection.
   *
   * @remarks
   * Maps to `ProtectConfig.isBehavioralDataCollection`. Defaults to `true`.
   */
  isBehavioralDataCollection?: boolean;

  /**
   * Whether to use lazy metadata loading.
   *
   * @remarks
   * Maps to `ProtectConfig.isLazyMetadata`. Defaults to `false`.
   */
  isLazyMetadata?: boolean;

  /**
   * Custom host URL for the Protect SDK signals endpoint.
   *
   * @remarks
   * Maps to `ProtectConfig.customHost` on both platforms.
   */
  customHost?: string;

  /**
   * Whether to enable console logging inside the Protect SDK.
   *
   * @remarks
   * Maps to `ProtectConfig.isConsoleLogEnabled`. Defaults to `false`.
   */
  isConsoleLogEnabled?: boolean;

  /**
   * Device attributes to exclude from signal collection.
   *
   * @remarks
   * Maps to `ProtectConfig.deviceAttributesToIgnore` on both platforms.
   */
  deviceAttributesToIgnore?: string[];

  /**
   * Whether to pause behavioral data collection after a successful flow.
   *
   * @remarks
   * Maps to `ProtectLifecycleConfig.pauseBehavioralDataOnSuccess`. Defaults to `false`.
   */
  pauseBehavioralDataOnSuccess?: boolean;

  /**
   * Whether to resume behavioral data collection when the flow starts.
   *
   * @remarks
   * Maps to `ProtectLifecycleConfig.resumeBehavioralDataOnStart`. Defaults to `false`.
   */
  resumeBehavioralDataOnStart?: boolean;
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

  /**
   * Optional Protect lifecycle module configuration.
   *
   * @remarks
   * When provided, wires the native `ProtectLifecycleModule` into the DaVinci
   * workflow at creation time. Requires `@ping-identity/rn-protect` to be installed.
   */
  protect?: DaVinciProtectModuleConfig;
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
 * Payload for advancing a DaVinci flow node.
 *
 * @public
 */
export type DaVinciNextInput = {
  /** Collector key-value pairs to apply before calling native `next()`. */
  collectors: DaVinciCollectorInput[];
};
