/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { logger as sdkLogger } from '@forgerock/sdk-logger';
import type { LogLevel, LoggerConfig, LoggerInstance, LogMessage } from './types';
import NativeLogger, { type NativeLoggerLevel } from './NativeRNPingLogger';

const nativeLevelMap: Record<LogLevel, NativeLoggerLevel> = {
  debug: 'STANDARD',
  info: 'STANDARD',
  warn: 'WARN',
  error: 'WARN',
  none: 'NONE',
};

// Provide a default custom logger that returns a truthy value so the SDK
// logger does not fall back to console.error (LogBox warnings in dev).
function createCustomLogger(custom: LoggerConfig['custom']): Required<LoggerConfig>['custom'] {
  return (
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
    }
  );
}

function syncNativeLogger(id: string, level: LogLevel) {
  NativeLogger.syncLogger({
    id,
    level: nativeLevelMap[level],
  });
}

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

export function logger(config: LoggerConfig = {}): LoggerInstance {
  let logLevel = config.level ?? 'none';
  const jsLogger = sdkLogger({
    level: logLevel,
    custom: createCustomLogger(config.custom),
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
