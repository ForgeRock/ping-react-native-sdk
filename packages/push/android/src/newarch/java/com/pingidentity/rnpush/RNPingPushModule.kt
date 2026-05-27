/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Push module (New Architecture / Fabric).
 *
 * Delegates all operations to [RNPingPushCommon].
 */
@ReactModule(name = RNPingPushModule.NAME)
class RNPingPushModule(reactContext: ReactApplicationContext) :
  NativeRNPingPushSpec(reactContext) {

  init {
    RNPingPushCommon.configure(reactContext)
  }

  /** Returns the registered module name used by the React Native TurboModule registry. */
  override fun getName(): String = NAME

  /** Cleans up all [RNPingPushCommon] state when the module is torn down. */
  override fun invalidate() {
    super.invalidate()
    RNPingPushCommon.cleanup()
  }

  /**
   * Creates and registers a new [PushClient] from the bridge config map.
   *
   * @param config Push configuration map (storageId, loggerId, cleanupMode, etc.).
   * @param promise Resolved with the opaque client handle, or rejected on failure.
   */
  override fun initialize(config: ReadableMap, promise: Promise) {
    RNPingPushCommon.initialize(config, promise)
  }

  /**
   * Enrolls a new push credential from a `pushauth://` URI.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param uri The `pushauth://` enrollment URI.
   * @param promise Resolved with the serialized credential, or rejected on failure.
   */
  override fun addCredentialFromUri(clientId: String, uri: String, promise: Promise) {
    RNPingPushCommon.addCredentialFromUri(clientId, uri, promise)
  }

  /**
   * Returns a single credential by its identifier.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param credentialId The identifier of the credential to retrieve.
   * @param promise Resolved with `{ credential: PushCredential | null }`, or rejected on failure.
   */
  override fun getCredential(clientId: String, credentialId: String, promise: Promise) {
    RNPingPushCommon.getCredential(clientId, credentialId, promise)
  }

  /**
   * Returns all stored push credentials.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with `{ credentials: [...] }`, or rejected on failure.
   */
  override fun getCredentials(clientId: String, promise: Promise) {
    RNPingPushCommon.getCredentials(clientId, promise)
  }

  /**
   * Persists an updated credential to native storage.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param credential Bridge map of the credential fields to save.
   * @param promise Resolved with the updated serialized credential, or rejected on failure.
   */
  override fun saveCredential(clientId: String, credential: ReadableMap, promise: Promise) {
    RNPingPushCommon.saveCredential(clientId, credential, promise)
  }

  /**
   * Deletes a credential from native storage.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param credentialId The identifier of the credential to delete.
   * @param promise Resolved with a boolean deletion result, or rejected on failure.
   */
  override fun deleteCredential(clientId: String, credentialId: String, promise: Promise) {
    RNPingPushCommon.deleteCredential(clientId, credentialId, promise)
  }

  /**
   * Updates the FCM device token, optionally scoped to one credential.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param token The new FCM registration token.
   * @param credentialId When non-null, limits the update to this credential only.
   * @param promise Resolved with the operation result, or rejected on failure.
   */
  override fun setDeviceToken(clientId: String, token: String, credentialId: String?, promise: Promise) {
    RNPingPushCommon.setDeviceToken(clientId, token, credentialId, promise)
  }

  /**
   * Returns the stored FCM device token.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with `{ token: string | null }`, or rejected on failure.
   */
  override fun getDeviceToken(clientId: String, promise: Promise) {
    RNPingPushCommon.getDeviceToken(clientId, promise)
  }

  /**
   * Parses a push notification from an FCM data payload map.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param messageData The FCM `data` payload key-value map.
   * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
   */
  override fun processNotification(clientId: String, messageData: ReadableMap, promise: Promise) {
    RNPingPushCommon.processNotification(clientId, messageData, promise)
  }

  /**
   * Parses a push notification from a raw string or JWT message body.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param message The raw string or JWT to parse.
   * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
   */
  override fun processNotificationFromMessage(clientId: String, message: String, promise: Promise) {
    RNPingPushCommon.processNotificationFromMessage(clientId, message, promise)
  }

  /**
   * Approves a pending push notification.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param notificationId The identifier of the notification to approve.
   * @param promise Resolved with the operation result, or rejected on failure.
   */
  override fun approveNotification(clientId: String, notificationId: String, promise: Promise) {
    RNPingPushCommon.approveNotification(clientId, notificationId, promise)
  }

  /**
   * Approves a challenge notification with the user-supplied response.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param notificationId The identifier of the challenge notification to approve.
   * @param challengeResponse The user's answer to the challenge presented in the notification.
   * @param promise Resolved with the operation result, or rejected on failure.
   */
  override fun approveChallengeNotification(
    clientId: String,
    notificationId: String,
    challengeResponse: String,
    promise: Promise
  ) {
    RNPingPushCommon.approveChallengeNotification(clientId, notificationId, challengeResponse, promise)
  }

  /**
   * Approves a biometric push notification.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param notificationId The identifier of the biometric notification to approve.
   * @param authenticationMethod The biometric method used (e.g. `"BIOMETRIC"`, `"DEVICE_CREDENTIALS"`).
   * @param promise Resolved with the operation result, or rejected on failure.
   */
  override fun approveBiometricNotification(
    clientId: String,
    notificationId: String,
    authenticationMethod: String,
    promise: Promise
  ) {
    RNPingPushCommon.approveBiometricNotification(clientId, notificationId, authenticationMethod, promise)
  }

  /**
   * Denies a pending push notification.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param notificationId The identifier of the notification to deny.
   * @param promise Resolved with the operation result, or rejected on failure.
   */
  override fun denyNotification(clientId: String, notificationId: String, promise: Promise) {
    RNPingPushCommon.denyNotification(clientId, notificationId, promise)
  }

  /**
   * Returns all notifications awaiting a user response.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with `{ notifications: [...] }`, or rejected on failure.
   */
  override fun getPendingNotifications(clientId: String, promise: Promise) {
    RNPingPushCommon.getPendingNotifications(clientId, promise)
  }

  /**
   * Returns all stored push notifications regardless of their response state.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with `{ notifications: [...] }`, or rejected on failure.
   */
  override fun getAllNotifications(clientId: String, promise: Promise) {
    RNPingPushCommon.getAllNotifications(clientId, promise)
  }

  /**
   * Returns a single push notification by its identifier.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param notificationId The identifier of the notification to retrieve.
   * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
   */
  override fun getNotification(clientId: String, notificationId: String, promise: Promise) {
    RNPingPushCommon.getNotification(clientId, notificationId, promise)
  }

  /**
   * Runs the notification cleanup strategy and removes expired or excess notifications.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param credentialId When non-null, limits cleanup to this credential's notifications.
   * @param promise Resolved with the number of notifications removed, or rejected on failure.
   */
  override fun cleanupNotifications(clientId: String, credentialId: String?, promise: Promise) {
    RNPingPushCommon.cleanupNotifications(clientId, credentialId, promise)
  }

  /**
   * Removes the push client from the registry and releases its resources.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with null when the client is closed, or rejected on failure.
   */
  override fun close(clientId: String, promise: Promise) {
    RNPingPushCommon.close(clientId, promise)
  }

  override fun consumePendingMessages(promise: Promise) {
    RNPingPushCommon.consumePendingMessages(promise)
  }

  /**
   * Fetches the current FCM token, registers it with the native PushClient, and resolves
   * with `{ token: string }`.
   *
   * @param clientId Opaque handle returned by [initialize].
   * @param promise Resolved with `{ token: string }` on success, or rejected on failure.
   */
  override fun refreshToken(clientId: String, promise: Promise) {
    RNPingPushCommon.refreshToken(clientId, promise)
  }

  companion object {
    const val NAME = "RNPingPush"
  }
}
