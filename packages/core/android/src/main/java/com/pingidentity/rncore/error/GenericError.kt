/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.error

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap

/**
 * Shared error contract for JS-facing promise rejections.
 *
 * Values must match the JS `ErrorType` union in `@ping-identity/rn-types`.
 */
enum class ErrorType(val rawValue: String) {
    ARGUMENT_ERROR("argument_error"),
    AUTH_ERROR("auth_error"),
    BINDING_ERROR("binding_error"),
    DAVINCI_ERROR("davinci_error"),
    FIDO_ERROR("fido_error"),
    EXCHANGE_ERROR("exchange_error"),
    INTERNAL_ERROR("internal_error"),
    NETWORK_ERROR("network_error"),
    PARSE_ERROR("parse_error"),
    STATE_ERROR("state_error"),
    UNKNOWN_ERROR("unknown_error"),
    WELLKNOWN_ERROR("wellknown_error")
}

/**
 * Serializable error payload shared across native modules.
 *
 * - `type` classifies the error for app-level branching.
 * - `error` is a stable, module-specific code (e.g. BROWSER_OPEN_ERROR).
 * - `message`, `code`, and `status` provide extra diagnostics when available.
 */
data class GenericError(
    val type: ErrorType,
    val error: String,
    val message: String? = null,
    val code: Any? = null,
    val status: Any? = null
) {
    /**
     * Convert to a JS-friendly map for promise rejections.
     */
    fun toWritableMap(): WritableMap {
        val map = Arguments.createMap()
        map.putString("type", type.rawValue)
        map.putString("error", error)
        message?.let { map.putString("message", it) }
        code?.let { putValue(map, "code", it) }
        status?.let { putValue(map, "status", it) }
        return map
    }

    /**
     * Write a scalar value into the map with a best-effort type conversion.
     */
    private fun putValue(map: WritableMap, key: String, value: Any) {
        when (value) {
            is String -> map.putString(key, value)
            is Number -> map.putDouble(key, value.toDouble())
            is Boolean -> map.putBoolean(key, value)
            else -> map.putString(key, value.toString())
        }
    }
}

/**
 * Reject a promise using the shared error contract.
 *
 * The JS layer can rely on receiving the `GenericError` payload in the rejection.
 */
fun Promise.reject(error: GenericError, throwable: Throwable? = null) {
    reject(error.error, error.message, throwable, error.toWritableMap())
}
