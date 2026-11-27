/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecognize

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.recognize.RecognizeException
import com.pingidentity.recognize.davinci.AbstractRecognizeCollector
import com.pingidentity.recognize.journey.AbstractRecognizeCallback
import com.pingidentity.recognize.journey.PingOneRecognizeAuthenticateCallback
import com.pingidentity.recognize.journey.PingOneRecognizeEnrollCallback
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.utils.JsonBridgeMapper
import com.pingidentity.rncore.utils.launchBridge
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Shared Recognize bridge implementation consumed by the TurboModule entry point.
 *
 * The native Recognize callbacks read the server configuration from the Journey node
 * and write the result fields into the callback inputs themselves. This object only
 * locates the live callback, runs the ceremony and maps the outcome for JavaScript.
 */
internal object RNPingRecognizeCommon {
    private const val INDEX_KEY = "index"
    private const val RETRIEVE_SELFIE_KEY = "retrieveSelfie"

    private const val RESULT_TYPE_KEY = "type"
    private const val RESULT_RECOGNIZE_ID_KEY = "recognizeId"
    private const val RESULT_CODE_KEY = "code"
    private const val RESULT_MESSAGE_KEY = "message"
    private const val RESULT_TYPE_SUCCESS = "success"
    private const val RESULT_TYPE_FAILURE = "failure"

    private const val DEFAULT_FAILURE_MESSAGE = "Recognize operation failed."

    @Volatile
    private var scope: CoroutineScope = createScope()

    /**
     * Cancels in-flight work and recreates the scope when the module is invalidated.
     */
    @JvmStatic
    @Synchronized
    fun cleanup() {
        scope.cancel()
        scope = createScope()
    }

    /**
     * Runs the Recognize enroll or authenticate step of an active Journey node.
     *
     * Keyless failures resolve as a `failure` payload and never reject, because the
     * native callback has already recorded the client error into its inputs and the
     * server expects the Journey to continue. Rejections are reserved for caller
     * mistakes and bridge state errors.
     *
     * @param journeyId Native Journey instance id.
     * @param options Optional map with `index` (Number, default 0) and
     *   `retrieveSelfie` (Boolean, default false).
     * @param config Per-client configuration. Reserved, currently unused.
     * @param promise Resolved with `{ type: 'success', recognizeId }` or
     *   `{ type: 'failure', code, message }`.
     */
    @JvmStatic
    @Suppress("UNUSED_PARAMETER")
    fun runForJourney(
        journeyId: String,
        options: ReadableMap?,
        config: ReadableMap?,
        promise: Promise
    ) {
        if (journeyId.isBlank()) {
            rejectWithError(
                promise = promise,
                code = RecognizeErrorCodes.RECOGNIZE_ERROR,
                message = "Journey id must not be empty for Recognize.",
                type = ErrorType.ARGUMENT_ERROR
            )
            return
        }

        val index = parseCallbackIndex(options)
        val wantSelfie = parseRetrieveSelfie(options)

        // NOTE: Keyless presents its own camera UI, which needs the main thread and a
        // foreground Activity, so the ceremony runs on Dispatchers.Main.
        scope.launchBridge(promise, RecognizeErrorCodes.RECOGNIZE_RUN_ERROR, Dispatchers.Main) {
            val callback = CoreRuntime.resolveJourneyCallbacks(journeyId)
                ?.filterIsInstance<AbstractRecognizeCallback>()
                ?.getOrNull(index)

            val result = when (callback) {
                is PingOneRecognizeEnrollCallback ->
                    callback.enroll { this.retrieveSelfie = wantSelfie }
                is PingOneRecognizeAuthenticateCallback ->
                    callback.authenticate { this.retrieveSelfie = wantSelfie }
                else -> {
                    rejectWithError(
                        promise = promise,
                        code = RecognizeErrorCodes.RECOGNIZE_CALLBACK_NOT_FOUND,
                        message = "No active Recognize callback found for journey $journeyId at index $index.",
                        type = ErrorType.STATE_ERROR
                    )
                    return@launchBridge
                }
            }

            result.fold(
                onSuccess = { success ->
                    android.util.Log.i(
                        "opt2",
                        "recognize success: recognizeId=${success.recognizeId} signedJwt?${!success.signedJwt.isNullOrBlank()} clientState?${!success.clientState.isNullOrBlank()} signingKey?${!success.devicePublicSigningKey.isNullOrBlank()}"
                    )
                    promise.resolve(
                        createResultPayload(
                            type = RESULT_TYPE_SUCCESS,
                            recognizeId = success.recognizeId
                        )
                    )
                },
                onFailure = { error ->
                    android.util.Log.w(
                        "opt2",
                        "recognize failure: code=${failureCode(error)} message=${failureMessage(error)}"
                    )
                    promise.resolve(
                        createResultPayload(
                            type = RESULT_TYPE_FAILURE,
                            code = failureCode(error),
                            message = failureMessage(error)
                        )
                    )
                }
            )
        }
    }

    /**
     * Runs the Recognize enroll or authenticate collector of an active DaVinci node.
     *
     * Keyless failures resolve as a `failure` payload and never reject, because the
     * native collector has already recorded `clientError` in its result payload and
     * the caller advances the flow with an empty collector input so the server can
     * branch. Rejections are reserved for caller mistakes and bridge state errors.
     *
     * @param davinciId Native DaVinci instance id.
     * @param options Optional map with `index` (Number, default 0).
     * @param config Per-client configuration. Reserved, currently unused.
     * @param promise Resolved with `{ type: 'success', recognizeId }` or
     *   `{ type: 'failure', code, message }`.
     */
    @JvmStatic
    @Suppress("UNUSED_PARAMETER")
    fun runForDaVinci(
        davinciId: String,
        options: ReadableMap?,
        config: ReadableMap?,
        promise: Promise
    ) {
        if (davinciId.isBlank()) {
            rejectWithError(
                promise = promise,
                code = RecognizeErrorCodes.RECOGNIZE_ERROR,
                message = "DaVinci id must not be empty for Recognize.",
                type = ErrorType.ARGUMENT_ERROR
            )
            return
        }

        val index = parseCallbackIndex(options)

        // NOTE: Keyless presents its own camera UI, which needs the main thread and a
        // foreground Activity, so the ceremony runs on Dispatchers.Main.
        scope.launchBridge(promise, RecognizeErrorCodes.RECOGNIZE_RUN_ERROR, Dispatchers.Main) {
            val collector = CoreRuntime.resolveDaVinciCollectors(davinciId)
                ?.filterIsInstance<AbstractRecognizeCollector>()
                ?.getOrNull(index)

            if (collector == null) {
                rejectWithError(
                    promise = promise,
                    code = RecognizeErrorCodes.RECOGNIZE_COLLECTOR_NOT_FOUND,
                    message = "No active Recognize collector found for DaVinci instance $davinciId at index $index.",
                    type = ErrorType.STATE_ERROR
                )
                return@launchBridge
            }

            val result = collector.collect()

            result.fold(
                onSuccess = { payload ->
                    promise.resolve(
                        createResultPayload(
                            type = RESULT_TYPE_SUCCESS,
                            recognizeId = payload[RESULT_RECOGNIZE_ID_KEY]
                                ?.jsonPrimitive?.content
                                .orEmpty()
                        )
                    )
                },
                onFailure = { error ->
                    android.util.Log.w(
                        "opt2",
                        "recognize failure: code=${failureCode(error)} message=${failureMessage(error)}"
                    )
                    promise.resolve(
                        createResultPayload(
                            type = RESULT_TYPE_FAILURE,
                            code = failureCode(error),
                            message = failureMessage(error)
                        )
                    )
                }
            )
        }
    }

    private fun failureCode(error: Throwable): String =
        (error as? RecognizeException)?.code?.toString()
            ?: RecognizeErrorCodes.SHARED_SDK_ERROR_CODE

    private fun failureMessage(error: Throwable): String =
        error.message?.takeIf { it.isNotBlank() } ?: DEFAULT_FAILURE_MESSAGE

    private fun parseCallbackIndex(options: ReadableMap?): Int {
        if (options == null || !options.hasKey(INDEX_KEY) || options.isNull(INDEX_KEY)) {
            return 0
        }
        return when (options.getType(INDEX_KEY)) {
            ReadableType.Number -> options.getDouble(INDEX_KEY).toInt()
            ReadableType.String -> options.getString(INDEX_KEY)?.toIntOrNull() ?: 0
            else -> 0
        }
    }

    private fun parseRetrieveSelfie(options: ReadableMap?): Boolean {
        if (options == null ||
            !options.hasKey(RETRIEVE_SELFIE_KEY) ||
            options.isNull(RETRIEVE_SELFIE_KEY) ||
            options.getType(RETRIEVE_SELFIE_KEY) != ReadableType.Boolean
        ) {
            return false
        }
        return options.getBoolean(RETRIEVE_SELFIE_KEY)
    }

    private fun createResultPayload(
        type: String,
        recognizeId: String? = null,
        code: String? = null,
        message: String? = null
    ) = JsonBridgeMapper.encodeJsonObject(
        buildJsonObject {
            put(RESULT_TYPE_KEY, JsonPrimitive(type))
            recognizeId?.let { put(RESULT_RECOGNIZE_ID_KEY, JsonPrimitive(it)) }
            code?.let { put(RESULT_CODE_KEY, JsonPrimitive(it)) }
            message?.let { put(RESULT_MESSAGE_KEY, JsonPrimitive(it)) }
        }
    )

    private fun rejectWithError(
        promise: Promise,
        code: String,
        message: String,
        type: ErrorType
    ) {
        promise.reject(GenericError(type = type, error = code, message = message))
    }

    @JvmSynthetic
    internal fun createScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)
}
