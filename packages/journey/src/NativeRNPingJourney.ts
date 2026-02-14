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
  type: string;
  prompt?: string;
  message?: string;
  value?: unknown;
  [key: string]: unknown;
};

/**
 * Native Journey node payload returned by Journey bridge.
 */
type NativeJourneyNode = {
  type: 'ContinueNode' | 'ErrorNode' | 'FailureNode' | 'SuccessNode';
  message?: string;
  cause?: string;
  input?: Object;
  callbacks?: NativeJourneyCallback[];
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyOptions = {
  forceAuth?: boolean;
  noSession?: boolean;
};

/**
 * Native callback input payload submitted to `next()`.
 */
export type NativeJourneyNextInput = {
  callbacks?: Array<{
    type: string;
    value?: unknown;
    index?: number;
  }>;
};

/**
 * Native Journey client configuration payload.
 */
export type NativeJourneyConfig = {
  serverUrl: string;
  realm?: string;
  cookie?: string;
  clientId?: string;
  discoveryEndpoint?: string;
  redirectUri?: string;
  scopes?: string[];
  sessionStorageId?: string;
  loggerId?: string;
};

/**
 * Native module contract for Journey operations.
 */
export interface Spec extends TurboModule {
  /**
   * Configure the Journey SDK.
   */
  configureJourney(config: NativeJourneyConfig): Promise<string>;

  /**
   * Start a Journey by name.
   */
  start(journeyId: string, journeyName: string, options?: JourneyOptions): Promise<NativeJourneyNode>;

  /**
   * Advance to the next Journey node.
   */
  next(journeyId: string, nodeId: string, input: NativeJourneyNextInput): Promise<NativeJourneyNode>;

  /**
   * Resume a suspended Journey flow.
   */
  resume(journeyId: string, uri: string): Promise<NativeJourneyNode>;

  /**
   * Resolve session details.
   */
  getSession(journeyId: string): Promise<Object | null>;

  /**
   * Logout active Journey session.
   */
  logout(journeyId: string): Promise<boolean>;

  /**
   * Dispose native Journey instance and release associated state.
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
