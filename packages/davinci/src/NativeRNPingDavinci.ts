/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/* eslint-disable @typescript-eslint/no-wrapper-object-types -- TurboModule spec uses Object for bridge-mapped types (ReadableMap/NSDictionary) */
import {
  NativeModules,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';

/**
 * Serialised native DaVinci configuration payload.
 *
 * @remarks
 * All OIDC fields are flat (no nesting). Passed to `configureDaVinci` after
 * JS validation and storage/logger handle resolution.
 *
 * @internal
 */
export type NativeDaVinciConfig = {
  /** OIDC discovery endpoint URL — required. */
  discoveryEndpoint: string;
  /** OAuth2 client identifier — required. */
  clientId: string;
  /** OAuth2 redirect URI — required. */
  redirectUri: string;
  /** OAuth2 scopes to request. */
  scopes?: string[];
  /** Resolved OIDC storage handle id from the storage registry. */
  storageId?: string;
  /** Sign-out redirect URI (Android only in 2.0.1). */
  signOutRedirectUri?: string;
  /** Login hint forwarded to the authorization endpoint. */
  loginHint?: string;
  /** Nonce parameter for the authorization request. */
  nonce?: string;
  /** State parameter for the authorization request. */
  state?: string;
  /** Prompt parameter for the authorization request. */
  prompt?: string;
  /** Display parameter for the authorization request. */
  display?: string;
  /** Space-separated preferred UI locales. */
  uiLocales?: string;
  /** Authentication context class reference values. */
  acrValues?: string;
  /** Proactive token refresh threshold in seconds. */
  refreshThreshold?: number;
  /** Additional provider-specific authorization request parameters. */
  additionalParameters?: Object;
  /** Network timeout in milliseconds (iOS bridge converts to seconds). */
  timeout?: number;
  /** Resolved logger handle id from the logger registry. */
  loggerId?: string;
};

/**
 * Native module contract for DaVinci operations.
 *
 * @remarks
 * All config and node payloads use `Object` for TurboModule codegen compatibility
 * (maps to `ReadableMap`/`NSDictionary` on the native side).
 *
 * @internal
 */
export interface Spec extends TurboModule {
  /**
   * Configure a native DaVinci workflow instance.
   *
   * @param config - Serialised DaVinci configuration payload.
   * @returns Native DaVinci instance identifier (davinciId handle).
   */
  configureDaVinci(config: NativeDaVinciConfig): Promise<string>;

  /**
   * Start the DaVinci flow.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @returns Serialised first flow node.
   */
  start(davinciId: string): Promise<Object>;

  /**
   * Advance the active DaVinci flow node.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @param input - Key-indexed collector values to apply before advancing.
   * @returns Serialised next flow node.
   */
  next(davinciId: string, input: Object): Promise<Object>;

  /**
   * Resolve the active user session.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @returns Serialised session payload, or null when no active session.
   */
  getSession(davinciId: string): Promise<Object | null>;

  /**
   * Refresh the active user session tokens.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @returns Serialised refreshed session payload, or null when no active session.
   */
  refresh(davinciId: string): Promise<Object | null>;

  /**
   * Revoke the active user access and refresh tokens.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @returns `true` when revocation completes.
   */
  revoke(davinciId: string): Promise<boolean>;

  /**
   * Resolve userinfo claims for the active session.
   *
   * @param davinciId - Native DaVinci instance identifier.
   * @returns Serialised userinfo payload, or null when no active session.
   */
  userinfo(davinciId: string): Promise<Object | null>;

  /**
   * Log out the active user and clear the session.
   *
   * @param davinciId - Native DaVinci instance identifier.
   */
  logout(davinciId: string): Promise<void>;

  /**
   * Dispose the native DaVinci instance and release runtime state.
   *
   * @param davinciId - Native DaVinci instance identifier.
   */
  dispose(davinciId: string): Promise<void>;
}

let _nativeModule: Spec | null = null;

/** @internal — resets the module cache for testing only. */
export function _resetNativeModuleForTesting(): void {
  _nativeModule = null;
}

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 *
 * @returns Native module implementation for the current architecture.
 * @throws Error when no native module is registered.
 */
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingDavinci');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingDavinciClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-davinci] Native module RNPingDavinci not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Lazy native module wrapper.
 *
 * Resolves the native module at call time to avoid import-time failures while
 * the runtime is still bootstrapping native providers.
 */
const NativeRNPingDavinci: Spec = {
  configureDaVinci(config) {
    return getNativeModule().configureDaVinci(config);
  },
  start(davinciId) {
    return getNativeModule().start(davinciId);
  },
  next(davinciId, input) {
    return getNativeModule().next(davinciId, input);
  },
  getSession(davinciId) {
    return getNativeModule().getSession(davinciId);
  },
  refresh(davinciId) {
    return getNativeModule().refresh(davinciId);
  },
  revoke(davinciId) {
    return getNativeModule().revoke(davinciId);
  },
  userinfo(davinciId) {
    return getNativeModule().userinfo(davinciId);
  },
  logout(davinciId) {
    return getNativeModule().logout(davinciId);
  },
  dispose(davinciId) {
    return getNativeModule().dispose(davinciId);
  },
};

export default NativeRNPingDavinci;
