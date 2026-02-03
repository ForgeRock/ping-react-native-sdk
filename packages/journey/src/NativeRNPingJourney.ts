/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';

type Node = {
  id: string;
  type: 'ContinueNode' | 'ErrorNode' | 'FailureNode' | 'SuccessNode';
  message?: string;
  cause?: string;
  session?: Object;
  callbacks?: Array<{
    type: string;
    prompt?: string;
    value?: Object;
  }>;
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyOptions = {
  forceAuth?: boolean;
  noSession?: boolean;
};

export interface Spec extends TurboModule {
  /**
   * Configure the Journey SDK.
   */
  configureJourney(config: Object): Promise<string>;

  /**
   * Start a Journey by name.
   */
  start(journeyId: string, journeyName: string, options?: JourneyOptions): Promise<Node>;

  /**
   * Advance to the next node.
   */
  next(journeyId: string, nodeId: string, input: Object): Promise<Node>;

  /**
   * Resume a suspended Journey (e.g., magic link).
   */
  resume(journeyId: string, uri: string): Promise<Node>;

  /**
   * Get an existing session if available.
   */
  getSession(journeyId: string): Promise<Object | null>;

  /**
   * Logout and clear session.
   */
  logout(journeyId: string): Promise<boolean>;

  /**
   * POC only TM to show registered Storages from core
   * Return list of storage IDs 
   * */
  listRegisteredStoragesFromCore(): Promise<string[]>;
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
 * @throws When no matching native module can be found.
 */
export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingJourney');
    } catch (error) {
      console.warn(
        'Journey TurboModule not registered; falling back to classic implementation.',
        String(error)
      );
    }
  }

  const classic = NativeModules.RNPingJourney;
  if (!classic) {
    const available = Object.keys(NativeModules).slice(0, 10);
    const message =
      'Native RNPingJourney module not found at runtime.\n' +
      'Available NativeModules: ' +
      JSON.stringify(available);
    throw new Error(message);
  }

  return classic as Spec;
}

export default getNativeModule();
