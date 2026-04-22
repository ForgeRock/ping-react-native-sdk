/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.facebook.react.bridge.Promise
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import kotlinx.serialization.SerializationException
import java.io.IOException
import java.net.MalformedURLException

/**
 * Maps Android throwables to the shared Device Client error-code contract
 * and provides helpers for rejecting React Native promises with a
 * structured [GenericError].
 *
 * Kept separate from [RNPingDeviceClientCommon] so the bridge entry points
 * stay focused on dispatch and the registry.
 */
internal object DeviceErrorClassifier {

  /**
   * Reject a promise with a [DeviceClientErrorCodes.DEVICE_CLIENT_HANDLE_NOT_FOUND] error.
   *
   * Called when the supplied handle id does not exist in the registry, which
   * typically means the client was already disposed or was never created.
   *
   * @param promise React Native promise to reject.
   */
  internal fun rejectHandleNotFound(promise: Promise) {
    promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = DeviceClientErrorCodes.DEVICE_CLIENT_HANDLE_NOT_FOUND,
        message = "Device Client handle not found. The client may have been disposed.",
      ),
    )
  }

  /**
   * Reject a promise when an unsupported device type string is supplied by JS.
   *
   * @param promise React Native promise to reject.
   * @param deviceType The unsupported device type string received from JS.
   */
  internal fun rejectInvalidType(promise: Promise, deviceType: String) {
    promise.reject(
      GenericError(
        type = ErrorType.ARGUMENT_ERROR,
        error = DeviceClientErrorCodes.DEVICE_CLIENT_ERROR,
        message = "Unsupported device type: $deviceType",
      ),
    )
  }

  /**
   * Reject a promise by classifying the given [throwable] into a structured
   * [GenericError] with an appropriate error code, error type, and optional
   * HTTP status.
   *
   * Classification is performed by [classify] using throwable types only.
   *
   * @param promise React Native promise to reject.
   * @param throwable The throwable that caused the failure.
   */
  internal fun rejectThrowable(promise: Promise, throwable: Throwable) {
    val message = throwable.message ?: "Device client operation failed."
    val (code, type, status) = classify(throwable)
    promise.reject(
      GenericError(
        type = type,
        error = code,
        message = message,
        status = status,
      ),
      throwable,
    )
  }

  /**
   * Best-effort classification of Android throwables into the shared
   * error-code union.
   *
   * No message-content parsing is performed; classification is based on throwable
   * type only. This avoids brittle coupling to free-form exception text.
   *
   * Mappings:
   * - [IOException] and subclasses -> network failures
   * - [SerializationException] -> decoding/parsing failures
   * - [IllegalArgumentException], [MalformedURLException] -> missing/invalid config
   * - all others -> unknown module error
   *
   * TODO Note: HTTP status is always `null` today, so `INVALID_TOKEN` (401),
   * `NOT_FOUND` (404), and `REQUEST_FAILED` (other non-2xx) codes are never
   * emitted on Android — ktor's `ResponseException` just lands in the
   * `IOException` branch. This gap will be addressed as part of the
   * cross-platform error-code alignment work being tracked with the
   * native SDK teams.
   *
   * @param throwable The throwable to classify.
   * @return A [Triple] of (error code, [ErrorType], optional HTTP status).
   */
  internal fun classify(throwable: Throwable): Triple<String, ErrorType, Int?> {
    return when (throwable) {
      is SerializationException -> Triple(
        DeviceClientErrorCodes.DEVICE_CLIENT_DECODING_FAILED,
        ErrorType.PARSE_ERROR,
        null,
      )
      is IllegalArgumentException, is MalformedURLException -> Triple(
        DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG,
        ErrorType.ARGUMENT_ERROR,
        null,
      )
      is IOException -> Triple(
        DeviceClientErrorCodes.DEVICE_CLIENT_NETWORK_ERROR,
        ErrorType.NETWORK_ERROR,
        null,
      )
      else -> Triple(
        DeviceClientErrorCodes.DEVICE_CLIENT_ERROR,
        ErrorType.UNKNOWN_ERROR,
        null,
      )
    }
  }
}
