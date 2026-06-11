/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  NativeModules,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';

/**
 * JavaScript-level logger levels.
 * These are mapped to native logger levels internally.
 */
export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Native logger levels supported by the underlying platform logger.
 */
export type NativeLoggerLevel = 'STANDARD' | 'WARN' | 'NONE';

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

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 *
 * @returns The native Logger module implementation.
 * @throws Error if no native module is registered.
 *
 * @remarks
 * Not cached — called once at module load via `export default getNativeModule()`.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('Logger');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingLoggerClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-logger] Native module Logger not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

export default getNativeModule();
