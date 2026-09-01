/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.pingidentity.android.ContextProvider
import com.pingidentity.fido.Constants
import com.pingidentity.fido.FidoClient
import com.pingidentity.fido.FidoClientConfig
import com.pingidentity.fido.davinci.AbstractFidoCollector
import com.pingidentity.fido.davinci.FidoAuthenticationCollector
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.fido.journey.FidoAuthenticationCallback
import com.pingidentity.fido.journey.FidoRegistrationCallback
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.utils.JsonBridgeMapper
import com.pingidentity.rncore.utils.launchBridge
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Shared implementation for FIDO operations on Android.
 */
object RNPingFidoCommon {
  private const val LOGGER_ID_KEY = "loggerId"
  private const val USE_FIDO2_CLIENT_KEY = "useFido2Client"
  private const val FIDO2_COLLECTOR_TYPE = "FIDO2"
  private const val ACTION_REGISTER = "REGISTER"
  private const val ACTION_AUTHENTICATE = "AUTHENTICATE"

  /** Coroutine scope for executing FIDO operations asynchronously on the IO dispatcher. */
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /**
   * Per-call FIDO runtime configuration.
   */
  private data class CallConfig(
    val loggerId: String?,
    val useFido2Client: Boolean?
  )

  /** Guards one-time DaVinci collector serializer registration. */
  private var serializerRegistered = false

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
   * Registers the DaVinci FIDO2 collector serializer with CoreRuntime.
   *
   * The serializer emits the action-discriminated FIDO2 collector payload consumed by
   * `rn-davinci`'s node mapper. Read options through [JsonBridgeMapper.encodeJsonElement]
   * so already-transformed base64 values survive the bridge untouched. Registration is
   * safe to call multiple times; subsequent calls are no-ops.
   */
  @JvmStatic
  @Synchronized
  fun registerDaVinciSerializer() {
    if (serializerRegistered) return
    serializerRegistered = true
    CoreRuntime.registerDaVinciCollectorSerializer { collectorAny ->
      when (collectorAny) {
        is FidoRegistrationCollector -> serializeFidoCollector(
          collector = collectorAny,
          action = ACTION_REGISTER,
          optionsKey = Constants.FIELD_PUBLIC_KEY_CREDENTIAL_CREATION_OPTIONS,
          options = runCatching { collectorAny.publicKeyCredentialCreationOptions }.getOrNull()
        )
        is FidoAuthenticationCollector -> serializeFidoCollector(
          collector = collectorAny,
          action = ACTION_AUTHENTICATE,
          optionsKey = Constants.FIELD_PUBLIC_KEY_CREDENTIAL_REQUEST_OPTIONS,
          options = runCatching { collectorAny.publicKeyCredentialRequestOptions }.getOrNull()
        )
        else -> null
      }
    }
  }

  /**
   * Resets the one-shot DaVinci serializer registration guard.
   *
   * Test-only: lets each test start from an unregistered state so registration
   * behavior is asserted hermetically regardless of test order.
   */
  @VisibleForTesting
  @JvmSynthetic
  @Synchronized
  internal fun resetSerializerRegistrationForTesting() {
    serializerRegistered = false
  }

  /**
   * Builds the bridge payload for a FIDO2 collector.
   *
   * @param collector Initialized native FIDO collector.
   * @param action Ceremony action derived from the matched collector class.
   * @param optionsKey Bridge payload key for the collector's WebAuthn options.
   * @param options Transformed WebAuthn options, or null when the collector has not
   *   been initialised (the `lateinit` field throws before `init`).
   * @return Bridge payload map.
   */
  private fun serializeFidoCollector(
    collector: AbstractFidoCollector,
    action: String,
    optionsKey: String,
    options: JsonObject?
  ): Map<String, Any?> {
    val map = linkedMapOf<String, Any?>(
      "key" to collector.key,
      "type" to FIDO2_COLLECTOR_TYPE,
      "action" to action,
      "label" to collector.label,
      "required" to collector.required,
      "trigger" to collector.trigger
    )
    options?.let { map[optionsKey] = JsonBridgeMapper.encodeJsonElement(it) }
    return map
  }

  /**
   * Registers a new FIDO credential.
   *
   * @param options Registration options payload.
   * @param config Per-call configuration payload.
   * @param promise React Native promise to resolve with the registration result or reject on error.
   */
  @JvmStatic
  fun register(
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for FIDO registration."
      )
      return
    }

    executeFidoOperation(
      options = options,
      config = config,
      promise = promise,
      errorCode = FidoErrorCodes.FIDO_REGISTER_ERROR,
      invalidOptionsMessage = "Invalid FIDO registration options payload.",
      defaultFailureMessage = "FIDO registration failed.",
      operation = { client, input -> client.register(input) }
    )
  }

  /**
   * Authenticates with an existing FIDO credential.
   *
   * @param options Authentication options payload.
   * @param config Per-call configuration payload.
   * @param promise React Native promise to resolve with the authentication result or reject on error.
   */
  @JvmStatic
  fun authenticate(
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for FIDO authentication."
      )
      return
    }

    executeFidoOperation(
      options = options,
      config = config,
      promise = promise,
      errorCode = FidoErrorCodes.FIDO_AUTHENTICATE_ERROR,
      invalidOptionsMessage = "Invalid FIDO authentication options payload.",
      defaultFailureMessage = "FIDO authentication failed.",
      operation = { client, input -> client.authenticate(input) }
    )
  }

  /**
   * Executes a standalone FIDO operation with shared payload decoding and error handling.
   */
  private fun executeFidoOperation(
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise,
    errorCode: String,
    invalidOptionsMessage: String,
    defaultFailureMessage: String,
    operation: suspend (client: FidoClient, input: JsonObject) -> Result<JsonObject>
  ) {
    scope.launchBridge(promise, errorCode) {
      val input = try {
        JsonBridgeMapper.decodeReadableMap(options)
      } catch (e: IllegalArgumentException) {
        rejectWithError(
          promise = promise,
          code = errorCode,
          message = e.localizedMessage ?: invalidOptionsMessage,
          throwable = e
        )
        return@launchBridge
      }
      val client = createFidoClient(parseCallConfig(config))
      val result = operation(client, input)
      result.fold(
        onSuccess = { payload ->
          promise.resolve(JsonBridgeMapper.encodeJsonObject(payload))
        },
        onFailure = { error ->
          rejectWithError(
            promise = promise,
            code = errorCode,
            message = error.localizedMessage ?: defaultFailureMessage,
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Executes an active Journey FIDO registration callback resolved from Core runtime callbacks.
   *
   * @param journeyId Native Journey instance id.
   * @param options Optional callback execution options.
   * @param config Per-call configuration payload.
   * @param promise React Native promise to resolve with success payload or reject on error.
   */
  @JvmStatic
  fun registerForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (journeyId.isBlank()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND,
        message = "Journey id must not be empty for FIDO registration.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for Journey FIDO registration."
      )
      return
    }

    scope.launchBridge(promise, FidoErrorCodes.FIDO_REGISTER_ERROR) {
      val index = parseCallbackIndex(options)
      val callback = resolveRegistrationCallback(journeyId, index)
      if (callback == null) {
        rejectWithError(
          promise = promise,
          code = FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND,
          message = "No active FIDO registration callback found for journey $journeyId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }

      val deviceName = parseDeviceName(options)
      val result = if (deviceName == null) {
        callback.register()
      } else {
        callback.register(deviceName)
      }

      result.fold(
        onSuccess = {
          promise.resolve(createJourneyResultPayload(type = "success"))
        },
        onFailure = { error ->
          rejectWithError(
            promise = promise,
            code = FidoErrorCodes.FIDO_REGISTER_ERROR,
            message = error.localizedMessage
              ?: "Journey FIDO registration callback execution failed.",
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Executes an active Journey FIDO authentication callback resolved from Core runtime callbacks.
   *
   * @param journeyId Native Journey instance id.
   * @param options Optional callback execution options.
   * @param config Per-call configuration payload.
   * @param promise React Native promise to resolve with success payload or reject on error.
   */
  @JvmStatic
  fun authenticateForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (journeyId.isBlank()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND,
        message = "Journey id must not be empty for FIDO authentication.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for Journey FIDO authentication."
      )
      return
    }

    scope.launchBridge(promise, FidoErrorCodes.FIDO_AUTHENTICATE_ERROR) {
      val index = parseCallbackIndex(options)
      val callback = resolveAuthenticationCallback(journeyId, index)
      if (callback == null) {
        rejectWithError(
          promise = promise,
          code = FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND,
          message = "No active FIDO authentication callback found for journey $journeyId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }

      callback.authenticate().fold(
        onSuccess = {
          promise.resolve(createJourneyResultPayload(type = "success"))
        },
        onFailure = { error ->
          if (isRecoverableFidoAuthenticationFailure(error)) {
            rejectWithError(
              promise = promise,
              code = FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED,
              message = "FIDO authentication cancelled: ${error.localizedMessage ?: error}",
              throwable = error
            )
            return@fold
          }
          rejectWithError(
            promise = promise,
            code = FidoErrorCodes.FIDO_AUTHENTICATE_ERROR,
            message = error.localizedMessage
              ?: "Journey FIDO authentication callback execution failed.",
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Runs the native FIDO registration ceremony for an active DaVinci FIDO2 registration collector.
   *
   * The attestation is stored on the native collector and reaches the server through
   * `collector.payload()` during `daVinci.next()`; the resolved payload is informational.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Ceremony options payload (index).
   * @param config Per-call configuration payload.
   * @param promise React Native promise resolved with the attestation payload or rejected on error.
   */
  @JvmStatic
  fun registerForDaVinci(
    davinciId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (davinciId.isBlank()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND,
        message = "DaVinci id must not be empty for FIDO registration.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for DaVinci FIDO registration."
      )
      return
    }

    scope.launchBridge(promise, FidoErrorCodes.FIDO_REGISTER_ERROR) {
      val index = parseCallbackIndex(options)
      val collector = resolveDaVinciRegistrationCollector(davinciId, index)
      if (collector == null) {
        rejectWithError(
          promise = promise,
          code = FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND,
          message = "No active FIDO registration collector found for DaVinci $davinciId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }

      collector.register().fold(
        onSuccess = { payload ->
          promise.resolve(JsonBridgeMapper.encodeJsonObject(payload))
        },
        onFailure = { error ->
          rejectWithError(
            promise = promise,
            code = FidoErrorCodes.FIDO_REGISTER_ERROR,
            message = error.localizedMessage
              ?: "DaVinci FIDO registration ceremony failed.",
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Runs the native FIDO authentication ceremony for an active DaVinci FIDO2 authentication collector.
   *
   * The assertion is stored on the native collector and reaches the server through
   * `collector.payload()` during `daVinci.next()`; the resolved payload is informational.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Ceremony options payload (index).
   * @param config Per-call configuration payload.
   * @param promise React Native promise resolved with the assertion payload or rejected on error.
   */
  @JvmStatic
  fun authenticateForDaVinci(
    davinciId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    if (davinciId.isBlank()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND,
        message = "DaVinci id must not be empty for FIDO authentication.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }
    if (!hasForegroundActivity()) {
      rejectWithError(
        promise = promise,
        code = FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE,
        message = "No foreground activity is available for DaVinci FIDO authentication."
      )
      return
    }

    scope.launchBridge(promise, FidoErrorCodes.FIDO_AUTHENTICATE_ERROR) {
      val index = parseCallbackIndex(options)
      val collector = resolveDaVinciAuthenticationCollector(davinciId, index)
      if (collector == null) {
        rejectWithError(
          promise = promise,
          code = FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND,
          message = "No active FIDO authentication collector found for DaVinci $davinciId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }

      collector.authenticate().fold(
        onSuccess = { payload ->
          promise.resolve(JsonBridgeMapper.encodeJsonObject(payload))
        },
        onFailure = { error ->
          if (isRecoverableFidoAuthenticationFailure(error)) {
            rejectWithError(
              promise = promise,
              code = FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED,
              message = "FIDO authentication cancelled: ${error.localizedMessage ?: error}",
              throwable = error
            )
            return@fold
          }
          rejectWithError(
            promise = promise,
            code = FidoErrorCodes.FIDO_AUTHENTICATE_ERROR,
            message = error.localizedMessage
              ?: "DaVinci FIDO authentication ceremony failed.",
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Resolves a registration collector from core-exposed DaVinci collectors by davinciId and type index.
   */
  private suspend fun resolveDaVinciRegistrationCollector(
    davinciId: String,
    index: Int
  ): FidoRegistrationCollector? {
    val collectors = CoreRuntime.resolveDaVinciCollectors(davinciId) ?: return null
    return collectors.filterIsInstance<FidoRegistrationCollector>().getOrNull(index)
  }

  /**
   * Resolves an authentication collector from core-exposed DaVinci collectors by davinciId and type index.
   */
  private suspend fun resolveDaVinciAuthenticationCollector(
    davinciId: String,
    index: Int
  ): FidoAuthenticationCollector? {
    val collectors = CoreRuntime.resolveDaVinciCollectors(davinciId) ?: return null
    return collectors.filterIsInstance<FidoAuthenticationCollector>().getOrNull(index)
  }

  /**
   * Rejects a promise with the shared FIDO error contract.
   */
  private fun rejectWithError(
    promise: Promise,
    code: String,
    message: String,
    type: ErrorType = ErrorType.FIDO_ERROR,
    throwable: Throwable? = null
  ) {
    val mapped = throwable?.let { mapThrowableToGenericError(it, code) }
    val resolvedType = if (type == ErrorType.FIDO_ERROR) {
      mapped?.type ?: type
    } else {
      type
    }
    val resolvedMessage = message.ifBlank { mapped?.message ?: "Unknown error" }
    val error = GenericError(
      type = resolvedType,
      error = code,
      message = resolvedMessage
    )
    try {
      promise.reject(error, throwable)
    } catch (_: Throwable) {
      promise.reject(code, resolvedMessage, throwable)
    }
  }

  /**
   * Returns true when a foreground activity is available for FIDO UI operations.
   *
   * Some host app states can leave `ContextProvider.currentActivity` uninitialized.
   * In that case we treat it as unavailable and return a stable precondition error.
   */
  private fun hasForegroundActivity(): Boolean {
    return foregroundActivityProvider()
  }

  /**
   * Builds a FIDO client using the currently configured runtime state.
   */
  private fun createFidoClient(callConfig: CallConfig): FidoClient {
    val clientConfig = FidoClientConfig().apply {
      resolveLoggerFromCore(callConfig.loggerId)?.let { logger = it }
      callConfig.useFido2Client?.let { useFido2Client = it }
    }
    return FidoClient(clientConfig)
  }

  /**
   * Parses per-call configuration payload.
   */
  private fun parseCallConfig(config: ReadableMap): CallConfig {
    val loggerId = if (
      config.hasKey(LOGGER_ID_KEY) && config.getType(LOGGER_ID_KEY) == ReadableType.String
    ) {
      config.getString(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
    } else {
      null
    }
    val useFido2Client = if (
      config.hasKey(USE_FIDO2_CLIENT_KEY) &&
        config.getType(USE_FIDO2_CLIENT_KEY) == ReadableType.Boolean
    ) {
      config.getBoolean(USE_FIDO2_CLIENT_KEY)
    } else {
      null
    }
    return CallConfig(
      loggerId = loggerId,
      useFido2Client = useFido2Client
    )
  }

  /**
   * Resolve a native logger from the shared Core logger registry.
   *
   * @param id Logger handle identifier from JS.
   * @return Native logger instance, or null when missing/invalid.
   */
  private fun resolveLoggerFromCore(id: String?): Logger? {
    if (id.isNullOrBlank()) {
      return null
    }
    val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }

  /**
   * Resolves a registration callback from core-exposed Journey callbacks.
   */
  private suspend fun resolveRegistrationCallback(
    journeyId: String,
    index: Int
  ): FidoRegistrationCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    val matching = callbacks.filterIsInstance<FidoRegistrationCallback>()
    return matching.getOrNull(index)
  }

  /**
   * Resolves an authentication callback from core-exposed Journey callbacks.
   */
  private suspend fun resolveAuthenticationCallback(
    journeyId: String,
    index: Int
  ): FidoAuthenticationCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    val matching = callbacks.filterIsInstance<FidoAuthenticationCallback>()
    return matching.getOrNull(index)
  }

  /**
   * Parses callback index from optional Journey options payload.
   */
  private fun parseCallbackIndex(options: ReadableMap?): Int {
    if (options == null || !options.hasKey("index") || options.isNull("index")) {
      return 0
    }
    return when (options.getType("index")) {
      ReadableType.Number -> options.getDouble("index").toInt()
      ReadableType.String -> options.getString("index")?.toIntOrNull() ?: 0
      else -> 0
    }
  }

  /**
   * Parses optional Journey device name from options payload.
   */
  private fun parseDeviceName(options: ReadableMap?): String? {
    if (options == null || !options.hasKey("deviceName") || options.isNull("deviceName")) {
      return null
    }
    val raw = when (options.getType("deviceName")) {
      ReadableType.String -> options.getString("deviceName")
      ReadableType.Number -> options.getDouble("deviceName").toString()
      ReadableType.Boolean -> options.getBoolean("deviceName").toString()
      else -> null
    } ?: return null
    val normalized = raw.trim()
    return normalized.takeIf { it.isNotEmpty() }
  }

  /**
   * Builds a normalized result payload for Journey callback execution.
   */
  private fun createJourneyResultPayload(type: String): ReadableMap {
    return JsonBridgeMapper.encodeJsonObject(
      buildJsonObject {
        put("type", JsonPrimitive(type))
      }
    )
  }

  /**
   * Determines whether a FIDO authentication error is a recoverable cancellation.
   */
  private fun isRecoverableFidoAuthenticationFailure(error: Throwable): Boolean {
    val className = error::class.java.name
    return className == "androidx.credentials.exceptions.GetCredentialCancellationException" ||
      className == "androidx.credentials.exceptions.NoCredentialException"
  }

}
