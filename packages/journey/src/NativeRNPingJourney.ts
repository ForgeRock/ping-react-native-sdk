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

const turboModuleProxy = (global as typeof globalThis & {
  __turboModuleProxy?: unknown;
}).__turboModuleProxy;

const isNewArchEnabled =
  typeof turboModuleProxy !== 'undefined' && turboModuleProxy != null;

/**
 * Resolves the native `<Spec>` implementation, preferring TurboModules when available.
 *
 * Falls back to the legacy `NativeModules` entry if the TurboModule is not registered or
 * New Architecture has been disabled.
 *
 * @returns Native module implementation for Journey APIs.
 * @throws Error when no matching native module can be found.
 */
export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingJourney');
    } catch (error) {
      // Fall back to classic module resolution at runtime.
      console.warn(
        'Journey TurboModule not registered; falling back to classic implementation.',
        String(error)
      );
    }
  }

  const classic = NativeModules.RNPingJourneyClassic;
  if (!classic) {
    const available = Object.keys(NativeModules).slice(0, 10);
    const message =
      '[@ping-identity/rn-journey] Native RNPingJourneyClassic module not found at runtime.\n' +
      'Available NativeModules: ' +
      JSON.stringify(available);
    throw new Error(message);
  }

  return classic as Spec;
}

export default getNativeModule();
