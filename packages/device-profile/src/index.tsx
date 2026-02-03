/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { getNativeModule } from './NativeRNPingDeviceProfile';
import { logger } from './logging';
import type {
  DeviceProfileCallbackInputValue,
  DeviceProfile,
  DeviceProfileCollector,
  JourneyInstance,
} from './types';

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
  try {
    const nativeModule = getNativeModule();
    const profile = await nativeModule.collectDeviceProfile(collectors);
    logger.info('Device profile metadata collection succeeded');
    return profile;
  } catch (error) {
    logger.error('Device profile metadata collection failed', String(error));
    throw error;
  }
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
 *   const profile = await collectDeviceProfileForJourney(
 *     journey,
 *     ['hardware', 'network', 'browser']
 *   );
 *   const updatedNode = await journey.next({ profile });
 * }
 * ```
 *
 * @param journey - Active Journey instance used to resolve the callback context.
 * @param collectors - Ordered list of predefined collectors to execute.
 * @param callbackPayload - Optional raw callback payload when available from Journey.
 * @returns A PingOne AIC-ready device profile payload.
 */
export async function collectDeviceProfileForJourney(
  journey: JourneyInstance,
  collectors: DeviceProfileCollector[],
): Promise<DeviceProfileCallbackInputValue> {
  let journeyId: string;
  try {
    journeyId = await journey.getId();
  } catch (error) {
    logger.error('Device profile failed while resolving Journey', String(error));
    throw error;
  }

  logger.info(
    `Device profile invoking native module to collect metadata for Journey`
  );

  try {
    const nativeModule = getNativeModule();
    const payload = await nativeModule.collectDeviceProfileForJourney(
      journeyId,
      collectors
    );
    logger.info('Device profile metadata collection for Journey succeeded');
    return payload;
  } catch (error) {
    logger.error('Device profile metadata collection for Journey failed', String(error));
    throw error;
  }
}

export type * from './types';
