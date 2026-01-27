/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Native module specification for RNPingDeviceId.
 * 
 * Defines the interface contract for the native device identifier module.
 * Extends TurboModule for New Architecture (Fabric) support.
 * 
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing secure device identification capabilities.
 * 
 * @interface
 */
export interface Spec extends TurboModule {
  /**
   * Returns the default secure device identifier as determined by the native platform.
   * 
   * The default identifier is platform-specific:
   * - **Android**: Uses KeyStore-generated RSA key pair (cryptographically secure, hardware-backed when available)
   *   - Generates new ID on app reinstall (KeyStore entries generally removed on uninstall)
   *   - Changes when KeyStore entries are cleared
   * - **iOS**: Uses Keychain-backed unique identifier
   *   - Persists across app uninstalls and reinstalls (Keychain not cleared when app deleted)
   *   - Persists through device backups and restores (encrypted iCloud/local backups)
   *   - Only deleted on factory reset
   *   - Can be shared across apps from same developer via Keychain Access Groups
   *   - Automatically migrates legacy FRAuth identifiers
   * 
   * This is the recommended method for most use cases as it provides
   * cryptographically secure identification.
   * 
   * @returns A promise that resolves to the default device identifier string
   */
  getDefaultDeviceId(): Promise<string>;
}

/**
 * Detects if the New Architecture (Turbo Modules) is enabled.
 */
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
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingDeviceId');
    } catch {
      // Fall back to classic if TurboModule isn't registered at runtime.
    }
  }

  const classic = NativeModules.RNPingDeviceIdClassic;
  if (!classic) {
    const available = Object.keys(NativeModules).slice(0, 10);
    throw new Error(
      '[@react-native-pingidentity/device-id] Classic RNPingDeviceIdClassic native module not found.\n' +
      'Available NativeModules: ' +
      JSON.stringify(available)
    );
  }

  return classic as Spec;
}
