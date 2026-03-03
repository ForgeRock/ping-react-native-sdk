/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { Platform } from 'react-native';
import { getNativeModule } from './NativeRNPingBrowser';
import { logger as createLogger } from '@ping-identity/rn-logger';
import type { LoggerInstance } from '@ping-identity/rn-logger';

import type {
  BrowserConfig,
  BrowserLoggerOptions,
  BrowserOpenOptions,
  BrowserResult,
} from './types';

/**
 * Cached default logger used when callers do not provide one.
 */
let defaultLoggerInstance: LoggerInstance | null = null;

/**
 * Lazily initialize and return the default logger instance.
 */
const getDefaultLogger = (): LoggerInstance => {
  if (!defaultLoggerInstance) {
    defaultLoggerInstance = createLogger({ level: 'none' });
  }
  return defaultLoggerInstance;
};

/**
 * Resolve JS logger instance and native logger identifier for bridge calls.
 */
const resolveLogger = (
  options?: BrowserLoggerOptions
): { logger: LoggerInstance; loggerId?: string } => {
  const logger = options?.logger ?? getDefaultLogger();
  const loggerId =
    options?.nativeLogger?.id ??
    logger.nativeHandle?.id ??
    getDefaultLogger().nativeHandle?.id;

  return { logger, loggerId };
};

/**
 * Configure global browser behavior.
 *
 * Android applies Custom Tabs/Auth Tabs settings globally; iOS is a no-op.
 *
 * @param config Platform-specific browser configuration.
 * @param options Optional logger overrides for this call.
 */
export function configureBrowser(
  config: BrowserConfig,
  options?: BrowserLoggerOptions
): void {
  const { logger, loggerId } = resolveLogger(options);
  logger.debug(`Browser configure requested ${JSON.stringify({ loggerId })}`);
  if (Platform.OS !== 'android') {
    logger.debug('Browser configure skipped on non-Android platform');
    return;
  }

  getNativeModule().configure(config.android ?? {});
  logger.info('Browser configure success');
}

/**
 * Reset any in-flight browser session.
 *
 * iOS cancels the current browser flow if active; Android is a no-op.
 */
export function resetBrowser(options?: BrowserLoggerOptions): void {
  const { logger } = resolveLogger(options);
  logger.debug('Browser reset requested');
  if (Platform.OS !== 'ios') {
    logger.debug('Browser reset skipped on non-iOS platform');
    return;
  }

  getNativeModule().reset();
  logger.info('Browser reset requested in native module');
}

/**
 * Launch a secure system browser and wait for redirect or cancellation.
 *
 * Android uses Auth Tabs/Custom Tabs; iOS uses ASWebAuthenticationSession.
 *
 * @param url Target URL to open.
 * @param options Per-launch options and callback configuration.
 * @param loggerOptions Optional logger overrides for this call.
 * @returns The browser result when the redirect is received or the user cancels.
 */
export function open(
  url: string,
  options: BrowserOpenOptions,
  loggerOptions?: BrowserLoggerOptions
): Promise<BrowserResult> {
  const { logger, loggerId } = resolveLogger(loggerOptions);
  logger.info('Browser open requested');
  logger.debug(
    `Browser open options ${JSON.stringify({
      url,
      callbackUrlScheme: options.callbackUrlScheme,
      redirectUri: options.redirectUri,
      loggerId,
    })}`
  );

  const nativeOptions = { ...options, loggerId };
  return getNativeModule()
    .open(url, nativeOptions)
    .then((result) => {
      logger.info(`Browser open result ${JSON.stringify(result)}`);
      return result;
    })
    .catch((error) => {
      logger.error('Browser open failed');
      throw error;
    });
}

export type {
  BrowserConfig,
  BrowserError,
  BrowserErrorCode,
  BrowserLoggerOptions,
  IOSBrowserOpenOptions,
  BrowserOpenOptions,
  BrowserResult,
} from './types';
