/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { CustomLogger, LogLevel, LogMessage } from '@forgerock/sdk-logger';

export type { CustomLogger, LogLevel, LogMessage };

export type LoggerConfig = {
  level?: LogLevel;
  custom?: CustomLogger;
};

export type LoggerInstance = {
  changeLevel: (level: LogLevel) => void;
  error: (...args: LogMessage[]) => void;
  warn: (...args: LogMessage[]) => void;
  info: (...args: LogMessage[]) => void;
  debug: (...args: LogMessage[]) => void;
};
