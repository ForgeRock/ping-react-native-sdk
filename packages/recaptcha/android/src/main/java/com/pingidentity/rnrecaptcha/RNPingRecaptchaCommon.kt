/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.recaptcha.RecaptchaAction
import com.google.android.recaptcha.RecaptchaException
import com.pingidentity.android.ContextProvider
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.utils.JsonBridgeMapper
import com.pingidentity.rncore.utils.launchBridge
import com.pingidentity.recaptcha.enterprise.ReCaptchaEnterpriseCallback
import com.pingidentity.recaptcha.enterprise.ReCaptchaEnterpriseConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Shared implementation for reCAPTCHA Enterprise operations on Android.
 *
 * Verification outcomes resolve as discriminated payloads —
 * `{ type: "success", token }` or `{ type: "failure", code, message }` —
 * because the native `verify()` auto-submits the token or client error into
 * the callback inputs on both paths and the server expects `next()` to
 * proceed. Only bridge-level failures (blank journey id, missing callback,
 * unexpected native errors) reject the promise.
 *
 * NOTE: the dispatcher is [Dispatchers.Default] — the upstream `verify()` body
 * already wraps its work in `withContext(Dispatchers.IO)`, so the SDK owns
 * dispatching and the bridge adds no blocking I/O of its own.
 */
internal object RNPingRecaptchaCommon {
    private const val LOGGER_ID_KEY = "loggerId"
    private const val INDEX_KEY = "index"
    private const val ACTION_KEY = "action"
    private const val TIMEOUT_MS_KEY = "timeoutMs"
    private const val PAYLOAD_KEY = "payload"

    private const val DEFAULT_TIMEOUT_MS = 15000L
    private const val RESULT_TYPE_KEY = "type"
    private const val RESULT_TOKEN_KEY = "token"
    private const val RESULT_CODE_KEY = "code"
    private const val RESULT_MESSAGE_KEY = "message"
    private const val RESULT_TYPE_SUCCESS = "success"
    private const val RESULT_TYPE_FAILURE = "failure"

    /** Default action name mirroring the upstream `RecaptchaAction.LOGIN` default. */
    private const val DEFAULT_ACTION = "login"

    /**
     * Coroutine scope for executing reCAPTCHA verifications asynchronously.
     *
     * Cancelled and recreated on module invalidation so in-flight verifications
     * do not outlive the bridge module.
     */
    private var scope: CoroutineScope = createScope()

    /**
     * Configures the application context required by the Ping native SDKs.
     *
     * @param reactContext React Native application context.
     */
    @JvmStatic
    fun configure(reactContext: ReactApplicationContext) {
        ContextProvider.init(reactContext.applicationContext)
    }

    /**
     * Releases shared runtime state and cancels in-flight verifications.
     *
     * Wired to the module `invalidate()` lifecycle; a subsequent call to any
     * bridge method transparently recreates the scope.
     */
    @JvmStatic
    @Synchronized
    fun cleanup() {
        scope.cancel()
        scope = createScope()
    }

    /**
     * Executes the active Journey `ReCaptchaEnterpriseCallback` resolved from
     * the Core callback resolver.
     *
     * @param journeyId Native Journey instance id.
     * @param options Verification options payload (index, action, timeoutMs, payload).
     * @param config Per-call configuration payload (loggerId).
     * @param promise React Native promise resolved with the result payload or
     *   rejected on bridge-level failure.
     */
    @JvmStatic
    fun verifyForJourney(
        journeyId: String,
        options: ReadableMap?,
        config: ReadableMap?,
        promise: Promise
    ) {
        if (journeyId.isBlank()) {
            rejectWithError(
                promise = promise,
                code = RecaptchaErrorCodes.RECAPTCHA_ERROR,
                message = "Journey id must not be empty for reCAPTCHA verification.",
                type = ErrorType.ARGUMENT_ERROR
            )
            return
        }

        val callConfig = parseCallConfig(config)
        val parsedOptions = parseVerifyOptions(options)

        scope.launchBridge(promise, RecaptchaErrorCodes.RECAPTCHA_VERIFY_ERROR) {
            try {
                executeVerification(journeyId, parsedOptions, callConfig, promise)
            } catch (e: RecaptchaException) {
                // Surface Google's error taxonomy on the rejection path; the
                // failure-inside-Result path resolves as a failure payload instead.
                rejectWithError(
                    promise = promise,
                    code = RecaptchaErrorCodes.RECAPTCHA_VERIFY_ERROR,
                    message = e.errorMessage ?: e.message
                        ?: "reCAPTCHA Enterprise verification failed.",
                    type = ErrorType.INTERNAL_ERROR,
                    throwable = e
                )
            }
        }
    }

    /**
     * Resolves the callback and runs verification, settling the promise with
     * the outcome payload.
     *
     * @param journeyId Native Journey instance id.
     * @param parsedOptions Parsed verification options.
     * @param callConfig Per-call configuration.
     * @param promise React Native promise to settle.
     */
    private suspend fun executeVerification(
        journeyId: String,
        parsedOptions: VerifyOptions,
        callConfig: CallConfig,
        promise: Promise
    ) {
        val index = parsedOptions.index
        val callback = resolveEnterpriseCallback(journeyId, index)
        if (callback == null) {
            rejectWithError(
                promise = promise,
                code = RecaptchaErrorCodes.RECAPTCHA_CALLBACK_NOT_FOUND,
                message = "No active ReCaptchaEnterpriseCallback found for journey $journeyId at index $index.",
                type = ErrorType.STATE_ERROR
            )
            return
        }

        val result = callback.verify {
            recaptchaAction = mapAction(parsedOptions.action)
            timeoutInMills = parsedOptions.timeoutMs
            customPayload = parsedOptions.payload
            resolveLoggerFromCore(callConfig.loggerId)?.let { logger = it }
        }

        result.fold(
            onSuccess = { token ->
                promise.resolve(
                    createResultPayload(
                        type = RESULT_TYPE_SUCCESS,
                        token = token
                    )
                )
            },
            onFailure = { error ->
                // Verification failure resolves (never rejects): the native
                // callback has already recorded the client error into its
                // inputs, so the server expects `next()` to proceed.
                promise.resolve(
                    createResultPayload(
                        type = RESULT_TYPE_FAILURE,
                        code = RecaptchaErrorMapper.failureCode(error),
                        message = RecaptchaErrorMapper.failureMessage(error)
                    )
                )
            }
        )
    }

    /**
     * Resolves the Journey `ReCaptchaEnterpriseCallback` at the given type index.
     *
     * @param journeyId Native Journey instance id.
     * @param index Zero-based index among the active enterprise callbacks.
     * @return The resolved callback, or null when the journey is unknown or no
     *   callback exists at the index.
     */
    private suspend fun resolveEnterpriseCallback(
        journeyId: String,
        index: Int
    ): ReCaptchaEnterpriseCallback? {
        val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
        return callbacks.filterIsInstance<ReCaptchaEnterpriseCallback>().getOrNull(index)
    }

    /**
     * Maps a JS action name to the Google `RecaptchaAction` representation.
     *
     * @param action Action name from JS options.
     * @return `RecaptchaAction.LOGIN` for `"login"`, `RecaptchaAction.SIGNUP`
     *   for `"signup"`, otherwise a custom action.
     */
    private fun mapAction(action: String): RecaptchaAction {
        return when (action) {
            "login" -> RecaptchaAction.LOGIN
            "signup" -> RecaptchaAction.SIGNUP
            else -> RecaptchaAction.custom(action)
        }
    }

    /**
     * Parsed verification options.
     *
     * @property index Zero-based index among the active enterprise callbacks.
     * @property action Action name mapped to a Google `RecaptchaAction`.
     * @property timeoutMs Verification timeout in milliseconds.
     * @property payload Custom risk-assessment metadata, when supplied.
     */
    private data class VerifyOptions(
        val index: Int,
        val action: String,
        val timeoutMs: Long,
        val payload: JsonObject?
    )

    /**
     * Parses verification options from the JS payload.
     *
     * @param options Options map from JS, or null when absent.
     * @return Parsed options with defaults applied (index 0, action "login",
     *   timeout 15000ms, no payload).
     */
    private fun parseVerifyOptions(options: ReadableMap?): VerifyOptions {
        if (options == null) {
            return VerifyOptions(
                index = 0,
                action = DEFAULT_ACTION,
                timeoutMs = DEFAULT_TIMEOUT_MS,
                payload = null
            )
        }
        return VerifyOptions(
            index = parseCallbackIndex(options),
            action = readString(options, ACTION_KEY) ?: DEFAULT_ACTION,
            timeoutMs = parseTimeoutMs(options),
            payload = parsePayload(options)
        )
    }

    /**
     * Parses the callback index from the options payload.
     *
     * @param options Options map from JS.
     * @return Zero-based index, or 0 when absent or malformed.
     */
    private fun parseCallbackIndex(options: ReadableMap): Int {
        if (!options.hasKey(INDEX_KEY) || options.isNull(INDEX_KEY)) {
            return 0
        }
        return when (options.getType(INDEX_KEY)) {
            ReadableType.Number -> options.getDouble(INDEX_KEY).toInt()
            ReadableType.String -> options.getString(INDEX_KEY)?.toIntOrNull() ?: 0
            else -> 0
        }
    }

    /**
     * Parses the verification timeout from the options payload.
     *
     * @param options Options map from JS.
     * @return Timeout in milliseconds, or the default when absent or not a
     *   number. A supplied negative value passes through so Google's SDK
     *   surfaces its own `INVALID_TIMEOUT` taxonomy rather than the bridge
     *   silently substituting the default.
     */
    private fun parseTimeoutMs(options: ReadableMap): Long {
        if (!options.hasKey(TIMEOUT_MS_KEY) || options.isNull(TIMEOUT_MS_KEY)) {
            return DEFAULT_TIMEOUT_MS
        }
        if (options.getType(TIMEOUT_MS_KEY) != ReadableType.Number) {
            return DEFAULT_TIMEOUT_MS
        }
        return options.getDouble(TIMEOUT_MS_KEY).toLong()
    }

    /**
     * Parses the custom payload from the options payload.
     *
     * @param options Options map from JS.
     * @return Parsed JSON object, or null when the key is absent or not an object.
     */
    private fun parsePayload(options: ReadableMap): JsonObject? {
        if (!options.hasKey(PAYLOAD_KEY) || options.isNull(PAYLOAD_KEY)) {
            return null
        }
        if (options.getType(PAYLOAD_KEY) != ReadableType.Map) {
            return null
        }
        val map = options.getMap(PAYLOAD_KEY) ?: return null
        return JsonBridgeMapper.decodeReadableMap(map)
    }

    /**
     * Reads an optional string value from the options payload.
     *
     * @param map Options map.
     * @param key Key to read.
     * @return Trimmed string value, or null when absent, not a string, or blank.
     */
    private fun readString(map: ReadableMap, key: String): String? {
        if (!map.hasKey(key) || map.isNull(key)) {
            return null
        }
        if (map.getType(key) != ReadableType.String) {
            return null
        }
        return map.getString(key)?.trim()?.takeIf { it.isNotEmpty() }
    }

    /**
     * Per-call runtime configuration.
     *
     * @property loggerId Native logger handle id resolved via Core, when supplied.
     */
    private data class CallConfig(val loggerId: String?)

    /**
     * Parses the per-call configuration payload.
     *
     * @param config Config map from JS, or null when absent.
     * @return Parsed configuration.
     */
    private fun parseCallConfig(config: ReadableMap?): CallConfig {
        val loggerId = if (
            config != null &&
            config.hasKey(LOGGER_ID_KEY) &&
            config.getType(LOGGER_ID_KEY) == ReadableType.String
        ) {
            config.getString(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
        } else {
            null
        }
        return CallConfig(loggerId = loggerId)
    }

    /**
     * Resolves a native logger from the shared Core logger registry.
     *
     * @param id Logger handle identifier from JS.
     * @return Native logger instance, or null when missing or invalid.
     */
    private fun resolveLoggerFromCore(id: String?): Logger? {
        if (id.isNullOrBlank()) {
            return null
        }
        val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
        return handle.nativeLogger as? Logger
    }

    /**
     * Builds the bridge payload for a verification outcome.
     *
     * @param type Discriminant: `"success"` or `"failure"`.
     * @param token Verification token (success only).
     * @param code Failure code (failure only).
     * @param message Failure message (failure only).
     * @return Encoded payload map.
     */
    private fun createResultPayload(
        type: String,
        token: String? = null,
        code: String? = null,
        message: String? = null
    ) = JsonBridgeMapper.encodeJsonObject(
        buildJsonObject {
            put(RESULT_TYPE_KEY, JsonPrimitive(type))
            token?.let { put(RESULT_TOKEN_KEY, JsonPrimitive(it)) }
            code?.let { put(RESULT_CODE_KEY, JsonPrimitive(it)) }
            message?.let { put(RESULT_MESSAGE_KEY, JsonPrimitive(it)) }
        }
    )

    /**
     * Rejects a promise with the shared reCAPTCHA error contract.
     *
     * @param promise React Native promise to reject.
     * @param code Stable module-specific error code.
     * @param message Human-readable failure description.
     * @param type Error type classification for JS branching.
     * @param throwable Optional native throwable preserved for diagnostics.
     */
    private fun rejectWithError(
        promise: Promise,
        code: String,
        message: String,
        type: ErrorType = ErrorType.INTERNAL_ERROR,
        throwable: Throwable? = null
    ) {
        val mapped = throwable?.let { mapThrowableToGenericError(it, code) }
        val resolvedType = if (type == ErrorType.INTERNAL_ERROR && mapped != null) {
            mapped.type
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
     * Creates the coroutine scope used by verification calls.
     *
     * @return A fresh scope on the default dispatcher tied to a supervisor job.
     */
    @VisibleForTesting
    @JvmSynthetic
    internal fun createScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
}
