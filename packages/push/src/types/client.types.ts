/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { PushCredential } from './credential.types';
import type { PushNotification } from './notification.types';

/**
 * Reusable client for push MFA operations.
 *
 * @remarks
 * Obtained by calling {@link createPushClient}. The underlying native
 * `PushClient` instance is initialized eagerly at creation time.
 *
 * @example
 * ```ts
 * import { createPushClient } from '@ping-identity/rn-push';
 *
 * const client = createPushClient();
 * const credential = await client.addCredentialFromUri('pushauth://...');
 * ```
 */
export interface PushClient {
  /**
   * Enrolls a new push credential from a `pushauth://` URI.
   *
   * @param uri - The `pushauth://` enrollment URI received from the server.
   * @returns A promise that resolves to the newly enrolled {@link PushCredential}.
   * @throws {@link PushError} with code `'invalid_uri'` if the URI is malformed.
   * @throws {@link PushError} with code `'duplicate_credential'` if already enrolled.
   * @throws {@link PushError} with code `'registration_failed'` if server registration fails.
   * @example
   * ```ts
   * const credential = await client.addCredentialFromUri('pushauth://...');
   * ```
   */
  addCredentialFromUri(uri: string): Promise<PushCredential>;

  /**
   * Saves an updated credential back to native storage.
   *
   * @param credential - The credential object to persist. Must have been obtained
   *   from the bridge (e.g. via `getCredential`). The `sharedSecret` field is
   *   never included in the JS representation and is handled natively.
   * @returns A promise that resolves to the saved {@link PushCredential}.
   * @throws {@link PushError} with code `'credential_not_found'` if the credential does not exist.
   * @throws {@link PushError} with code `'storage_failure'` if persistence fails.
   * @example
   * ```ts
   * const saved = await client.saveCredential(credential);
   * ```
   */
  saveCredential(credential: PushCredential): Promise<PushCredential>;

  /**
   * Returns all push credentials stored on the device.
   *
   * @returns A promise that resolves to an array of {@link PushCredential} objects.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const credentials = await client.getCredentials();
   * ```
   */
  getCredentials(): Promise<PushCredential[]>;

  /**
   * Returns a specific push credential by its identifier.
   *
   * @param credentialId - The unique credential identifier.
   * @returns A promise that resolves to the {@link PushCredential}, or `null` if not found.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const credential = await client.getCredential('cred-id');
   * ```
   */
  getCredential(credentialId: string): Promise<PushCredential | null>;

  /**
   * Deletes a push credential by its identifier.
   *
   * @param credentialId - The unique credential identifier to delete.
   * @returns A promise that resolves to `true` if deleted, `false` if not found.
   * @throws {@link PushError} with code `'storage_failure'` if deletion fails.
   * @example
   * ```ts
   * const deleted = await client.deleteCredential('cred-id');
   * ```
   */
  deleteCredential(credentialId: string): Promise<boolean>;

  /**
   * Updates the device push token, optionally scoped to a specific credential.
   *
   * @param token - The new device push token (FCM token on Android, APNs token on iOS).
   * @param credentialId - Optional credential identifier. When omitted, the token
   *   is set globally for all credentials.
   * @returns A promise that resolves to `true` when the token is successfully updated.
   * @throws {@link PushError} with code `'registration_failed'` if the server update fails.
   * @example
   * ```ts
   * // Global token update
   * await client.setDeviceToken(fcmToken);
   * // Scoped token update
   * await client.setDeviceToken(fcmToken, 'cred-id');
   * ```
   */
  setDeviceToken(token: string, credentialId?: string): Promise<boolean>;

  /**
   * Returns the current device push token.
   *
   * @returns A promise that resolves to the device token string, or `null` if not set.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const token = await client.getDeviceToken();
   * ```
   */
  getDeviceToken(): Promise<string | null>;

  /**
   * Processes an incoming push notification from a dictionary payload.
   *
   * @param messageData - The raw push message data dictionary (e.g. from FCM `getData()`
   *   on Android or APNs `userInfo` on iOS).
   * @returns A promise resolving to a {@link PushNotification}, or `null` for unsupported payloads.
   * @throws {@link PushError} with code `'message_parsing_failed'` if the payload cannot be parsed.
   * @example
   * ```ts
   * const notification = await client.processNotification(message.getData());
   * if (notification) {
   *   await client.approveNotification(notification.id);
   * }
   * ```
   */
  processNotification(
    messageData: Record<string, unknown>,
  ): Promise<PushNotification | null>;

  /**
   * Processes an incoming push notification from a raw string or JWT payload.
   *
   * @param message - The raw push message string received from the push service.
   * @returns A promise resolving to a {@link PushNotification}, or `null` for unsupported payloads.
   * @throws {@link PushError} with code `'message_parsing_failed'` if the payload cannot be parsed.
   * @example
   * ```ts
   * const notification = await client.processNotificationFromMessage(rawMessage);
   * ```
   */
  processNotificationFromMessage(
    message: string,
  ): Promise<PushNotification | null>;

  /**
   * Approves a standard push notification.
   *
   * @param notificationId - The unique notification identifier.
   * @returns A promise that resolves to `true` when approved successfully.
   * @throws {@link PushError} with code `'notification_not_found'` if not found.
   * @throws {@link PushError} with code `'policy_violation'` if approval violates policy.
   * @example
   * ```ts
   * await client.approveNotification(notification.id);
   * ```
   */
  approveNotification(notificationId: string): Promise<boolean>;

  /**
   * Approves a challenge push notification with a user-provided response.
   *
   * @param notificationId - The unique notification identifier.
   * @param challengeResponse - The user's challenge response string.
   * @returns A promise that resolves to `true` when approved successfully.
   * @throws {@link PushError} with code `'notification_not_found'` if not found.
   * @throws {@link PushError} with code `'invalid_parameter_value'` if `challengeResponse` is empty.
   * @example
   * ```ts
   * await client.approveChallengeNotification(notification.id, selectedAnswer);
   * ```
   */
  approveChallengeNotification(
    notificationId: string,
    challengeResponse: string,
  ): Promise<boolean>;

  /**
   * Approves a biometric push notification using the specified authentication method.
   *
   * @param notificationId - The unique notification identifier.
   * @param authenticationMethod - The biometric authentication method identifier.
   * @returns A promise that resolves to `true` when approved successfully.
   * @throws {@link PushError} with code `'notification_not_found'` if not found.
   * @throws {@link PushError} with code `'invalid_parameter_value'` if `authenticationMethod` is empty.
   * @example
   * ```ts
   * await client.approveBiometricNotification(notification.id, 'biometric');
   * ```
   */
  approveBiometricNotification(
    notificationId: string,
    authenticationMethod: string,
  ): Promise<boolean>;

  /**
   * Denies a push notification.
   *
   * @param notificationId - The unique notification identifier.
   * @returns A promise that resolves to `true` when denied successfully.
   * @throws {@link PushError} with code `'notification_not_found'` if not found.
   * @throws {@link PushError} with code `'policy_violation'` if denial violates policy.
   * @example
   * ```ts
   * await client.denyNotification(notification.id);
   * ```
   */
  denyNotification(notificationId: string): Promise<boolean>;

  /**
   * Returns all push notifications that are pending a user response.
   *
   * @returns A promise resolving to an array of pending {@link PushNotification} objects.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const pending = await client.getPendingNotifications();
   * ```
   */
  getPendingNotifications(): Promise<PushNotification[]>;

  /**
   * Returns all push notifications stored on the device.
   *
   * @returns A promise resolving to an array of all {@link PushNotification} objects.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const all = await client.getAllNotifications();
   * ```
   */
  getAllNotifications(): Promise<PushNotification[]>;

  /**
   * Returns a specific push notification by its identifier.
   *
   * @param notificationId - The unique notification identifier.
   * @returns A promise resolving to the {@link PushNotification}, or `null` if not found.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const notification = await client.getNotification('notif-id');
   * ```
   */
  getNotification(notificationId: string): Promise<PushNotification | null>;

  /**
   * Runs the configured notification cleanup strategy.
   *
   * @param credentialId - Optional credential identifier. When provided, only
   *   notifications associated with that credential are considered for cleanup.
   *   When omitted, cleanup applies across all credentials.
   * @returns A promise resolving to the number of notifications that were removed.
   * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
   * @example
   * ```ts
   * const removed = await client.cleanupNotifications();
   * ```
   */
  cleanupNotifications(credentialId?: string): Promise<number>;

  /**
   * Fetches the current platform push token and registers it with the native SDK.
   *
   * On Android, fetches the current FCM registration token and calls `setDeviceToken`
   * internally. On iOS this is a no-op — the APNs token is delivered via `AppDelegate`.
   *
   * Useful when the automatic token delivery has not completed yet.
   *
   * @returns A promise resolving to the token string, or `null` on iOS.
   * @throws {@link PushError} when the FCM token fetch fails.
   * @example
   * ```ts
   * const token = await client.refreshToken();
   * ```
   */
  refreshToken(): Promise<string | null>;

  /**
   * Registers a callback invoked after the device push token has been successfully
   * registered with the native SDK.
   *
   * Fires both for tokens that arrived before `createPushClient()` was called
   * (replayed at creation time) and for subsequent token rotations.
   * Guaranteed to fire *after* `setDeviceToken` has completed, so calling
   * `getDeviceToken()` inside the callback always returns the new token.
   *
   * The subscription is removed automatically when `close()` is called.
   *
   * @param callback - Invoked with the registered token string.
   * @returns An unsubscribe function that removes only this subscription.
   * @example
   * ```ts
   * client.onTokenRegistered((token) => {
   *   console.log('token ready:', token);
   * });
   * ```
   */
  onTokenRegistered(callback: (token: string) => void): () => void;

  /**
   * Registers a callback invoked when a Ping push notification arrives.
   *
   * The SDK calls `processNotification` internally before invoking the callback.
   * The callback receives the parsed {@link PushNotification}, or `null` when the
   * payload was not a recognised Ping push message.
   *
   * The subscription is removed automatically when `close()` is called.
   *
   * @param callback - Invoked with the notification or `null`.
   * @returns An unsubscribe function that removes only this subscription.
   * @example
   * ```ts
   * const unsubscribe = client.onNotification((notification) => {
   *   if (notification) {
   *     // show approval UI
   *   }
   * });
   * // To unsubscribe manually:
   * unsubscribe();
   * ```
   */
  onNotification(
    callback: (notification: PushNotification | null) => void,
  ): () => void;

  /**
   * Releases native push client resources and clears cached state.
   *
   * @remarks
   * Safe to call multiple times — subsequent calls on an already-closed client
   * are a no-op on both platforms. After calling `close()`, the client instance
   * should be discarded and a new one created if push operations are needed again.
   *
   * @returns A promise that resolves when resources are released.
   * @example
   * ```ts
   * await client.close();
   * ```
   */
  close(): Promise<void>;
}
