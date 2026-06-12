/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.Promise
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

/**
 * Launches a coroutine that automatically handles promise rejection on failure.
 *
 * [CancellationException] is re-thrown so that structured-concurrency scope cancellation
 * propagates correctly without settling the promise. All other [Throwable] instances are
 * mapped to a [com.pingidentity.rncore.error.GenericError] via
 * [mapThrowableToGenericError] and the promise is rejected with the resulting error.
 *
 * @param promise The React Native promise to reject on failure. Success settlement
 *   (`resolve`) is the caller's responsibility inside [block].
 * @param errorCode The module-specific error code passed to [mapThrowableToGenericError].
 * @param context Additional [CoroutineContext] elements merged into the launch context.
 *   Defaults to [EmptyCoroutineContext] so the receiver scope's dispatcher is preserved.
 * @param block The suspend body to execute inside the coroutine.
 * @return The [Job] for the launched coroutine.
 */
@JvmSynthetic
fun CoroutineScope.launchBridge(
    promise: Promise,
    errorCode: String,
    context: CoroutineContext = EmptyCoroutineContext,
    block: suspend CoroutineScope.() -> Unit
): Job = launch(context) {
    try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Throwable) {
        promise.reject(mapThrowableToGenericError(e, errorCode), e)
    }
}
