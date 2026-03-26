/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Native module specification for RNPingFido.
 *
 * Defines the interface contract for the native FIDO module.
 * Extends TurboModule for New Architecture (Fabric) support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing FIDO capabilities.
 *
 * @interface
 */
export interface Spec extends TurboModule {
  /**
   * Returns the default FIDO identifier.
   *
   * @returns A promise that resolves to the identifier string.
   */
  getDefaultFido(): Promise<string>;
}

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingFido');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingFidoClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-fido] Native module RNPingFido not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules))
  );
}
