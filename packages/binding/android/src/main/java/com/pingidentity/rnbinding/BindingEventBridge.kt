/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.pingidentity.device.binding.Prompt
import com.pingidentity.device.binding.UserKey
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val PIN_REQUIRED_EVENT = "RNPingBinding_PinRequired"
private const val USER_KEY_REQUIRED_EVENT = "RNPingBinding_UserKeyRequired"
private const val PIN_TIMEOUT_MS = 60_000L
private const val USER_KEY_TIMEOUT_MS = 60_000L

/** In-flight PIN requests awaiting resolution from JS, keyed by request ID. */
internal val pendingPinRequests = ConcurrentHashMap<String, CompletableDeferred<CharArray?>>()

/** In-flight user-key selection requests awaiting resolution from JS, keyed by request ID. */
internal val pendingUserKeyRequests = ConcurrentHashMap<String, CompletableDeferred<String?>>()

/**
 * Inserts a pre-seeded PIN deferred for unit tests, bypassing the JS event round-trip.
 *
 * @param requestId The request ID to register.
 * @return The deferred that the test can complete with a PIN or null.
 */
@VisibleForTesting
@JvmSynthetic
internal fun addPinRequestForTest(requestId: String): CompletableDeferred<CharArray?> {
  val deferred = CompletableDeferred<CharArray?>()
  pendingPinRequests[requestId] = deferred
  return deferred
}

/**
 * Inserts a pre-seeded user-key deferred for unit tests, bypassing the JS event round-trip.
 *
 * @param requestId The request ID to register.
 * @return The deferred that the test can complete with a key ID or null.
 */
@VisibleForTesting
@JvmSynthetic
internal fun addUserKeyRequestForTest(requestId: String): CompletableDeferred<String?> {
  val deferred = CompletableDeferred<String?>()
  pendingUserKeyRequests[requestId] = deferred
  return deferred
}

/**
 * Completes the pending PIN request identified by [requestId] with [pin].
 * Called from the JS-facing `resolvePin` bridge method.
 */
internal fun resolvePin(requestId: String, pin: String) {
  pendingPinRequests.remove(requestId)?.complete(pin.toCharArray())
}

/**
 * Cancels the pending PIN request identified by [requestId] (completes with null).
 * Called from the JS-facing `cancelPin` bridge method.
 */
internal fun cancelPin(requestId: String) {
  pendingPinRequests.remove(requestId)?.complete(null)
}

/**
 * Completes the pending user-key selection request identified by [requestId] with [keyId].
 * Called from the JS-facing `selectUserKey` bridge method.
 */
internal fun selectUserKey(requestId: String, keyId: String) {
  pendingUserKeyRequests.remove(requestId)?.complete(keyId)
}

/**
 * Cancels the pending user-key selection request identified by [requestId] (completes with null).
 * Called from the JS-facing `cancelUserKey` bridge method.
 */
internal fun cancelUserKey(requestId: String) {
  pendingUserKeyRequests.remove(requestId)?.complete(null)
}

/**
 * Emits a `RNPingBinding_PinRequired` event to JS and suspends until the user provides a PIN
 * or the collection times out.
 *
 * @param reactContext Weak reference to the React application context used for JS emission.
 * @param prompt UI strings to display in the JS PIN dialog.
 * @return The entered PIN as a [CharArray].
 * @throws RuntimeException if collection times out or is cancelled.
 */
internal suspend fun bridgePinCollector(
  reactContext: java.lang.ref.WeakReference<com.facebook.react.bridge.ReactApplicationContext>?,
  prompt: Prompt
): CharArray {
  val requestId = UUID.randomUUID().toString()
  val deferred = CompletableDeferred<CharArray?>()
  pendingPinRequests[requestId] = deferred

  val params = Arguments.createMap().apply {
    putString("requestId", requestId)
    putString("title", prompt.title)
    putString("subtitle", prompt.subtitle)
    putString("description", prompt.description)
  }
  reactContext?.get()
    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    ?.emit(PIN_REQUIRED_EVENT, params)

  val result = withTimeoutOrNull(PIN_TIMEOUT_MS) { deferred.await() }
    ?: run {
      pendingPinRequests.remove(requestId)
      throw RuntimeException("PIN collection timed out")
    }
  return result ?: throw RuntimeException("PIN collection cancelled")
}

/**
 * Emits a `RNPingBinding_UserKeyRequired` event to JS and suspends until the user selects a key
 * or the selection times out.
 *
 * @param reactContext Weak reference to the React application context used for JS emission.
 * @param keys The available [UserKey] entries to present to the user.
 * @return The selected [UserKey].
 * @throws RuntimeException if selection times out or is cancelled.
 */
internal suspend fun bridgeUserKeySelector(
  reactContext: java.lang.ref.WeakReference<com.facebook.react.bridge.ReactApplicationContext>?,
  keys: List<UserKey>
): UserKey {
  val requestId = UUID.randomUUID().toString()
  val deferred = CompletableDeferred<String?>()
  pendingUserKeyRequests[requestId] = deferred

  val keyArray = Arguments.createArray().apply {
    keys.forEach { key ->
      pushMap(Arguments.createMap().apply {
        putString("id", key.id)
        putString("userId", key.userId)
        putString("username", key.userName)
        putString("authenticationType", key.authType.name)
      })
    }
  }
  val params = Arguments.createMap().apply {
    putString("requestId", requestId)
    putArray("userKeys", keyArray)
  }
  reactContext?.get()
    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    ?.emit(USER_KEY_REQUIRED_EVENT, params)

  val selectedId = withTimeoutOrNull(USER_KEY_TIMEOUT_MS) { deferred.await() }
    ?: run {
      pendingUserKeyRequests.remove(requestId)
      throw RuntimeException("User key selection timed out")
    }
  return keys.firstOrNull { it.id == selectedId }
    ?: throw RuntimeException("User key selection cancelled")
}
