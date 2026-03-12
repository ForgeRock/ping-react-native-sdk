/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';
import type {
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileJourneyResult,
} from './types';

/**
 * Native module interface for device profile collection.
 *
 * Provides methods to collect device profile data either standalone
 * or as part of an active Journey authentication flow.
 */
export interface Spec extends TurboModule {
  /**
   * Collect a device profile outside of Journey flows.
   *
   * @remarks
   * Rejects with a `DeviceProfileError` on failure.
   */
  collectDeviceProfile(
    collectors: DeviceProfileCollector[]
  ): Promise<DeviceProfile>;

  /**
   * Collect a device profile as part of an active Journey callback.
   *
   * @remarks
   * Rejects with a `DeviceProfileError` on failure.
   */
  collectDeviceProfileForJourney(
    journeyId: string,
    collectors: DeviceProfileCollector[],
    loggerId?: string
  ): Promise<DeviceProfileJourneyResult>;
}

/** * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingDeviceProfile');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingDeviceProfileClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-device-profile] Native module RNPingDeviceProfile not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules))
  );
}

export default getNativeModule();
