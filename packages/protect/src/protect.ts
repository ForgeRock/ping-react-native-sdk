/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { noopLogger } from '@ping-identity/rn-types';
import type { LoggerInstance } from '@ping-identity/rn-types';
import {
  getNativeModule,
  toNativeConfig,
  toNativeProtectConfig,
} from './NativeRNPingProtect';
import type { ProtectConfig } from './types';
import { ProtectError } from './types/protect.types';

function resolveLoggerId(logger?: LoggerInstance): string | undefined {
  const id = logger?.nativeHandle?.id?.trim();
  return id || undefined;
}

async function withLogging<T>(
  operation: string,
  logger: LoggerInstance,
  fn: () => Promise<T>,
): Promise<T> {
  logger.info(`Protect ${operation} requested`);
  try {
    const result = await fn();
    logger.debug(`Protect ${operation} success`);
    return result;
  } catch (error) {
    logger.error(`Protect ${operation} failed`);
    throw ProtectError.from(error);
  }
}

/**
 * Initializes the Protect SDK and optionally resumes behavioral data collection.
 *
 * @param config - Protect SDK configuration and optional logger.
 * @throws {@link ProtectError} when initialization fails.
 *
 * @example
 * ```ts
 * import { startProtect } from '@ping-identity/rn-protect';
 * await startProtect({ envId: 'your-pingone-env-id' });
 * ```
 *
 * @public
 */
export async function startProtect(config: ProtectConfig = {}): Promise<void> {
  const logger = config.logger ?? noopLogger;
  const loggerId = resolveLoggerId(config.logger);
  logger.debug(
    `Protect startProtect config ${JSON.stringify({ hasLogger: Boolean(loggerId) }, null, 2)}`,
  );
  return withLogging('startProtect', logger, async () => {
    await getNativeModule().initialize(
      toNativeProtectConfig(config),
      toNativeConfig({ loggerId }),
    );
    if (config.resumeBehavioralDataOnStart) {
      await getNativeModule().resumeBehavioralData(
        toNativeConfig({ loggerId }),
      );
    }
  });
}

/**
 * Pauses behavioral data collection.
 *
 * Call this after a successful authentication flow. Requires `startProtect()` first.
 *
 * @param options - Optional logger instance.
 * @throws {@link ProtectError} when the SDK is not initialized.
 *
 * @example
 * ```ts
 * import { pauseBehavioralData } from '@ping-identity/rn-protect';
 * await pauseBehavioralData();
 * ```
 *
 * @public
 */
export async function pauseBehavioralData(
  options: { logger?: LoggerInstance } = {},
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);
  return withLogging('pauseBehavioralData', logger, () =>
    getNativeModule().pauseBehavioralData(toNativeConfig({ loggerId })),
  );
}

/**
 * Resumes behavioral data collection.
 *
 * Call this at the start of a new authentication flow. Requires `startProtect()` first.
 *
 * @param options - Optional logger instance.
 * @throws {@link ProtectError} when the SDK is not initialized.
 *
 * @example
 * ```ts
 * import { resumeBehavioralData } from '@ping-identity/rn-protect';
 * await resumeBehavioralData();
 * ```
 *
 * @public
 */
export async function resumeBehavioralData(
  options: { logger?: LoggerInstance } = {},
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);
  return withLogging('resumeBehavioralData', logger, () =>
    getNativeModule().resumeBehavioralData(toNativeConfig({ loggerId })),
  );
}
