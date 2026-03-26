/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { logger as sdkLogger } from '@forgerock/sdk-logger';
import type {
  LogLevel,
  LoggerConfig,
  LoggerInstance,
  LogMessage,
  NativeLoggerHandle,
} from './types/logger.types';
import NativeLogger, { type NativeLoggerLevel } from './NativeRNPingLogger';
import pkg from '@ping-identity/rn-logger/package.json';

const nativeLevelMap: Record<LogLevel, NativeLoggerLevel> = {
  debug: 'STANDARD',
  info: 'STANDARD',
  warn: 'WARN',
  error: 'WARN',
  none: 'NONE',
};

const sdkTag = `[RNPingSDK v${pkg.version}]`;

/**
 * Provide a default custom logger that returns a truthy value so the SDK
 * logger does not fall back to console.error (LogBox warnings in dev).
 */
function createCustomLogger(
  custom: LoggerConfig['custom'],
  tag: string,
): Required<LoggerConfig>['custom'] {
  const base = custom ?? {
    error: (...args: LogMessage[]) => {
      console.log(...args);
      return true;
    },
    warn: (...args: LogMessage[]) => {
      console.warn(...args);
      return true;
    },
    info: (...args: LogMessage[]) => {
      console.info(...args);
      return true;
    },
    debug: (...args: LogMessage[]) => {
      console.debug(...args);
      return true;
    },
  };

  return {
    error: (...args: LogMessage[]) => base.error(`${tag} ${args.join(' ')}`),
    warn: (...args: LogMessage[]) => base.warn(`${tag} ${args.join(' ')}`),
    info: (...args: LogMessage[]) => base.info(`${tag} ${args.join(' ')}`),
    debug: (...args: LogMessage[]) => base.debug(`${tag} ${args.join(' ')}`),
  };
}

/**
 * Synchronize logger level to native logger state.
 */
function syncNativeLogger(id: string, level: LogLevel) {
  NativeLogger.syncLogger({
    id,
    level: nativeLevelMap[level],
  });
}

/**
 * Configures and registers a native logger instance.
 * @param config - Logger configuration options
 * @returns Handle to the registered native logger
 * @throws {Error} If the native logger registration fails
 * @public
 * @remarks
 * This function registers a logger with the native platform (iOS/Android)
 * and returns an identifier that can be used to sync logger settings.
 */
export function configureLogger(config: LoggerConfig = {}): NativeLoggerHandle {
  const level = config.level ?? 'none';
  const id = NativeLogger.registerLogger({
    level: nativeLevelMap[level],
  });

  if (!id) {
    throw new Error(
      '[@ping-identity/rn-logger] Failed to configure native logger',
    );
  }

  return { id };
}

/**
 * Creates and configures a logger instance.
 * @param config - Logger configuration options
 * @returns A configured logger instance with methods for logging at different levels
 * @public
 * @remarks
 * This is the main entry point for creating a logger. It configures both
 * JavaScript and native loggers and provides a unified interface for logging.
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { logger } from '@ping-identity/rn-logger';
 *
 * const log = logger({ level: 'debug' });
 * log.debug('Debug message');
 * log.info('Info message');
 * log.warn('Warning message');
 * log.error('Error message');
 * ```
 *
 * @example
 * With custom logger:
 * ```typescript
 * const log = logger({
 *   level: 'info',
 *   custom: {
 *     error: (...args) => { sendToAnalytics(args); return true; },
 *     warn: (...args) => { sendToAnalytics(args); return true; },
 *     info: (...args) => { console.log(args); return true; },
 *     debug: (...args) => { console.debug(args); return true; },
 *   }
 * });
 * ```
 */
export function logger(config: LoggerConfig = {}): LoggerInstance {
  let logLevel = config.level ?? 'none';
  const jsLogger = sdkLogger({
    level: logLevel,
    custom: createCustomLogger(config.custom, sdkTag),
  });
  const handle = configureLogger({ level: logLevel });

  return {
    nativeHandle: handle,
    changeLevel(level: LogLevel) {
      logLevel = level;
      jsLogger.changeLevel(level);
      syncNativeLogger(handle.id, logLevel);
    },
    error: (...args: unknown[]) => jsLogger.error(...(args as LogMessage[])),
    warn: (...args: unknown[]) => jsLogger.warn(...(args as LogMessage[])),
    info: (...args: unknown[]) => jsLogger.info(...(args as LogMessage[])),
    debug: (...args: unknown[]) => jsLogger.debug(...(args as LogMessage[])),
  };
}
