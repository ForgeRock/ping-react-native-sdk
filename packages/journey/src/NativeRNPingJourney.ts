/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Native callback payload returned by Journey bridge.
 */
type NativeJourneyCallback = {
  /** Native callback type discriminator. */
  type: string;
  /** Optional prompt text emitted by native callback mapping. */
  prompt?: string;
  /** Optional message text emitted by native callback mapping. */
  message?: string;
  /** Optional mapped callback value. */
  value?: unknown;
  /** Additional callback-specific fields mapped from native SDK callbacks. */
  [key: string]: unknown;
};

/**
 * Native Journey node payload returned by Journey bridge.
 */
type NativeJourneyNode = {
  /** Native node discriminator. */
  type: 'ContinueNode' | 'ErrorNode' | 'FailureNode' | 'SuccessNode';
  /** Optional node-level message. */
  message?: string;
  /** Optional failure cause string. */
  cause?: string;
  /** Optional node input payload for debug/inspection use-cases. */
  input?: Object;
  /** Callback collection for continue nodes. */
  callbacks?: NativeJourneyCallback[];
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyOptions = {
  /** Force authentication even when an SSO session exists. */
  forceAuth?: boolean;
  /** Ignore existing session and start a fresh flow. */
  noSession?: boolean;
};

/**
 * Native callback input payload submitted to `next()`.
 */
export type NativeJourneyNextInput = {
  /** Callback mutation list submitted before native `next()`. */
  callbacks?: Array<{
    /** Target callback type. */
    type: string;
    /** Value applied to the target callback. */
    value?: unknown;
    /** Optional zero-based per-type callback index. */
    index?: number;
  }>;
};

/**
 * Native Journey client configuration payload.
 */
export type NativeJourneyConfig = {
  /** Base AM/Ping server URL. */
  serverUrl: string;
  /** Optional network timeout in milliseconds. */
  timeout?: number;
  /** Optional AM realm path. */
  realm?: string;
  /** Optional cookie/session namespace override. */
  cookie?: string;
  /** Optional OIDC client id. */
  clientId?: string;
  /** Optional OIDC discovery endpoint URL. */
  discoveryEndpoint?: string;
  /** Optional OIDC redirect URI. */
  redirectUri?: string;
  /** Optional OIDC scopes. */
  scopes?: string[];
  /** Optional OpenID endpoint override. */
  openId?: {
    /** Authorization endpoint URL. */
    authorizationEndpoint: string;
    /** Token endpoint URL. */
    tokenEndpoint: string;
    /** Userinfo endpoint URL. */
    userinfoEndpoint: string;
    /** Optional end-session endpoint URL. */
    endSessionEndpoint?: string;
    /** Optional Ping end-session endpoint URL. */
    pingEndIdpSessionEndpoint?: string;
    /** Optional token revocation endpoint URL. */
    revocationEndpoint?: string;
  };
  /** Optional ACR values. */
  acrValues?: string;
  /** Optional sign-out redirect URI. */
  signOutRedirectUri?: string;
  /** Optional authorization state value. */
  state?: string;
  /** Optional authorization nonce value. */
  nonce?: string;
  /** Optional UI locales parameter. */
  uiLocales?: string;
  /** Optional token refresh threshold in seconds. */
  refreshThreshold?: number;
  /** Optional login hint parameter. */
  loginHint?: string;
  /** Optional display parameter. */
  display?: string;
  /** Optional prompt parameter. */
  prompt?: string;
  /** Optional provider-specific parameters. */
  additionalParameters?: Object;
  /** Optional storage handle id resolved by the native storage registry. */
  sessionStorageId?: string;
  /** Optional OIDC storage handle id resolved by the native storage registry. */
  oidcStorageId?: string;
  /** Optional logger handle id resolved by the native logger registry. */
  loggerId?: string;
  /** Optional OIDC client handle id resolved by the native OIDC client registry. */
  oidcClientId?: string;
};

/**
 * Native module contract for Journey operations.
 */
export interface Spec extends TurboModule {
  /**
   * Configure the Journey SDK.
   *
   * @param config Journey configuration payload.
   * @returns Native journey instance identifier.
   */
  configureJourney(config: NativeJourneyConfig): Promise<string>;

  /**
   * Start a Journey by name.
   *
   * @param journeyId Native journey instance identifier.
   * @param journeyName Journey/tree name configured on the server.
   * @param options Optional start flags.
   * @returns First native node payload.
   */
  start(journeyId: string, journeyName: string, options?: JourneyOptions): Promise<NativeJourneyNode>;

  /**
   * Advance to the next Journey node.
   *
   * @param journeyId Native journey instance identifier.
   * @param nodeId Legacy node id argument kept for bridge compatibility.
   * @param input Callback mutation payload.
   * @returns Next native node payload.
   */
  next(journeyId: string, nodeId: string, input: NativeJourneyNextInput): Promise<NativeJourneyNode>;

  /**
   * Resume a suspended Journey flow.
   *
   * @param journeyId Native journey instance identifier.
   * @param uri Resume URI from redirect/magic-link flow.
   * @returns Resumed native node payload.
   */
  resume(journeyId: string, uri: string): Promise<NativeJourneyNode>;

  /**
   * Resolve session details.
   *
   * @param journeyId Native journey instance identifier.
   * @returns Session payload or null.
   */
  getSession(journeyId: string): Promise<Object | null>;

  /**
   * Refresh active Journey user token set.
   *
   * @param journeyId Native journey instance identifier.
   * @returns Refreshed session payload or null.
   */
  refresh(journeyId: string): Promise<Object | null>;

  /**
   * Revoke active Journey user token set.
   *
   * @param journeyId Native journey instance identifier.
   * @returns True when revoke succeeds.
   */
  revoke(journeyId: string): Promise<boolean>;

  /**
   * Resolve active Journey userinfo payload.
   *
   * @param journeyId Native journey instance identifier.
   * @returns Userinfo payload or null.
   */
  userinfo(journeyId: string): Promise<Object | null>;

  /**
   * Resolve active Journey SSO token payload.
   *
   * @param journeyId Native journey instance identifier.
   * @returns SSO token payload or null.
   */
  ssoToken(journeyId: string): Promise<Object | null>;

  /**
   * Logout active Journey session.
   *
   * @param journeyId Native journey instance identifier.
   * @returns True when logout succeeds.
   */
  logout(journeyId: string): Promise<boolean>;

  /**
   * Dispose native Journey instance and release associated state.
   *
   * @param journeyId Native journey instance identifier.
   * @returns Promise resolved when disposal completes.
   */
  dispose(journeyId: string): Promise<void>;
}

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 *
 * @returns Native module implementation for Journey APIs.
 * @throws Error when no matching native module can be found.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingJourney');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingJourneyClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-journey] Native module RNPingJourney not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules))
  );
}

/**
 * Lazy native module wrapper.
 *
 * Resolves the native module at call time to avoid import-time failures while
 * the runtime is still bootstrapping native providers.
 */
const NativeRNPingJourney: Spec = {
  configureJourney(config) {
    return getNativeModule().configureJourney(config);
  },
  start(journeyId, journeyName, options) {
    return getNativeModule().start(journeyId, journeyName, options);
  },
  next(journeyId, nodeId, input) {
    return getNativeModule().next(journeyId, nodeId, input);
  },
  resume(journeyId, uri) {
    return getNativeModule().resume(journeyId, uri);
  },
  getSession(journeyId) {
    return getNativeModule().getSession(journeyId);
  },
  refresh(journeyId) {
    return getNativeModule().refresh(journeyId);
  },
  revoke(journeyId) {
    return getNativeModule().revoke(journeyId);
  },
  userinfo(journeyId) {
    return getNativeModule().userinfo(journeyId);
  },
  ssoToken(journeyId) {
    return getNativeModule().ssoToken(journeyId);
  },
  logout(journeyId) {
    return getNativeModule().logout(journeyId);
  },
  dispose(journeyId) {
    return getNativeModule().dispose(journeyId);
  },
};

export default NativeRNPingJourney;
