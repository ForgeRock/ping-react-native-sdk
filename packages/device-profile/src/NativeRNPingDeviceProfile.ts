/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';
import { logger } from './logging';
import type {
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileJourneyResult,
} from './types';

export interface Spec extends TurboModule {
  /**
   * Collect a device profile outside of Journey flows.
   */
  collectDeviceProfile(
    collectors: DeviceProfileCollector[]
  ): Promise<DeviceProfile>;

  /**
   * Collect a device profile as part of an active Journey callback.
   */
  collectDeviceProfileForJourney(
    journeyId: string,
    collectors: DeviceProfileCollector[]
  ): Promise<DeviceProfileJourneyResult>;
}

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

/**
 * Resolve the native module, preferring TurboModules when enabled.
 *
 * @throws If the classic module is missing at runtime.
 */
export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingDeviceProfile');
    } catch (error){
      logger.error('TurboModule not registered; falling back to classic implementation.', String(error));
    }
  }

  const classic =
    NativeModules.RNPingDeviceProfileClassic ?? NativeModules.RNPingDeviceProfile;
  if (!classic) {
    const available = Object.keys(NativeModules).slice(0, 10);
    throw new Error(
      '[@pingidentity/device-profile] Native RNPingDeviceProfile module not found.\n' +
        'Available NativeModules: ' +
        JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
