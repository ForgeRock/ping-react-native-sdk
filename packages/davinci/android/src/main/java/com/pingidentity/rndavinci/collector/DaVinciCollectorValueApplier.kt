/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.collector

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.davinci.collector.BooleanCollector
import com.pingidentity.davinci.collector.Device
import com.pingidentity.davinci.collector.DeviceAuthenticationCollector
import com.pingidentity.davinci.collector.DeviceRegistrationCollector
import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.MetadataCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PhoneNumberCollector
import com.pingidentity.davinci.plugin.Collector
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.rncore.utils.JsonBridgeMapper
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Applies collector value mutations from JS payloads to active DaVinci collectors.
 *
 * DaVinci collectors are identified by key (via `collector.id()`), not by type index.
 */
internal object DaVinciCollectorValueApplier {

    /**
     * Result indicating whether the applied collector triggers an immediate form submit.
     *
     * @property isFlowTrigger True when a FlowCollector key was the only entry in the input.
     */
    data class ApplyResult(val isFlowTrigger: Boolean)

    /**
     * Apply collector values from a JS input map to the current continue node.
     *
     * The input format matches `DaVinciNextInput`:
     * `{ collectors: [{ key: string, value: unknown }] }`
     *
     * Notes:
     * Intentionally non-`suspend` — unlike Journey's equivalent applier. Every DaVinci
     * collector setter in the 2.0.1 SDK (`SingleValueCollector.value`,
     * `MultiSelectCollector.value`, `PhoneNumberCollector.countryCode`/`phoneNumber`,
     * `DeviceRegistrationCollector.value`, `DeviceAuthenticationCollector.value`) is a plain
     * `var` assignment with no async work; suspend overhead is unnecessary. The only
     * suspend work in DaVinci's collector lifecycle happens inside `ContinueNode.next()`
     * (validation + network), which the caller invokes after this function returns.
     *
     * @param node Active continue node providing the collector instances.
     * @param input Bridge input map.
     * @return Result indicating whether an immediate-submit flow was triggered.
     * @throws IllegalArgumentException when a collector key is not found on the node.
     */
    fun apply(node: ContinueNode, input: ReadableMap): ApplyResult {
        val collectorsArray = input.getArray("collectors") ?: return ApplyResult(isFlowTrigger = false)

        val collectorsByKey = node.actions
            .filterIsInstance<Collector<*>>()
            .associateBy { it.id() }

        var isFlowTrigger = false

        for (index in 0 until collectorsArray.size()) {
            val entry = collectorsArray.getMap(index)
                ?: throw IllegalArgumentException("Invalid collector entry at index $index")
            val key = entry.getString("key")
                ?: throw IllegalArgumentException("Missing 'key' in collector entry at index $index")
            val value = readDynamicValue(entry, "value")

            val collector = collectorsByKey[key]
                ?: throw IllegalArgumentException(
                    "No active collector found for key='$key'"
                )

            applyValue(collector, key, value)

            if (collector is FlowCollector) {
                isFlowTrigger = true
            }
        }

        return ApplyResult(isFlowTrigger = isFlowTrigger)
    }

    /**
     * Apply a single value to a collector instance.
     *
     * @param collector Target collector.
     * @param key Collector key (for error messages).
     * @param value Value from JS.
     * @throws IllegalArgumentException when the value type is incompatible with the collector.
     * @throws UnsupportedOperationException when the collector type is not supported by the bridge.
     */
    private fun applyValue(collector: Collector<*>, key: String, value: Any?) {
        when (collector) {
            is MultiSelectCollector -> {
                val list = asStringList(value, key)
                collector.value = list.toMutableList()
            }
            is PhoneNumberCollector -> {
                val map = asStringMap(value)
                map["countryCode"]?.let { collector.countryCode = it }
                map["phoneNumber"]?.let { collector.phoneNumber = it }
                map["extension"]?.let { collector.extension = it }
            }
            is DeviceRegistrationCollector -> {
                val map = asStringMap(value)
                val deviceType = map["type"]
                    ?: throw IllegalArgumentException("DeviceRegistrationCollector key='$key': value map must include 'type'")
                val device = collector.devices.firstOrNull { it.type == deviceType }
                    ?: throw IllegalArgumentException(
                        "DeviceRegistrationCollector key='$key': no device found with type='$deviceType'"
                    )
                collector.value = device
            }
            is DeviceAuthenticationCollector -> {
                val map = asStringMap(value)
                val deviceType = map["type"]
                    ?: throw IllegalArgumentException("DeviceAuthenticationCollector key='$key': value map must include 'type'")
                val device = collector.devices.firstOrNull { it.type == deviceType }
                    ?: Device(
                        id = map["id"],
                        type = deviceType,
                        title = map["title"] ?: deviceType,
                        description = map["description"] ?: "",
                        iconSrc = map["iconSrc"] ?: "",
                        default = false
                    )
                collector.value = device
            }
            is BooleanCollector -> {
                collector.value = asBoolean(value, key)
            }
            is MetadataCollector -> {
                applyMetadataValue(collector, key, value)
            }
            else -> {
                // All remaining collectors (TextCollector, PasswordCollector, SingleValueCollector,
                // SubmitCollector, FlowCollector) extend SingleValueCollector which has setValue(String).
                val strCollector = collector as? com.pingidentity.davinci.collector.SingleValueCollector
                    ?: throw UnsupportedOperationException(
                        "Collector key='$key' type=${collector::class.java.simpleName} is not supported by the bridge"
                    )
                strCollector.value = asString(value, key)
            }
        }
    }

    /**
     * Applies a JS-supplied result value to a [MetadataCollector].
     *
     * Semantics (SDKS-5384 D1/D1a/D1b), mirroring the iOS applier:
     * - `null` (JS null/undefined) → no-op: the collector's `validate()` keeps returning
     *   `Required`, so an unset result blocks the flow instead of silently clearing a
     *   previously set result.
     * - Empty map → throw: Android's native `Collectors.asJson()` silently drops an empty
     *   result (`!payload.isNullOrEmpty()`), so an empty-object success would stall this
     *   platform. The bridge rejects it here instead of letting the resume fail silently.
     * - Map containing an `error` key → strict envelope validation (a map with a non-empty
     *   string `code` and a string `message`) → [MetadataCollector.setError]. A malformed
     *   envelope throws rather than silently POSTing as a success result.
     * - Any other map → [MetadataCollector.setResult] (the success path).
     * - Non-map values → throw: the resume body must be a JSON object.
     *
     * @remarks
     * This deviates from the FIDO2 error handling (SDKS-5383), where collector errors are
     * bridge rejections. For METADATA the error envelope IS the value the server-side
     * connector routes on, so a well-formed envelope resolves the flow.
     *
     * @param collector Target metadata collector.
     * @param key Collector key (for error messages).
     * @param value Value from JS.
     * @throws IllegalArgumentException when the value cannot be applied.
     */
    private fun applyMetadataValue(collector: MetadataCollector, key: String, value: Any?) {
        when (value) {
            null -> return
            is Map<*, *> -> {
                // TODO-PARITY SDKS-5384: this platform's native Collectors.asJson()
                // silently drops an empty MetadataCollector result (Collectors.kt
                // `!payload.isNullOrEmpty()`), while iOS posts `{}` — an empty-object
                // success would resume on iOS but stall here. The bridge rejects empty
                // results on both platforms until the native SDKs align (needs native
                // defect ticket).
                if (value.isEmpty()) {
                    throw IllegalArgumentException(
                        "MetadataCollector key='$key': empty result objects are rejected — " +
                            "the native resume envelope drops an empty formData entry, so " +
                            "the flow would stall"
                    )
                }
                if (value.containsKey("error")) {
                    // JavaOnlyMap does not implement Map, and readDynamicValue's
                    // toHashMap() copy is shallow, so the nested envelope may arrive
                    // as either a plain Map or a raw ReadableMap — accept both.
                    val envelope: Map<*, *>? = when (val rawEnvelope = value["error"]) {
                        is Map<*, *> -> rawEnvelope
                        is ReadableMap -> rawEnvelope.toHashMap()
                        else -> null
                    }
                    val code = envelope?.get("code") as? String
                    val message = envelope?.get("message") as? String
                    if (envelope == null || code.isNullOrEmpty() || message == null) {
                        throw IllegalArgumentException(
                            "MetadataCollector key='$key': malformed error envelope $value — " +
                                "expected { error: { code: string, message: string } }"
                        )
                    }
                    collector.setError(code, message)
                    return
                }
                collector.setResult(toJsonObject(value))
            }
            else -> throw IllegalArgumentException(
                "MetadataCollector key='$key' expects a JSON object result, got: " +
                    "${value?.javaClass?.simpleName}"
            )
        }
    }

    /**
     * Recursively converts a bridge map into a [JsonObject] for
     * [MetadataCollector.setResult].
     *
     * @param value Bridge map (as produced by `readDynamicValue` for object values).
     * @return The equivalent JSON object.
     */
    private fun toJsonObject(value: Map<*, *>): JsonObject = JsonObject(
        value.entries.mapNotNull { (rawKey, rawValue) ->
            (rawKey as? String)?.let { key -> key to toJsonElement(rawValue) }
        }.toMap()
    )

    /**
     * Recursively converts a bridge value tree into a [JsonElement].
     *
     * The tree is mixed: the top-level value from `readDynamicValue` is a plain
     * `Map` (`ReadableMap.toHashMap()`), but nested entries may still be raw
     * bridge objects (`ReadableMap`/`ReadableArray` — `JavaOnlyMap.toHashMap()`
     * is a shallow copy, and `WritableNativeMap` nesting behaves the same in
     * some paths). Both shapes are handled: nested `ReadableMap`/`ReadableArray`
     * instances delegate to rn-core's [JsonBridgeMapper.decodeReadableMap]/
     * [JsonBridgeMapper.decodeReadableArray], which recurse fully.
     *
     * `null` entries become [JsonNull] — `JsonObject` supports explicit nulls, so a JS
     * `{ "answer": null }` result round-trips to the server faithfully. Numbers are
     * normalized with [normalizeBridgeNumber] (integer-valued doubles collapse to
     * `Long`, so JS `87` serializes as `87`, not `87.0`) — the same iOS-parity rule
     * `readDynamicValue` applies to top-level numbers. Non-JSON scalar types (which
     * the RN bridge does not produce) fall back to their string form, mirroring
     * `JsonBridgeMapper`'s scalar handling.
     *
     * @param value Bridge value (`Map`/`ReadableMap`/`List`/`ReadableArray`/primitive).
     * @return The equivalent JSON element.
     */
    private fun toJsonElement(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is Map<*, *> -> toJsonObject(value)
        is ReadableMap -> JsonBridgeMapper.decodeReadableMap(value)
        is ReadableArray -> JsonBridgeMapper.decodeReadableArray(value)
        is List<*> -> JsonArray(value.map { toJsonElement(it) })
        is String -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(normalizeBridgeNumber(value.toDouble()))
        else -> JsonPrimitive(value.toString())
    }

    /**
     * Reads one dynamic value from a bridge map using runtime type inspection.
     */
    private fun readDynamicValue(map: ReadableMap, key: String): Any? {
        if (!map.hasKey(key) || map.isNull(key)) return null
        return when (map.getType(key)) {
            ReadableType.Null -> null
            ReadableType.Boolean -> map.getBoolean(key)
            ReadableType.Number -> normalizeBridgeNumber(map.getDouble(key))
            ReadableType.String -> map.getString(key)
            ReadableType.Map -> map.getMap(key)?.toHashMap()
            ReadableType.Array -> {
                val array = map.getArray(key) ?: return null
                (0 until array.size()).map { index ->
                    when (array.getType(index)) {
                        ReadableType.Null -> null
                        ReadableType.Boolean -> array.getBoolean(index)
                        ReadableType.Number -> normalizeBridgeNumber(array.getDouble(index))
                        ReadableType.String -> array.getString(index)
                        ReadableType.Map -> array.getMap(index)?.toHashMap()
                        ReadableType.Array -> array.getArray(index)
                    }
                }
            }
        }
    }

    /**
     * Normalises a JS number for string coercion parity with iOS.
     *
     * React Native bridges every JS number as a `Double`. An integer-valued double like
     * `5.0` would stringify to `"5.0"` via `Double.toString`, while iOS `NSNumber.stringValue`
     * emits `"5"` for the same input. Collapsing integer-valued doubles to `Long` aligns the
     * two bridges. `NaN` and `+/-Infinity` fail the equality check (NaN is never equal to
     * anything, and `Long.MAX_VALUE.toDouble()` does not equal `Double.POSITIVE_INFINITY`),
     * so they fall through to `Double` and stringify as `"NaN"`/`"Infinity"`.
     *
     * @param bridgedNumber The JS number bridged as a Kotlin Double.
     * @return A `Long` when the value is an integer-valued finite double, otherwise the
     *   original `Double`.
     */
    private fun normalizeBridgeNumber(bridgedNumber: Double): Number {
        val truncatedToLong = bridgedNumber.toLong()
        val isIntegerValued = bridgedNumber == truncatedToLong.toDouble()
        return if (isIntegerValued) truncatedToLong else bridgedNumber
    }

    private fun asBoolean(value: Any?, fieldName: String): Boolean {
        return when (value) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true)
            else -> throw IllegalArgumentException("$fieldName expects a boolean value, got: ${value?.javaClass?.simpleName}")
        }
    }

    private fun asString(value: Any?, fieldName: String): String {
        return when (value) {
            is String -> value
            is Number -> value.toString()
            is Boolean -> value.toString()
            else -> throw IllegalArgumentException("$fieldName expects a string-compatible value, got: ${value?.javaClass?.simpleName}")
        }
    }

    private fun asStringList(value: Any?, fieldName: String): List<String> {
        return when (value) {
            is List<*> -> value.mapNotNull { it as? String }
            else -> throw IllegalArgumentException("$fieldName expects an array of strings")
        }
    }

    private fun asStringMap(value: Any?): Map<String, String> {
        val rawMap = value as? Map<*, *> ?: return emptyMap()
        return rawMap.entries.mapNotNull { (rawKey, rawValue) ->
            val stringKey = rawKey as? String ?: return@mapNotNull null
            val stringValue = rawValue?.toString() ?: return@mapNotNull null
            stringKey to stringValue
        }.toMap()
    }
}
