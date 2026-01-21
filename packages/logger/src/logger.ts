/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { logger as sdkLogger } from '@forgerock/sdk-logger';
import type { LogLevel, LoggerConfig, LoggerInstance, LogMessage } from './types/logger.types';
import NativeLogger, { type NativeLoggerLevel } from './NativeRNPingLogger';
import pkg from '@react-native-pingidentity/logger/package.json';

const nativeLevelMap: Record<LogLevel, NativeLoggerLevel> = {
  debug: 'STANDARD',
  info: 'STANDARD',
  warn: 'WARN',
  error: 'WARN',
  none: 'NONE',
};

const sdkTag = `[RNPingSDK v${pkg.version}]`;

// Provide a default custom logger that returns a truthy value so the SDK
// logger does not fall back to console.error (LogBox warnings in dev).
function createCustomLogger(
  custom: LoggerConfig['custom'],
  tag: string
): Required<LoggerConfig>['custom'] {
  const base =
    custom ?? {
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

function syncNativeLogger(id: string, level: LogLevel) {
  NativeLogger.syncLogger({
    id,
    level: nativeLevelMap[level],
  });
}

/**
 * Configures and registers a native logger instance.
 * @param config - Logger configuration options
 * @returns The unique identifier for the registered native logger
 * @throws {Error} If the native logger registration fails
 * @public
 * @remarks
 * This function registers a logger with the native platform (iOS/Android)
 * and returns an identifier that can be used to sync logger settings.
 */
export function configureLogger(config: LoggerConfig = {}): string {
  const level = config.level ?? 'none';
  const id = NativeLogger.registerLogger({
    level: nativeLevelMap[level],
  });

  if (!id) {
    throw new Error(
      '[@react-native-pingidentity/logger] Failed to configure native logger'
    );
  }

  return id;
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
 * import { logger } from '@react-native-pingidentity/logger';
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
  const id = configureLogger({ level: logLevel });

  return {
    changeLevel(level: LogLevel) {
      logLevel = level;
      jsLogger.changeLevel(level);
      syncNativeLogger(id, logLevel);
    },
    error: (...args: LogMessage[]) => jsLogger.error(...args),
    warn: (...args: LogMessage[]) => jsLogger.warn(...args),
    info: (...args: LogMessage[]) => jsLogger.info(...args),
    debug: (...args: LogMessage[]) => jsLogger.debug(...args),
  };
}
