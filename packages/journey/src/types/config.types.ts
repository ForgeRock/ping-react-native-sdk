/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { LoggerInstance, NativeLoggerHandle } from '@react-native-pingidentity/logger';
import type { SessionStorage } from '@react-native-pingidentity/storage';
import type { JourneyCallbackType } from './node.types';

/**
 * Journey configuration and callback-submit payload type contracts.
 */

/**
 * Optional OpenID endpoint override for Journey OIDC composition.
 */
export type JourneyOidcOpenIdConfiguration = {
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
   * Optional end-session endpoint URL.
   */
  endSessionEndpoint?: string;
  /**
   * Optional Ping end-session endpoint URL.
   */
  pingEndIdpSessionEndpoint?: string;
  /**
   * Optional revocation endpoint URL.
   */
  revocationEndpoint?: string;
};

/**
 * Journey client base configuration.
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
   * Optional OIDC client identifier for Journey+OIDC composition.
   */
  clientId?: string;
  /**
   * Optional OIDC discovery endpoint.
   */
  discoveryEndpoint?: string;
  /**
   * Optional OIDC redirect URI.
   */
  redirectUri?: string;
  /**
   * Optional OIDC scopes for post-auth token flows.
   */
  scopes?: string[];
  /**
   * Optional OpenID endpoint override.
   */
  openId?: JourneyOidcOpenIdConfiguration;
  /**
   * Optional ACR values.
   */
  acrValues?: string;
  /**
   * Optional sign-out redirect URI.
   */
  signOutRedirectUri?: string;
  /**
   * Optional state parameter.
   */
  state?: string;
  /**
   * Optional nonce parameter.
   */
  nonce?: string;
  /**
   * Optional UI locales parameter.
   */
  uiLocales?: string;
  /**
   * Optional token refresh threshold in seconds.
   */
  refreshThreshold?: number;
  /**
   * Optional login hint.
   */
  loginHint?: string;
  /**
   * Optional display parameter.
   */
  display?: string;
  /**
   * Optional prompt parameter.
   */
  prompt?: string;
  /**
   * Optional provider-specific parameters.
   */
  additionalParameters?: Record<string, string>;
  /**
   * Optional shorthand OIDC client handle.
   *
   * @remarks
   * Equivalent to `modules.oidc.client` when calling `journey(config, modules?)`.
   */
  oidcClient?: JourneyOidcClientHandle;
  /**
   * Optional JavaScript logger instance.
   */
  logger?: LoggerInstance;
  /**
   * Optional native logger handle.
   */
  nativeLogger?: NativeLoggerHandle;
};

/**
 * OIDC client handle accepted by Journey module composition.
 *
 * @remarks
 * Pass the object returned by `createOidcClient(...)` from
 * `@ping-identity/rn-oidc`.
 */
export type JourneyOidcClientHandle = {
  /**
   * Native OIDC client identifier.
   */
  id: string;
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
     */
    storage?: SessionStorage;
  };
  /**
   * OIDC module composition.
   */
  oidc?: {
    /**
     * Native-backed OIDC client handle created by `@ping-identity/rn-oidc`.
     */
    client?: JourneyOidcClientHandle;
  };
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
