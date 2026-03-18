/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { CustomLogger, LogLevel, LogMessage } from '@forgerock/sdk-logger';
import type {
  LoggerInstance,
  NativeLoggerHandle,
} from '@ping-identity/rn-types';

export type { CustomLogger, LogLevel, LogMessage };
export type { LoggerInstance, NativeLoggerHandle };

/**
 * Configuration options for the logger.
 * @public
 */
export type LoggerConfig = {
  /**
   * The logging level to use.
   * @remarks
   * Controls which messages are logged based on severity.
   * Available levels: 'debug', 'info', 'warn', 'error', 'none'.
   * @defaultValue 'none'
   */
  level?: LogLevel;
  /**
   * Custom logger implementation.
   * @remarks
   * Allows you to provide custom handlers for each log level.
   * If not provided, default console methods will be used.
   */
  custom?: CustomLogger;
};
