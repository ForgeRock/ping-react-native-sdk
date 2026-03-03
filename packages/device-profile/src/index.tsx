/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { JourneyInstance } from '@ping-identity/rn-types';
import { getNativeModule } from './NativeRNPingDeviceProfile';
import { logger as createLogger } from '@ping-identity/rn-logger';
import type { LoggerInstance } from '@ping-identity/rn-logger';
import type {
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileLoggerOptions,
  DeviceProfileJourneyResult,
} from './types';

/**
 * Cached default logger for device-profile operations.
 */
let defaultLoggerInstance: LoggerInstance | null = null;

/**
 * Lazily initializes a default logger instance.
 */
const getDefaultLogger = (): LoggerInstance => {
  if (!defaultLoggerInstance) {
    defaultLoggerInstance = createLogger({ level: 'none' });
  }
  return defaultLoggerInstance;
};

/**
 * Resolves JS logger instance and native logger identifier for bridge calls.
 */
const resolveLogger = (
  options?: DeviceProfileLoggerOptions
): { logger: LoggerInstance; loggerId?: string } => {
  const logger = options?.logger ?? getDefaultLogger();
  const loggerId =
    options?.nativeLogger?.id ??
    logger.nativeHandle?.id ??
    getDefaultLogger().nativeHandle?.id;

  return { logger, loggerId };
};

/**
 * Collects a device profile outside of Journey flows.
 *
 * @remarks
 * Native implementations remain authoritative for permissions, formatting, and execution.
 * 
 * @example
 * ```ts
 * try {
 *   const profile = await collectDeviceProfile(['hardware', 'network']);
 *   console.log(profile);
 * } catch (error) {
 *   console.error('Profile collection failed', error);
 * }
 * ```
 *
 * @param collectors - Ordered list of predefined collectors to execute.
 * @returns A JSON-compatible device profile payload.
 */
export async function collectDeviceProfile(
  collectors: DeviceProfileCollector[]
): Promise<DeviceProfile> {
  const nativeModule = getNativeModule();
  return nativeModule.collectDeviceProfile(collectors);
}

/**
 * Collects a device profile as part of an active Journey callback.
 *
 * @remarks
 * The Journey instance owns lifecycle and state; this call simply delegates to native.
 *
 * @example
 * ```ts
 * const node = await journey.start();
 * if (node.callbacks?.some(cb => cb.type === 'DeviceProfileCallback')) {
 *   try {
 *     await collectDeviceProfileForJourney(
 *       journey,
 *       ['hardware', 'network', 'browser']
 *     );
 *     await journey.next();
 *   } catch (error) {
 *     console.error('Device profile submission failed', error);
 *   }
 * }
 * ```
 *
 * @param journey - Active Journey instance used to resolve the callback context.
 * @param collectors - Ordered list of predefined collectors to execute.
 * @param options - Optional logger overrides for this call.
 * @returns Result object describing success.
 */
export async function collectDeviceProfileForJourney(
  journey: JourneyInstance,
  collectors: DeviceProfileCollector[],
  options?: DeviceProfileLoggerOptions
): Promise<DeviceProfileJourneyResult> {
  const { logger, loggerId } = resolveLogger(options);
  logger.debug(
    `Device profile journey requested ${JSON.stringify({ collectors, loggerId })}`
  );
  let journeyId: string;
  try {
    logger.debug('Device profile journey getId requested');
    journeyId = await journey.getId();
    logger.debug('Device profile journey getId success');
  } catch (error) {
    logger.error('Device profile failed while resolving Journey');
    throw error;
  }

  const nativeModule = getNativeModule();
  logger.debug(
    `Device profile native module requested ${JSON.stringify({ collectors })}`
  );
  try {
    const result = await nativeModule.collectDeviceProfileForJourney(
      journeyId,
      collectors,
      loggerId
    );
    logger.debug(
      `Device profile metadata collection successful ${JSON.stringify(result)}`
    );
    return result;
  } catch (error) {
    logger.error('Device profile metadata collection for Journey failed');
    throw error;
  }
}

export type * from './types';
export type { JourneyInstance } from '@ping-identity/rn-types';
