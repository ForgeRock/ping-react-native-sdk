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
