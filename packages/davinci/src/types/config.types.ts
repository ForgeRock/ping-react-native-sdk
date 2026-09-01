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
