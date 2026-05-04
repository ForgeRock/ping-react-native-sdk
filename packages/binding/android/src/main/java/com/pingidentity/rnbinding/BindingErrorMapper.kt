/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import android.util.Base64
import androidx.biometric.BiometricPrompt
import com.facebook.react.bridge.Promise
import com.pingidentity.device.binding.UserKey
import com.pingidentity.device.binding.authenticator.exception.BiometricAuthenticationException
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.utils.JsonBridgeMapper
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.security.KeyStore
import java.security.MessageDigest

/**
 * Rejects [promise] with a structured error payload.
 *
 * @param promise The React Native promise to reject.
 * @param code The machine-readable error code (see [BindingErrorCodes]).
 * @param message Human-readable error description.
 * @param type The error category; defaults to [ErrorType.BINDING_ERROR].
 * @param throwable Optional underlying exception to attach.
 */
internal fun rejectWithError(
  promise: Promise,
  code: String,
  message: String,
  type: ErrorType = ErrorType.BINDING_ERROR,
  throwable: Throwable? = null
) {
  val mapped = throwable?.let { mapThrowableToGenericError(it, code) }
  val resolvedType = if (type == ErrorType.BINDING_ERROR) mapped?.type ?: type else type
  val resolvedMessage = message.ifBlank { mapped?.message ?: "Unknown error" }
  val error = GenericError(type = resolvedType, error = code, message = resolvedMessage)
  try {
    promise.reject(error, throwable)
  } catch (_: Throwable) {
    promise.reject(code, resolvedMessage, throwable)
  }
}

/**
 * Builds the success payload `{ "type": "<type>" }` returned to JS on a successful bind or sign.
 *
 * @param type The result type string (e.g. `"success"`).
 */
internal fun createJourneyResultPayload(type: String): com.facebook.react.bridge.ReadableMap =
  JsonBridgeMapper.encodeJsonObject(buildJsonObject { put("type", JsonPrimitive(type)) })

/**
 * Returns true when [error] represents a user-initiated cancellation that should map to
 * [BindingErrorCodes.BINDING_CANCELLED] rather than a generic bind/sign failure.
 *
 * Covers two concrete cases:
 * - [BiometricAuthenticationException] with a cancellation error code (user pressed cancel
 *   or negative button, or the system cancelled the prompt).
 * - `GetCredentialCancellationException` from the Credential Manager API (checked by class
 *   name to avoid a hard compile-time dependency on the credentials library).
 *
 * [AbortException] (PIN collector cancelled by user) is handled separately in
 * [resolveBindingErrorCode] and does not need to be listed here.
 */
internal fun isRecoverableCancellation(error: Throwable): Boolean {
  if (error is BiometricAuthenticationException) {
    return error.errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
      error.errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
      error.errorCode == BiometricPrompt.ERROR_CANCELED ||
      error.errorCode == BiometricPrompt.ERROR_TIMEOUT
  }
  return error::class.java.name ==
    "androidx.credentials.exceptions.GetCredentialCancellationException"
}

/**
 * Maps a [Throwable] from the native Ping Binding SDK to the appropriate JS-facing error code.
 *
 * @param error The exception thrown by the native bind or sign operation.
 * @param defaultCode The fallback code to use when no specific mapping applies.
 * @return A string error code from [BindingErrorCodes].
 */
internal fun resolveBindingErrorCode(error: Throwable, defaultCode: String): String {
  val className = error::class.java.name
  return when {
    isRecoverableCancellation(error) || "AbortException" in className ->
      BindingErrorCodes.BINDING_CANCELLED
    "DeviceNotSupportedException" in className ->
      BindingErrorCodes.BINDING_UNSUPPORTED_DEVICE
    "DeviceNotRegisteredException" in className ->
      BindingErrorCodes.BINDING_NOT_REGISTERED
    "InvalidClaimException" in className ->
      BindingErrorCodes.BINDING_INVALID_CONFIG
    "KeyPermanentlyInvalidatedException" in className ->
      BindingErrorCodes.BINDING_KEY_INVALIDATED
    "BiometricAuthenticationException" in className ->
      BindingErrorCodes.BINDING_AUTH_FAILED
    "InvalidCredentialException" in className ->
      BindingErrorCodes.BINDING_AUTH_FAILED
    else -> defaultCode
  }
}

/**
 * Removes the AndroidKeyStore entry for [key].
 *
 * The alias is derived by SHA-256 hashing the user ID and Base64url-encoding the result,
 * matching the key alias convention used by the Ping Binding SDK.
 *
 * @param key The [UserKey] whose KeyStore material should be deleted.
 */
internal fun deleteKeyMaterial(key: UserKey) {
  // SHA-256 is used here as a deterministic alias derivation function, not for encryption.
  // The alias only needs to be a stable, unique string — no sensitive data is being encrypted.
  @Suppress("WeakHashFunction")
  val hash = MessageDigest.getInstance("SHA-256").digest(key.userId.toByteArray())
  val alias = Base64.encodeToString(hash, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
  KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
}
