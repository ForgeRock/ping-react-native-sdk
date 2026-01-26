/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Native configuration payload sent over the bridge.
 */
export type NativeOidcClientConfig = {
  clientId: string;
  discoveryEndpoint: string;
  redirectUri: string;
  scopes: string[];
  storageId?: string;
  acrValues?: string;
  loginHint?: string;
  display?: string;
  prompt?: string;
  additionalParameters?: Object;
};

/**
 * Native authorization override options.
 */
export type NativeOidcAuthorizeOptions = {
  acrValues?: string;
  loginHint?: string;
  display?: string;
  prompt?: string;
  additionalParameters?: Object;
};

/**
 * Native authorization result payload returned by the bridge.
 */
export type NativeOidcAuthorizeResult =
  | {
      type: 'success';
      code: string;
      state?: string;
    }
  | {
      type: 'cancel';
    };

/**
 * Native token payload returned by the bridge.
 */
export type NativeOidcTokens = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
};

/**
 * Native module contract for the OIDC package.
 */
export interface Spec extends TurboModule {
  createClient(config: NativeOidcClientConfig): string;
  createWebClient(clientId: string): string;
  authorize(
    webClientId: string,
    options: NativeOidcAuthorizeOptions
  ): Promise<NativeOidcAuthorizeResult>;
  hasUser(webClientId: string): Promise<boolean>;
  token(webClientId: string): Promise<NativeOidcTokens>;
  revoke(webClientId: string): Promise<void>;
  logout(webClientId: string): Promise<void>;
}

/**
 * Resolve the native module for the OIDC API.
 */
export function getNativeModule(): Spec {
  const isNewArchEnabled =
    typeof global.__turboModuleProxy !== 'undefined' &&
    global.__turboModuleProxy != null;

  if (isNewArchEnabled) {
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingOidc');
    } catch {
      // Fall back to classic if TurboModule isn't registered at runtime.
    }
  }

  const classic = NativeModules.RNPingOidcClassic;
  if (!classic) {
    const available = Object.keys(NativeModules);
    throw new Error(
      '[@ping-identity/rn-oidc] Native RNPingOidcClassic module not found.\n' +
        'Available NativeModules: ' +
        JSON.stringify(available)
    );
  }

  return classic as Spec;
}
