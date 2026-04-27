/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import android.content.ActivityNotFoundException
import android.net.Uri
import androidx.annotation.VisibleForTesting
import androidx.core.net.toUri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.android.ContextProvider
import com.pingidentity.idp.IdpCanceledException
import com.pingidentity.idp.UnsupportedIdPException
import com.pingidentity.idp.journey.IdpCallback
import com.pingidentity.idp.journey.SelectIdpCallback
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.utils.JsonBridgeMapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Shared implementation for External IdP operations on Android.
 */
object RNPingExternalIdpCommon {
  private const val LOGGER_ID_KEY = "loggerId"
  private const val REDIRECT_URI_KEY = "redirectUri"
  private const val INDEX_KEY = "index"

  /** Coroutine scope for executing External IdP operations asynchronously on the IO dispatcher. */
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /**
   * Per-call External IdP runtime configuration.
   */
  private data class CallConfig(val loggerId: String?, val redirectUri: String)

  /**
   * Activity availability provider used by runtime checks and overridable in tests.
   */
  @VisibleForTesting
  @JvmSynthetic
  internal var foregroundActivityProvider: () -> Boolean = {
    runCatching { ContextProvider.currentActivity }
      .getOrNull() != null
  }

  /**
   * Configure application context required by Ping native SDKs.
   */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
  }

  /**
   * Launches the external IdP authorization flow for an active Journey IdpCallback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Per-call options payload (index).
   * @param config Per-call configuration payload (loggerId, redirectUri).
   * @param promise React Native promise resolved with ExternalIdpResult or rejected on error.
   */
  @JvmStatic
  fun authorizeForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    if (journeyId.isBlank()) {
      logger?.w("External IdP authorizeForJourney rejected because journey id was empty", null)
      rejectWithError(
        promise = promise,
        code = ExternalIdpErrorCodes.CALLBACK_NOT_FOUND,
        message = "Journey id must not be empty for external IdP authorization.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    if (!hasForegroundActivity()) {
      logger?.w(
        "External IdP authorizeForJourney rejected because no foreground activity is available",
        null
      )
      rejectWithError(
        promise = promise,
        code = ExternalIdpErrorCodes.ACTIVITY_UNAVAILABLE,
        message = "No foreground activity available for external IdP authorization."
      )
      return
    }

    scope.launch {
      try {
        val index = parseCallbackIndex(options)
        logger?.i("External IdP authorizeForJourney requested for callback index $index")
        val callback = resolveIdpCallback(journeyId, index)
        if (callback == null) {
          logger?.w("External IdP authorizeForJourney callback not found at index $index", null)
          rejectWithError(
            promise = promise,
            code = ExternalIdpErrorCodes.CALLBACK_NOT_FOUND,
            message = "No active IdP callback found for journey $journeyId at index $index.",
            type = ErrorType.STATE_ERROR
          )
          return@launch
        }
        val parsedRedirectUri = try {
          parseRedirectUri(callConfig.redirectUri, callback.provider)
        } catch (e: IllegalArgumentException) {
          logger?.w("External IdP authorizeForJourney rejected because redirect URI was invalid", e)
          rejectWithError(
            promise = promise,
            code = ExternalIdpErrorCodes.CONFIG_ERROR,
            message = e.localizedMessage ?: "Redirect URI is invalid.",
            type = ErrorType.ARGUMENT_ERROR,
            throwable = e
          )
          return@launch
        }

        // TODO: Add browser fallback here when the Android native SDK supports it for AIC Journey flows.
        val result = withContext(Dispatchers.Main) {
          parsedRedirectUri?.let { callback.authorize(it) } ?: callback.authorize()
        }

        result.fold(
          onSuccess = { idpResult ->
            logger?.d("External IdP authorizeForJourney succeeded")
            val resultJson = buildJsonObject {
              put("token", JsonPrimitive(idpResult.token))
              put(
                "additionalParameters",
                buildJsonObject {
                  idpResult.additionalParameters.forEach { (k, v) -> put(k, JsonPrimitive(v)) }
                }
              )
            }
            promise.resolve(JsonBridgeMapper.encodeJsonObject(resultJson))
          },
          onFailure = { error ->
            val (code, message) = discriminateIdpError(error)
            logger?.e("External IdP authorizeForJourney failed with code $code", error)
            rejectWithError(
              promise = promise,
              code = code,
              message = message,
              throwable = error
            )
          }
        )
      } catch (e: Throwable) {
        when (e) {
          is ClassNotFoundException, is NoClassDefFoundError -> {
            logger?.e("External IdP authorizeForJourney failed because provider SDK is unavailable", e)
            rejectWithError(
              promise = promise,
              code = ExternalIdpErrorCodes.UNSUPPORTED_PROVIDER,
              message = "Native provider SDK is not available: ${e.message}",
              throwable = e
            )
          }
          else -> {
            val (code, message) = discriminateIdpError(e)
            logger?.e("External IdP authorizeForJourney failed with code $code", e)
            rejectWithError(
              promise = promise,
              code = code,
              message = message,
              throwable = e
            )
          }
        }
      }
    }
  }

  /**
   * Mutates the native SelectIdpCallback state for an active Journey.
   *
   * Journey's JourneyCallbackValueApplier blocks SelectIdPCallback and throws
   * MissingIntegrationException when it appears in a journey.next() payload. This bridge
   * call must be made before journey.next() so the callback state is already populated natively.
   *
   * @param journeyId Native Journey instance id.
   * @param provider The provider string selected by the user.
   * @param options Per-call options payload (index).
   * @param config Per-call configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun setSelectedProvider(
    journeyId: String,
    provider: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    val logger = resolveCallLogger(config)
    if (journeyId.isBlank()) {
      logger?.w("External IdP select provider rejected because journey id was empty", null)
      rejectWithError(
        promise = promise,
        code = ExternalIdpErrorCodes.CALLBACK_NOT_FOUND,
        message = "Journey id must not be empty for setting selected provider.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    val selectedProvider = provider.trim()
    if (selectedProvider.isBlank()) {
      logger?.w("External IdP select provider rejected because provider was empty", null)
      rejectWithError(
        promise = promise,
        code = ExternalIdpErrorCodes.CONFIG_ERROR,
        message = "Provider must not be empty for external IdP selection.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }

    scope.launch {
      try {
        val index = parseCallbackIndex(options)
        logger?.i("External IdP select provider requested for callback index $index")
        val callback = resolveSelectIdpCallback(journeyId, index)
        if (callback == null) {
          logger?.w("External IdP select provider callback not found at index $index", null)
          rejectWithError(
            promise = promise,
            code = ExternalIdpErrorCodes.CALLBACK_NOT_FOUND,
            message = "No active SelectIdp callback found for journey $journeyId at index $index.",
            type = ErrorType.STATE_ERROR
          )
          return@launch
        }

        callback.value = selectedProvider
        logger?.d("External IdP select provider succeeded")
        promise.resolve(null)
      } catch (e: Throwable) {
        logger?.e("External IdP select provider failed", e)
        rejectWithError(
          promise = promise,
          code = ExternalIdpErrorCodes.CONFIG_ERROR,
          message = e.localizedMessage ?: "Failed to set selected provider.",
          throwable = e
        )
      }
    }
  }

  /**
   * Rejects a promise with the shared External IdP error contract.
   */
  private fun rejectWithError(
    promise: Promise,
    code: String,
    message: String,
    type: ErrorType? = null,
    throwable: Throwable? = null
  ) {
    val mapped = throwable?.let { mapThrowableToGenericError(it, code) }
    val resolvedType = type ?: mapped?.type ?: ErrorType.AUTH_ERROR
    val resolvedMessage = message.ifBlank { mapped?.message ?: "Unknown error" }
    val error = GenericError(
      type = resolvedType,
      error = code,
      message = resolvedMessage
    )
    promise.reject(error, throwable)
  }

  /**
   * Returns whether a foreground Android activity is available for UI-based authorization.
   */
  private fun hasForegroundActivity(): Boolean = foregroundActivityProvider()

  /**
   * Parses and validates the optional redirect URI passed to the native External IdP SDK.
   *
   * @param redirectUri Optional app return URI configured for Auth Tab-capable devices.
   * @param provider IdP provider resolved from the active Journey callback.
   * @return Parsed Android URI, or null to delegate to native defaults.
   * @throws IllegalArgumentException when an Apple redirect URI is missing a scheme.
   */
  private fun parseRedirectUri(redirectUri: String, provider: String): Uri? {
    val trimmed = redirectUri.trim()
    if (trimmed.isEmpty()) return null
    val uri = trimmed.toUri()
    require(!isAppleProvider(provider) || !uri.scheme.isNullOrBlank()) {
      "Redirect URI must include a URI scheme for external IdP authorization."
    }
    return uri
  }

  /**
   * Returns whether the Journey IdP provider requires a redirect URI override.
   *
   * @param provider IdP provider resolved from the active Journey callback.
   * @return True when the provider is Apple, false otherwise.
   */
  private fun isAppleProvider(provider: String): Boolean {
    return provider.contains("apple", ignoreCase = true)
  }

  /**
   * Resolves the configured per-call logger.
   *
   * @param config Per-call configuration payload.
   * @return Native logger resolved from Core, or null when no valid logger is configured.
   */
  private fun resolveCallLogger(config: ReadableMap): Logger? {
    return resolveLoggerFromCore(parseCallConfig(config).loggerId)
  }

  /**
   * Parses per-call configuration payload.
   *
   * @param config Per-call configuration payload.
   * @return Parsed External IdP runtime configuration.
   */
  private fun parseCallConfig(config: ReadableMap): CallConfig {
    val loggerId = if (
      config.hasKey(LOGGER_ID_KEY) && config.getType(LOGGER_ID_KEY) == ReadableType.String
    ) {
      config.getString(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
    } else {
      null
    }
    val redirectUri = if (
      config.hasKey(REDIRECT_URI_KEY) && config.getType(REDIRECT_URI_KEY) == ReadableType.String
    ) {
      config.getString(REDIRECT_URI_KEY)?.trim() ?: ""
    } else {
      ""
    }
    return CallConfig(loggerId = loggerId, redirectUri = redirectUri)
  }

  /**
   * Resolve a native logger from the shared Core logger registry.
   *
   * @param id Logger handle identifier from JS.
   * @return Native logger instance, or null when missing/invalid.
   */
  private fun resolveLoggerFromCore(id: String?): Logger? {
    if (id.isNullOrBlank()) return null
    val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }

  /**
   * Resolves an IdpCallback from core-exposed Journey callbacks by journeyId and type index.
   */
  private suspend fun resolveIdpCallback(journeyId: String, index: Int): IdpCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<IdpCallback>().getOrNull(index)
  }

  /**
   * Resolves a SelectIdpCallback from core-exposed Journey callbacks by journeyId and type index.
   */
  private suspend fun resolveSelectIdpCallback(journeyId: String, index: Int): SelectIdpCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<SelectIdpCallback>().getOrNull(index)
  }

  /**
   * Parses the callback type index from options, defaulting to 0.
   */
  private fun parseCallbackIndex(options: ReadableMap?): Int {
    if (options == null || !options.hasKey(INDEX_KEY) || options.isNull(INDEX_KEY)) return 0
    return when (options.getType(INDEX_KEY)) {
      ReadableType.Number -> options.getDouble(INDEX_KEY).toInt()
      ReadableType.String -> options.getString(INDEX_KEY)?.toIntOrNull() ?: 0
      else -> 0
    }
  }

  /**
   * Maps an IdP authorize failure to its error code and message.
   */
  private fun discriminateIdpError(error: Throwable): Pair<String, String> = when {
    error is IdpCanceledException || isCredentialCancellation(error) ->
      ExternalIdpErrorCodes.CANCELLED to
        (error.localizedMessage ?: "User cancelled external IdP authorization.")
    error is UnsupportedIdPException ->
      ExternalIdpErrorCodes.UNSUPPORTED_PROVIDER to
        (error.localizedMessage ?: "Unsupported IdP provider.")
    error is IllegalArgumentException ->
      ExternalIdpErrorCodes.CONFIG_ERROR to
        (error.localizedMessage ?: "External IdP provider configuration is invalid.")
    error is ActivityNotFoundException ->
      ExternalIdpErrorCodes.ACTIVITY_UNAVAILABLE to
        (error.localizedMessage ?: "No activity available for external IdP authorization.")
    else ->
      ExternalIdpErrorCodes.AUTHORIZE_ERROR to
        (error.localizedMessage ?: "External IdP authorization failed.")
  }

  /**
   * Returns whether the throwable chain represents an Android Credential Manager cancellation.
   *
   * @param error Throwable emitted by the native IdP SDK.
   * @return True when AndroidX Credential Manager reported user cancellation or reauth cancellation.
   */
  private fun isCredentialCancellation(error: Throwable): Boolean {
    var current: Throwable? = error
    while (current != null) {
      val className = current::class.qualifiedName
      val simpleName = current::class.simpleName
      if (
        className == "androidx.credentials.exceptions.GetCredentialCancellationException" ||
        simpleName == "GetCredentialCancellationException"
      ) {
        return true
      }
      current = current.cause
    }
    return false
  }
}
