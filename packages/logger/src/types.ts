/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { CustomLogger, LogLevel, LogMessage } from '@forgerock/sdk-logger';

export type { CustomLogger, LogLevel, LogMessage };

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

/**
 * Logger instance with methods for logging at different levels.
 * @public
 */
export type LoggerInstance = {
  /**
   * Changes the current logging level.
   * @param level - The new logging level to set
   * @remarks
   * This method updates both the JavaScript and native logger levels.
   */
  changeLevel: (level: LogLevel) => void;
  /**
   * Logs an error message.
   * @param args - The message(s) to log
   */
  error: (...args: LogMessage[]) => void;
  /**
   * Logs a warning message.
   * @param args - The message(s) to log
   */
  warn: (...args: LogMessage[]) => void;
  /**
   * Logs an informational message.
   * @param args - The message(s) to log
   */
  info: (...args: LogMessage[]) => void;
  /**
   * Logs a debug message.
   * @param args - The message(s) to log
   */
  debug: (...args: LogMessage[]) => void;
};
