/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry, type TurboModule } from 'react-native';
import type {
  DeviceProfileCallbackInputValue,
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileCallbackPayload,
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
    collectors: DeviceProfileCollector[],
    callbackPayload?: DeviceProfileCallbackPayload
  ): Promise<DeviceProfileCallbackInputValue>;
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
    } catch {
      // Fall back to classic if TurboModule isn't registered at runtime.
    }
  }

  const classic =
    NativeModules.RNPingDeviceProfileClassic ?? NativeModules.RNPingDeviceProfile;
  if (!classic) {
    const available = Object.keys(NativeModules).slice(0, 10);
    throw new Error(
      '[@react-native-pingidentity/device-profile] Native RNPingDeviceProfile module not found.\n' +
        'Available NativeModules: ' +
        JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
