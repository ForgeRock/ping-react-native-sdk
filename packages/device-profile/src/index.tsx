/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { getNativeModule } from './NativeRNPingDeviceProfile';
import type {
  DeviceProfileCallbackInputValue,
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileCallbackPayload,
  JourneyInstance,
} from './types';

/**
 * Collects a device profile outside of Journey flows.
 *
 * @remarks
 * Native implementations remain authoritative for permissions, formatting, and execution.
 *
 * @param collectors - Ordered list of predefined collectors to execute.
 * @returns A JSON-compatible device profile payload.
 */
export async function collectDeviceProfile(
  collectors: DeviceProfileCollector[]
): Promise<DeviceProfile> {
  return await getNativeModule().collectDeviceProfile(collectors);
}

/**
 * Collects a device profile as part of an active Journey callback.
 *
 * @remarks
 * The Journey instance owns lifecycle and state; this call simply delegates to native.
 *
 * @param journey - Active Journey instance used to resolve the callback context.
 * @param collectors - Ordered list of predefined collectors to execute.
 * @param callbackPayload - Optional raw callback payload when available from Journey.
 * @returns A PingOne AIC-ready device profile payload.
 */
export async function collectDeviceProfileForJourney(
  journey: JourneyInstance,
  collectors: DeviceProfileCollector[],
  callbackPayload?: DeviceProfileCallbackPayload
): Promise<DeviceProfileCallbackInputValue> {
  const journeyId = await journey.getId();
  return await getNativeModule().collectDeviceProfileForJourney(
    journeyId,
    collectors,
    callbackPayload
  );
}

export type * from './types';
