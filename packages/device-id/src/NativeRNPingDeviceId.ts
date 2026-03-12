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

/** * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingDeviceId');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingDeviceIdClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-device-id] Native module RNPingDeviceId not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules))
  );
}
