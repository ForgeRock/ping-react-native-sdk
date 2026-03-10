/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * JavaScript-level logger levels.
 * These are mapped to native logger levels internally.
 */
export type LoggerLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'none';

/**
 * Native logger levels supported by the underlying platform logger.
 */
export type NativeLoggerLevel =
  | 'STANDARD'
  | 'WARN'
  | 'NONE';

/**
 * Configuration options for registering a logger.
 */
export type LoggerOptions = {
  /** The native log level to use */
  level: NativeLoggerLevel;
};

/**
 * Configuration options for synchronizing a logger.
 */
export type LoggerSyncOptions = {
  /** The logger instance identifier */
  id: string;
  /** The native log level to update to */
  level: NativeLoggerLevel;
};

/**
 * TurboModule specification for the native logger module.
 */
export interface Spec extends TurboModule {
  registerLogger(config: LoggerOptions): string;
  syncLogger(config: LoggerSyncOptions): void;
}

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

/**
 * Gets the native logger module, supporting both New Architecture (Turbo Modules) and legacy architecture.
 *
 * @returns The native Logger module implementation.
 * @throws Error if the classic native module is not found in legacy architecture.
 */
export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    return TurboModuleRegistry.getEnforcing<Spec>('Logger');
  }

  const classic = NativeModules.Logger ?? NativeModules.RNPingLogger;
  if (!classic) {
    const available = Object.keys(NativeModules)
      .slice(0, 10); // avoid huge logs

    throw new Error(
      '[@ping-identity/rn-logger] Classic Logger (or RNPingLogger) native module not found.\n' +
      'Available NativeModules: ' + JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
