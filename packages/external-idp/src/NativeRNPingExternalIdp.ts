/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  NativeModules,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';

/**
 * Native module contract for the External IDP package scaffold.
 *
 * Feature methods will be added here as the package implementation evolves.
 */
export type Spec = TurboModule;

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 *
 * @returns Native module implementation for the current architecture.
 * @throws Error when no native module is registered.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingExternalIdp');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingExternalIdpClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-external-idp] Native module RNPingExternalIdp not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules)),
  );
}

export default getNativeModule;
