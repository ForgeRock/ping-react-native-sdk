/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.android.ContextProvider
import com.pingidentity.device.binding.UserKey
import com.pingidentity.device.binding.UserKeysStorage
import com.pingidentity.device.binding.journey.DeviceBindingCallback
import com.pingidentity.device.binding.journey.DeviceSigningVerifierCallback
import com.pingidentity.logger.NONE
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.utils.launchBridge
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.lang.ref.WeakReference

/**
 * Shared implementation for device binding and signing-verifier operations on Android.
 *
 * Delegates event bridge, option parsing, and error mapping to focused helpers:
 * - [BindingEventBridge] — PIN and user-key event bridge
 * - [BindingOptionParser] — option/config parsing and DeviceBindingConfig application
 * - [BindingErrorMapper] — error code resolution and promise rejection
 */
object RNPingBindingCommon {

  // Dispatchers.Main is required because bind/sign operations need an Activity context
  // (foreground check, biometric prompt) which must be accessed on the UI thread.
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  private val userKeysStorage: UserKeysStorage by lazy { UserKeysStorage() }

  private var reactContext: WeakReference<ReactApplicationContext>? = null

  @VisibleForTesting
  @JvmSynthetic
  internal var foregroundActivityProvider: () -> Boolean = {
    runCatching { ContextProvider.currentActivity }.getOrNull() != null
  }

  /** Initialises [ContextProvider] and retains a weak reference to the React context. */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
    this.reactContext = WeakReference(reactContext)
  }

  // ─── PIN bridge (delegated to BindingEventBridge) ────────────────────────

  @VisibleForTesting
  @JvmSynthetic
  internal fun addPinRequestForTest(requestId: String): CompletableDeferred<CharArray?> =
    com.pingidentity.rnbinding.addPinRequestForTest(requestId)

  /** Resolves a pending PIN request with the PIN entered by the user. */
  @JvmStatic
  fun resolvePin(requestId: String, pin: String) =
    com.pingidentity.rnbinding.resolvePin(requestId, pin)

  /** Cancels a pending PIN request, causing the bridge collector to throw. */
  @JvmStatic
  fun cancelPin(requestId: String) =
    com.pingidentity.rnbinding.cancelPin(requestId)

  // ─── User key bridge (delegated to BindingEventBridge) ───────────────────

  @VisibleForTesting
  @JvmSynthetic
  internal fun addUserKeyRequestForTest(requestId: String): CompletableDeferred<String?> =
    com.pingidentity.rnbinding.addUserKeyRequestForTest(requestId)

  /** Resolves a pending user-key selection request with the chosen key id. */
  @JvmStatic
  fun selectUserKey(requestId: String, keyId: String) =
    com.pingidentity.rnbinding.selectUserKey(requestId, keyId)

  /** Cancels a pending user-key selection request. */
  @JvmStatic
  fun cancelUserKey(requestId: String) =
    com.pingidentity.rnbinding.cancelUserKey(requestId)

  // ─── Journey operations ──────────────────────────────────────────────────

  /**
   * Executes the active [DeviceBindingCallback] for [journeyId].
   *
   * Resolves the promise with a `{ type: "success" }` payload on success,
   * or rejects with a [BindingErrorCodes] code on failure.
   */
  @JvmStatic
  fun bindForJourney(journeyId: String, options: ReadableMap, config: ReadableMap, promise: Promise) {
    val callConfig = parseConfig(config)
    val resolvedLogger = resolveLoggerFromCore(callConfig.loggerId)
    if (journeyId.isBlank()) {
      rejectWithError(promise, BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND,
        "Journey id must not be empty for device binding.", ErrorType.ARGUMENT_ERROR)
      return
    }
    if (!foregroundActivityProvider()) {
      rejectWithError(promise, BindingErrorCodes.BINDING_UI_UNAVAILABLE,
        "No foreground activity is available for Journey device binding.")
      return
    }
    scope.launchBridge(promise, BindingErrorCodes.BINDING_BIND_ERROR) {
      val index = parseCallbackIndex(options)
      val callback = resolveDeviceBindingCallback(journeyId, index)
      if (callback == null) {
        rejectWithError(promise, BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND,
          "No active DeviceBindingCallback found for journey $journeyId at index $index.",
          ErrorType.STATE_ERROR)
        return@launchBridge
      }
      val jsDeviceName = parseStringOption(options, "deviceName")
      val jsSigningAlgorithm = parseStringOption(options, "signingAlgorithm")
      callback.bind {
        logger = resolvedLogger ?: Logger.NONE
        jsDeviceName?.let { deviceName = it }
        jsSigningAlgorithm?.let { signingAlgorithm = it }
        applyCommonBindingConfig(this, options, callConfig.userKeyStorageId)
        if (callConfig.hasPinCollector) {
          appPinConfig { pinCollector { prompt -> bridgePinCollector(reactContext, prompt) } }
        }
      }.fold(
        onSuccess = { promise.resolve(createJourneyResultPayload("success")) },
        onFailure = { error ->
          rejectWithError(promise, resolveBindingErrorCode(error, BindingErrorCodes.BINDING_BIND_ERROR),
            error.localizedMessage ?: "Journey device binding callback execution failed.", throwable = error)
        }
      )
    }
  }

  /**
   * Executes the active [DeviceSigningVerifierCallback] for [journeyId].
   *
   * Resolves the promise with a `{ type: "success" }` payload on success,
   * or rejects with a [BindingErrorCodes] code on failure.
   */
  @JvmStatic
  fun signForJourney(journeyId: String, options: ReadableMap, config: ReadableMap, promise: Promise) {
    val callConfig = parseConfig(config)
    val resolvedLogger = resolveLoggerFromCore(callConfig.loggerId)
    if (journeyId.isBlank()) {
      rejectWithError(promise, BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND,
        "Journey id must not be empty for device signing.", ErrorType.ARGUMENT_ERROR)
      return
    }
    if (!foregroundActivityProvider()) {
      rejectWithError(promise, BindingErrorCodes.BINDING_UI_UNAVAILABLE,
        "No foreground activity is available for Journey device signing.")
      return
    }
    scope.launchBridge(promise, BindingErrorCodes.BINDING_SIGN_ERROR) {
      val index = parseCallbackIndex(options)
      val callback = resolveDeviceSigningVerifierCallback(journeyId, index)
      if (callback == null) {
        rejectWithError(promise, BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND,
          "No active DeviceSigningVerifierCallback found for journey $journeyId at index $index.",
          ErrorType.STATE_ERROR)
        return@launchBridge
      }
      val jsSigningAlgorithm = parseStringOption(options, "signingAlgorithm")
      val jsClaims = parseClaims(options)
      callback.sign {
        logger = resolvedLogger ?: Logger.NONE
        jsSigningAlgorithm?.let { signingAlgorithm = it }
        if (jsClaims.isNotEmpty()) { claims { putAll(jsClaims) } }
        applyCommonBindingConfig(this, options, callConfig.userKeyStorageId)
        if (callConfig.hasPinCollector) {
          appPinConfig { pinCollector { prompt -> bridgePinCollector(reactContext, prompt) } }
        }
        if (callConfig.hasUserKeySelector) {
          userKeySelector { keys -> bridgeUserKeySelector(reactContext, keys) }
        }
      }.fold(
        onSuccess = { promise.resolve(createJourneyResultPayload("success")) },
        onFailure = { error ->
          rejectWithError(promise, resolveBindingErrorCode(error, BindingErrorCodes.BINDING_SIGN_ERROR),
            error.localizedMessage ?: "Journey device signing callback execution failed.", throwable = error)
        }
      )
    }
  }

  // ─── Key management ──────────────────────────────────────────────────────

  /** Returns all registered device binding keys from [UserKeysStorage] as a JS array. */
  @JvmStatic
  fun getAllKeys(promise: Promise) {
    scope.launchBridge(promise, BindingErrorCodes.BINDING_ERROR) {
      val storage = userKeysStorage
      val result = com.facebook.react.bridge.Arguments.createArray().apply {
        storage.findAll().forEach { key ->
          pushMap(com.facebook.react.bridge.Arguments.createMap().apply {
            putString("id", key.id)
            putString("userId", key.userId)
            putString("username", key.userName)
            putString("authenticationType", key.authType.name)
          })
        }
      }
      promise.resolve(result)
    }
  }

  /** Deletes the key identified by [userId] and [keyId], including its KeyStore material. */
  @JvmStatic
  fun deleteKey(userId: String, keyId: String, promise: Promise) {
    scope.launchBridge(promise, BindingErrorCodes.BINDING_KEY_DELETE_ERROR) {
      val storage = userKeysStorage
      val key = storage.findAll().firstOrNull { it.id == keyId && it.userId == userId }
      if (key == null) {
        rejectWithError(promise, BindingErrorCodes.BINDING_KEY_DELETE_ERROR,
          "No binding key found.", ErrorType.STATE_ERROR)
        return@launchBridge
      }
      deleteKeyMaterial(key)
      storage.delete(key)
      promise.resolve(null)
    }
  }

  /** Deletes all registered device binding keys, including their KeyStore material. */
  @JvmStatic
  fun deleteAllKeys(promise: Promise) {
    scope.launchBridge(promise, BindingErrorCodes.BINDING_KEY_DELETE_ERROR) {
      val storage = userKeysStorage
      val errors = mutableListOf<String>()
      storage.findAll().forEach { key ->
        runCatching {
          deleteKeyMaterial(key)
          storage.delete(key)
        }.onFailure { errors.add(it.localizedMessage ?: "Failed to delete key.") }
      }
      if (errors.isEmpty()) {
        promise.resolve(null)
      } else {
        rejectWithError(promise, BindingErrorCodes.BINDING_KEY_DELETE_ERROR,
          errors.joinToString("; "))
      }
    }
  }

  // ─── Callback resolvers ──────────────────────────────────────────────────

  /** Returns the nth [DeviceBindingCallback] registered under [journeyId], or null when absent. */
  private suspend fun resolveDeviceBindingCallback(journeyId: String, index: Int): DeviceBindingCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<DeviceBindingCallback>().getOrNull(index)
  }

  /** Returns the nth [DeviceSigningVerifierCallback] registered under [journeyId], or null when absent. */
  private suspend fun resolveDeviceSigningVerifierCallback(journeyId: String, index: Int): DeviceSigningVerifierCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<DeviceSigningVerifierCallback>().getOrNull(index)
  }
}
