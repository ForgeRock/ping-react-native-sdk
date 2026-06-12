/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  PushClientConfig,
  PushCredential,
  PushNotification,
} from './types';

/**
 * Native module specification for RNPingPush.
 *
 * Defines the interface contract for the native Push module.
 * Extends TurboModule for New Architecture (Fabric) support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing push MFA enrollment, credential management, device token handling,
 * notification processing, and approve/deny/challenge/biometric response capabilities.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Initializes a new native PushClient with the given configuration.
   *
   * @param config - Resolved per-client push configuration payload.
   * @returns A promise resolving to an opaque client handle id. Pass this id to
   *   every subsequent method call to route to the correct client instance.
   */
  initialize(config: Object): Promise<string>;

  /**
   * Enrolls a new push credential from a `pushauth://` URI.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param uri - The `pushauth://` enrollment URI received from the server.
   * @returns A promise resolving to the serialized `PushCredential`.
   */
  addCredentialFromUri(clientId: string, uri: string): Promise<Object>;

  /**
   * Returns a specific push credential by its identifier.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param credentialId - The unique credential identifier.
   * @returns A promise resolving to `{ credential: PushCredential | null }`.
   */
  getCredential(clientId: string, credentialId: string): Promise<Object>;

  /**
   * Returns all push credentials stored on the device.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise resolving to `{ credentials: PushCredential[] }`.
   */
  getCredentials(clientId: string): Promise<Object>;

  /**
   * Saves an updated credential back to native storage.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param credential - The serialized credential object to persist.
   * @returns A promise resolving to the saved serialized `PushCredential`.
   */
  saveCredential(clientId: string, credential: Object): Promise<Object>;

  /**
   * Deletes a push credential by its identifier.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param credentialId - The unique credential identifier to delete.
   * @returns A promise that resolves to `true` if deleted, `false` if not found.
   */
  deleteCredential(clientId: string, credentialId: string): Promise<boolean>;

  /**
   * Updates the device push token, optionally scoped to a specific credential.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param token - The new device push token.
   * @param credentialId - Credential id to scope the update, or `null` for a global update.
   * @returns A promise that resolves to `true` when the token is successfully updated.
   */
  setDeviceToken(
    clientId: string,
    token: string,
    credentialId: string | null,
  ): Promise<boolean>;

  /**
   * Returns the current device push token.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise resolving to `{ token: string | null }`.
   */
  getDeviceToken(clientId: string): Promise<Object>;

  /**
   * Processes an incoming push notification from a dictionary payload.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param messageData - The raw push message data dictionary.
   * @returns A promise resolving to `{ notification: PushNotification | null }`.
   */
  processNotification(clientId: string, messageData: Object): Promise<Object>;

  /**
   * Processes an incoming push notification from a raw string or JWT payload.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param message - The raw push message string.
   * @returns A promise resolving to `{ notification: PushNotification | null }`.
   */
  processNotificationFromMessage(
    clientId: string,
    message: string,
  ): Promise<Object>;

  /**
   * Approves a standard push notification.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param notificationId - The unique notification identifier.
   * @returns A promise that resolves to `true` when approved successfully.
   */
  approveNotification(
    clientId: string,
    notificationId: string,
  ): Promise<boolean>;

  /**
   * Approves a challenge push notification with a user-provided response.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param notificationId - The unique notification identifier.
   * @param challengeResponse - The user's challenge response string.
   * @returns A promise that resolves to `true` when approved successfully.
   */
  approveChallengeNotification(
    clientId: string,
    notificationId: string,
    challengeResponse: string,
  ): Promise<boolean>;

  /**
   * Approves a biometric push notification using the specified authentication method.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param notificationId - The unique notification identifier.
   * @param authenticationMethod - The biometric authentication method identifier.
   * @returns A promise that resolves to `true` when approved successfully.
   */
  approveBiometricNotification(
    clientId: string,
    notificationId: string,
    authenticationMethod: string,
  ): Promise<boolean>;

  /**
   * Denies a push notification.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param notificationId - The unique notification identifier.
   * @returns A promise that resolves to `true` when denied successfully.
   */
  denyNotification(clientId: string, notificationId: string): Promise<boolean>;

  /**
   * Returns all push notifications that are pending a user response.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise resolving to `{ notifications: PushNotification[] }`.
   */
  getPendingNotifications(clientId: string): Promise<Object>;

  /**
   * Returns all push notifications stored on the device.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise resolving to `{ notifications: PushNotification[] }`.
   */
  getAllNotifications(clientId: string): Promise<Object>;

  /**
   * Returns a specific push notification by its identifier.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param notificationId - The unique notification identifier.
   * @returns A promise resolving to `{ notification: PushNotification | null }`.
   */
  getNotification(clientId: string, notificationId: string): Promise<Object>;

  /**
   * Runs the configured notification cleanup strategy.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @param credentialId - Credential id to scope cleanup, or `null` to clean up across all credentials.
   * @returns A promise resolving to the number of notifications that were removed.
   */
  cleanupNotifications(
    clientId: string,
    credentialId: string | null,
  ): Promise<number>;

  /**
   * Releases native push client resources and removes it from the registry.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise that resolves when resources are released.
   */
  close(clientId: string): Promise<void>;

  /**
   * Returns and clears the list of raw push message payloads that arrived
   * before createPushClient() was called (cold-start / lazy-import race).
   *
   * @returns A promise resolving to an array of raw message data dictionaries.
   */
  consumePendingMessages(): Promise<Object[]>;

  /**
   * Fetches the current platform push token (FCM on Android), registers it with the
   * native PushClient, and returns `{ token: string | null }`.
   *
   * On iOS this is a no-op (APNs token is delivered via AppDelegate) — resolves with `{ token: null }`.
   *
   * @param clientId - Handle id returned by {@link initialize}.
   * @returns A promise resolving to `{ token: string | null }`.
   */
  refreshToken(clientId: string): Promise<Object>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 *
 * @returns The resolved native push module.
 * @throws Error when the native module is unavailable.
 */
let _nativeModule: Spec | null = null;
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingPush');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingPushClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-push] Native module RNPingPush not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts the push client configuration to a codegen-compatible object.
 *
 * @param config - Resolved per-client push configuration.
 * @returns Codegen-compatible object for passing over the bridge.
 */
export function toNativePushConfig(
  config: PushClientConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Casts a direct native credential result to a typed `PushCredential`.
 *
 * Use this helper for methods that return a `PushCredential` directly —
 * specifically `addCredentialFromUri` and `saveCredential`, which resolve to
 * a serialized credential object with no wrapper key.
 *
 * Do NOT use this for `getCredential`, which returns `{ credential: PushCredential | null }`.
 * Use `fromNativeWrappedCredential` for that shape.
 *
 * @param result - Raw native result object containing the serialized credential directly (no wrapper key).
 * @returns Typed `PushCredential`.
 */
export function fromNativeCredential(result: object): PushCredential {
  return result as unknown as PushCredential;
}

/**
 * Unwraps a native `{ credential: PushCredential | null }` result to a typed `PushCredential` or `null`.
 *
 * Use this helper for `getCredential`, which returns `{ credential: PushCredential | null }` —
 * a wrapper shape that must be unwrapped before use. This is distinct from `fromNativeCredential`,
 * which handles methods that return a `PushCredential` directly with no wrapper key.
 *
 * @param wrapped - Raw native result object of shape `{ credential: PushCredential | null }`.
 * @returns Typed `PushCredential` or `null`.
 */
export function fromNativeWrappedCredential(
  wrapped: object,
): PushCredential | null {
  const w = wrapped as { credential?: PushCredential | null };
  return w.credential ?? null;
}

/**
 * Casts a native notification result to a typed `PushNotification` or `null`.
 *
 * @param result - Raw native result object of shape `{ notification: PushNotification | null }`.
 * @returns Typed `PushNotification` or `null`.
 */
export function fromNativeNotification(
  result: object,
): PushNotification | null {
  const wrapped = result as { notification?: PushNotification | null };
  return wrapped.notification ?? null;
}

/**
 * Casts a native credential list result to a typed `PushCredential[]`.
 *
 * @param result - Raw native result object of shape `{ credentials: PushCredential[] }`.
 * @returns Typed array of `PushCredential` objects.
 */
export function fromNativeCredentialList(result: object): PushCredential[] {
  const wrapped = result as { credentials?: PushCredential[] };
  return wrapped.credentials ?? [];
}

/**
 * Casts a native notification list result to a typed `PushNotification[]`.
 *
 * @param result - Raw native result object of shape `{ notifications: PushNotification[] }`.
 * @returns Typed array of `PushNotification` objects.
 */
export function fromNativeNotificationList(result: object): PushNotification[] {
  const wrapped = result as { notifications?: PushNotification[] };
  return wrapped.notifications ?? [];
}

/**
 * Unwraps a native `{ token: string | null }` result to a typed `string` or `null`.
 *
 * Use this helper for `getDeviceToken`, which returns `{ token: string | null }` —
 * a wrapper shape required because TurboModule codegen does not support nullable
 * primitives as top-level promise resolution types.
 *
 * @param wrapped - Raw native result object of shape `{ token: string | null }`.
 * @returns The device token string, or `null` if no token is registered.
 */
export function fromNativeToken(wrapped: object): string | null {
  return (wrapped as { token: string | null }).token ?? null;
}
