/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  getNativeModule,
  type Spec as ExternalIdpNativeModule,
} from './NativeRNPingExternalIdp';

/**
 * Returns the linked native bridge module for the current React Native architecture.
 *
 * @remarks
 * This scaffold package intentionally exposes only the low-level bridge accessor until
 * feature-specific External IDP APIs are implemented.
 *
 * @example
 * ```ts
 * import { getExternalIdpNativeModule } from '@ping-identity/rn-external-idp'
 *
 * const nativeModule = getExternalIdpNativeModule()
 * console.log(nativeModule)
 * ```
 *
 * @returns The native External IDP bridge module instance.
 */
export function getExternalIdpNativeModule(): ExternalIdpNativeModule {
  return getNativeModule();
}
