/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.collector

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.davinci.collector.Device
import com.pingidentity.davinci.collector.DeviceAuthenticationCollector
import com.pingidentity.davinci.collector.DeviceRegistrationCollector
import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PhoneNumberCollector
import com.pingidentity.davinci.plugin.Collector
import com.pingidentity.orchestrate.ContinueNode

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

        for (i in 0 until collectorsArray.size()) {
            val entry = collectorsArray.getMap(i)
                ?: throw IllegalArgumentException("Invalid collector entry at index $i")
            val key = entry.getString("key")
                ?: throw IllegalArgumentException("Missing 'key' in collector entry at index $i")
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
     * Reads one dynamic value from a bridge map using runtime type inspection.
     */
    private fun readDynamicValue(map: ReadableMap, key: String): Any? {
        if (!map.hasKey(key) || map.isNull(key)) return null
        return when (map.getType(key)) {
            ReadableType.Null -> null
            ReadableType.Boolean -> map.getBoolean(key)
            ReadableType.Number -> map.getDouble(key)
            ReadableType.String -> map.getString(key)
            ReadableType.Map -> map.getMap(key)?.toHashMap()
            ReadableType.Array -> {
                val arr = map.getArray(key) ?: return null
                (0 until arr.size()).map { i -> arr.getString(i) }
            }
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
        val raw = value as? Map<*, *> ?: return emptyMap()
        return raw.entries.mapNotNull { (k, v) ->
            val key = k as? String ?: return@mapNotNull null
            val str = v?.toString() ?: return@mapNotNull null
            key to str
        }.toMap()
    }
}
