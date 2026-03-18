/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  LoggerInstance,
  NativeLoggerHandle,
  OidcStorageHandle,
  OidcCoreConfig,
  OidcOpenIdConfiguration,
  SessionStorageHandle,
} from '@ping-identity/rn-types';
import type { JourneyCallbackType } from './node.types';

/**
 * Journey configuration and callback-submit payload type contracts.
 */

/**
 * Optional OpenID endpoint override for Journey OIDC composition.
 */
export type JourneyOidcOpenIdConfiguration = OidcOpenIdConfiguration;

/**
 * Journey OIDC module configuration.
 *
 * @remarks
 * Extends the shared OIDC core shape with Journey-supported RN handles.
 */
export type JourneyOidcModuleConfig = OidcCoreConfig & {
  /**
   * Optional OIDC token storage handle created by the storage module.
   */
  storage?: OidcStorageHandle;
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   */
  logger?: LoggerInstance;
  /**
   * Optional native logger handle.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`configureLogger(...)`).
   */
  nativeLogger?: NativeLoggerHandle;
};

/**
 * Optional Journey module integrations.
 */
export type JourneyModules = {
  /**
   * Session module configuration.
   */
  session?: {
    /**
     * Session storage handle created by the storage module.
     *
     * @remarks
     * Applied natively on both Android and iOS.
     */
    storage?: SessionStorageHandle;
  };
  /**
   * OIDC module composition.
   */
  oidc?: JourneyOidcModuleConfig;
};

/**
 * Journey client configuration.
 */
export type JourneyConfig = {
  /**
   * Base AM/Ping server URL.
   */
  serverUrl: string;
  /**
   * Optional Journey realm.
   */
  realm?: string;
  /**
   * Optional Journey cookie name override.
   */
  cookie?: string;
  /**
   * Optional network timeout in milliseconds.
   */
  timeout?: number;
  /**
   * Optional Journey logger used by the native workflow.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   */
  logger?: LoggerInstance;
  /**
   * Optional Journey module integrations.
   */
  modules?: JourneyModules;
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyStartOptions = {
  /**
   * Force authentication even if an SSO session exists.
   */
  forceAuth?: boolean;
  /**
   * Ignore existing session state and start a fresh flow.
   */
  noSession?: boolean;
};

/**
 * Callback input value submitted to `next()`.
 */
export type JourneyCallbackInputValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | Array<unknown>;

/**
 * Callback mutation entry submitted to `next()`.
 */
export type JourneyCallbackInput = {
  /** Callback type to mutate. */
  type: JourneyCallbackType;
  /** Callback value to apply. */
  value?: JourneyCallbackInputValue;
  /**
   * Optional zero-based index when multiple callbacks share the same `type`.
   */
  index?: number;
};

/**
 * Payload for advancing a Journey node.
 */
export type JourneyNextInput = {
  /**
   * Callback mutations to apply before calling native `next()`.
   */
  callbacks?: JourneyCallbackInput[];
};
