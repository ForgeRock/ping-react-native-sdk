/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.mapper

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import kotlinx.serialization.json.Json
import com.pingidentity.davinci.collector.Device
import com.pingidentity.davinci.collector.DeviceAuthenticationCollector
import com.pingidentity.davinci.collector.DeviceRegistrationCollector
import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.LabelCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PasswordCollector
import com.pingidentity.davinci.collector.PasswordPolicy
import com.pingidentity.davinci.collector.PhoneNumberCollector
import com.pingidentity.davinci.collector.SingleSelectCollector
import com.pingidentity.davinci.collector.SubmitCollector
import com.pingidentity.davinci.collector.TextCollector
import com.pingidentity.davinci.plugin.Collector
import com.pingidentity.idp.davinci.IdpCollector
import com.pingidentity.logger.Logger
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.SuccessNode
import com.pingidentity.rncore.utils.JsonBridgeMapper
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Maps native DaVinci nodes and collectors to JS bridge payloads.
 */
internal object DaVinciNodeMapper {

    private const val TAG = "DaVinciNodeMapper"
    internal const val SOCIAL_LOGIN_BUTTON = "SOCIAL_LOGIN_BUTTON"

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Best-effort warning log through the configured Ping logger.
     */
    private fun logWarning(logger: Logger?, message: String, error: Throwable) {
        logger?.w("[$TAG] $message", error)
    }

    /**
     * Convert a native DaVinci node into a bridge-friendly map payload.
     *
     * @param node Native DaVinci node.
     * @param logger Optional Ping logger used for non-fatal mapping warnings.
     * @return Serialized node payload.
     */
    fun mapNode(node: Node, logger: Logger? = null): WritableMap {
        return Arguments.makeNativeMap(mapNodePayload(node, logger))
    }

    /**
     * Build a pure Kotlin payload for a native DaVinci node.
     *
     * @param node Native DaVinci node.
     * @param logger Optional Ping logger used for non-fatal mapping warnings.
     * @return Serializable node payload map.
     */
    fun mapNodePayload(node: Node, logger: Logger? = null): Map<String, Any?> {
        val payload = linkedMapOf<String, Any?>()

        when (node) {
            is ContinueNode -> {
                payload["type"] = "ContinueNode"
                payload["collectors"] = mapCollectorsPayload(node, logger)
                payload["input"] = JsonBridgeMapper.encodeJsonElement(node.input)
                val unsupported = unsupportedFieldsPayload(node, logger)
                if (unsupported.isNotEmpty()) {
                    payload["unsupportedFields"] = unsupported
                }
            }
            is SuccessNode -> {
                payload["type"] = "SuccessNode"
                payload["session"] = mapOf("value" to node.session.value)
            }
            is ErrorNode -> {
                payload["type"] = "ErrorNode"
                // TODO-SDK-PARITY: Android Orchestrate ErrorNode currently does not expose
                // an HTTP status field; iOS ErrorNode can include status metadata.
                payload["message"] = node.message
                payload["input"] = JsonBridgeMapper.encodeJsonElement(node.input)
            }
            is FailureNode -> {
                val causeMessage = node.cause.message ?: node.cause.toString()
                payload["type"] = "FailureNode"
                payload["message"] = causeMessage
                payload["cause"] = causeMessage
            }
        }

        return payload
    }

    /**
     * Serialize all `Collector<*>` instances from a `ContinueNode` into a list.
     * Unknown action types that do not implement `Collector` are skipped gracefully.
     *
     * @param node Active continue node.
     * @param logger Optional Ping logger used to surface skipped collector types.
     * @return Serialized collectors list.
     */
    private fun mapCollectorsPayload(node: ContinueNode, logger: Logger? = null): List<Map<String, Any?>> {
        return buildList {
            for (action in node.actions) {
                if (action !is Collector<*>) continue
                val collectorMap = mapCollectorPayload(action, node, logger) ?: continue
                add(collectorMap)
            }
        }
    }

    /**
     * Diff the raw form fields against the collectors the native SDK instantiated.
     *
     * Surfaces field entries from `node.input.form.components.fields[]` whose
     * `inputType`/`type` was not registered with the native `CollectorFactory`
     * — these are silently dropped by the SDK and would otherwise be invisible
     * to JS consumers.
     *
     * The resolution order (`inputType` preferred over `type`) mirrors
     * `CollectorFactory.collector(workflow, fields)` in the Android DaVinci SDK.
     *
     * @param node Active continue node.
     * @return List of `{ key, type }` entries describing dropped fields.
     */
    private fun unsupportedFieldsPayload(node: ContinueNode, logger: Logger? = null): List<Map<String, Any?>> {
        val fields = formFields(node, logger, "unsupportedFields diff") ?: return emptyList()

        val registeredKeys = node.actions
            .filterIsInstance<Collector<*>>()
            .mapNotNull { it.id() }
            .toSet()

        return buildList {
            for (element in fields) {
                val fieldJson = try {
                    element.jsonObject
                } catch (error: Exception) {
                    logWarning(logger, "Skipping non-object entry in form.components.fields[]", error)
                    continue
                }
                val key = fieldJson["key"]?.jsonPrimitive?.content ?: continue

                // Mirrors CollectorFactory.collector(): inputType takes precedence over type.
                val resolvedType = fieldJson["inputType"]?.jsonPrimitive?.content
                    ?: fieldJson["type"]?.jsonPrimitive?.content
                    ?: continue

                // SOCIAL_LOGIN_BUTTON fields are always handled via IdpCollector — exclude them.
                if (resolvedType == SOCIAL_LOGIN_BUTTON) continue

                // A field is supported when the SDK instantiated a collector for its key.
                if (registeredKeys.contains(key)) continue

                add(mapOf("key" to key, "type" to resolvedType))
            }
        }
    }

    /**
     * Serialize a single collector to a payload map.
     * Returns null when the collector type is unknown and should be skipped.
     *
     * @param collector Collector instance.
     * @param node Parent continue node (used for password policy extraction).
     * @param logger Optional Ping logger for non-fatal mapping warnings.
     * @return Serialized collector map, or null for unknown types.
     */
    private fun mapCollectorPayload(
        collector: Collector<*>,
        node: ContinueNode,
        logger: Logger? = null
    ): Map<String, Any?>? {
        val payload = when (collector) {
            is IdpCollector -> mapIdpCollector(collector)
            is TextCollector -> mapTextCollector(collector)
            is PasswordCollector -> mapPasswordCollector(collector, node, logger)
            is SubmitCollector -> mapBaseCollector(collector)
            is FlowCollector -> mapBaseCollector(collector)
            is LabelCollector -> mapLabelCollector(collector)
            is SingleSelectCollector -> mapSingleSelectCollector(collector)
            is MultiSelectCollector -> mapMultiSelectCollector(collector)
            is PhoneNumberCollector -> mapPhoneNumberCollector(collector)
            is DeviceRegistrationCollector -> mapDeviceRegistrationCollector(collector)
            is DeviceAuthenticationCollector -> mapDeviceAuthenticationCollector(collector)
            else -> {
                logWarning(
                    logger,
                    "Skipping unsupported collector type: ${collector::class.java.simpleName}",
                    UnsupportedOperationException("Unsupported collector: ${collector::class.java.name}")
                )
                null
            }
        } ?: return null
        val fieldKey = rawFieldKey(collector) ?: return null
        return applyRawField(payload, fieldKey, node, logger)
    }

    /**
     * Returns the stable raw-field key for a collector.
     *
     * Most collectors use [Collector.id] which equals the server `key` field. Collectors that
     * do not extend [FieldCollector] (e.g. [IdpCollector]) override with their own stable identifier.
     * Add a new branch here for any future collector whose id() does not match its form field key.
     */
    private fun rawFieldKey(collector: Collector<*>): String? = when (collector) {
        is IdpCollector -> collector.idpId
        else -> collector.id()
    }

    private fun mapIdpCollector(collector: IdpCollector): MutableMap<String, Any?> {
        val map = linkedMapOf<String, Any?>(
            "key" to collector.idpId,
            "type" to SOCIAL_LOGIN_BUTTON,
            "label" to collector.label,
            "idpId" to collector.idpId,
            "idpType" to collector.idpType,
            "idpEnabled" to collector.idpEnabled,
        )
        runCatching { collector.link.toString() }.getOrNull()?.let { map["link"] = it }
        return map
    }

    /**
     * Serialize base collector fields (key, type, label, required) into a map.
     */
    private fun baseCollectorMap(collector: com.pingidentity.davinci.collector.FieldCollector<*>): MutableMap<String, Any?> {
        return linkedMapOf(
            "key" to collector.key,
            "type" to collector.type,
            "label" to collector.label,
            "required" to collector.required
        )
    }

    private fun mapBaseCollector(collector: com.pingidentity.davinci.collector.FieldCollector<*>): Map<String, Any?> {
        return baseCollectorMap(collector)
    }

    private fun mapTextCollector(collector: TextCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["value"] = collector.value ?: ""
        collector.validation?.let { validation ->
            map["validation"] = mapOf("regex" to validation.regex.pattern)
        }
        return map
    }

    /**
     * Serialize a [PasswordCollector] to a payload map.
     *
     * @remarks
     * The `value` field is always emitted as `""` and never reflects the native collector's
     * current value. This is intentional: password fields are treated as write-only across
     * the bridge — JS may push a value into the collector via `next()`, but the bridge never
     * round-trips the entered password back to JS. This matches the `PasswordCollector.value`
     * contract in the public TypeScript types (`packages/davinci/src/types/node.types.ts`,
     * always `""` in bridge output) and aligns with the iOS bridge's emission.
     *
     * `clearPassword` controls whether the native collector wipes its in-memory value when
     * the parent node is closed; it does not affect the bridge value emission.
     *
     * @param collector Native password collector.
     * @param node Parent continue node (used to extract the field-level password policy from raw JSON).
     * @param logger Optional Ping logger for non-fatal policy-extraction warnings.
     * @return Serialized password collector map.
     */
    private fun mapPasswordCollector(
        collector: PasswordCollector,
        node: ContinueNode,
        logger: Logger? = null
    ): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["value"] = ""
        map["clearPassword"] = collector.clearPassword
        extractPasswordPolicy(collector.key, node, logger)?.let { policy ->
            map["passwordPolicy"] = encodePasswordPolicy(policy)
        }
        return map
    }

    /**
     * Reads passwordPolicy from the raw JSON at
     * `continueNode.input.form.components.fields[].passwordPolicy` by matching the collector key.
     *
     * TODO-SDK-FUTURE-SUPPORT: The SDK's own `passwordPolicy()` method is `//TODO` in 2.0.1 because it reads from the
     * wrong JSON path (node root instead of the field-level object).
     */
    private fun extractPasswordPolicy(
        collectorKey: String,
        node: ContinueNode,
        logger: Logger? = null
    ): PasswordPolicy? {
        return try {
            val fieldJson = findFieldJson(node, collectorKey, logger) ?: return null
            val policyJson = fieldJson["passwordPolicy"]?.jsonObject ?: return null
            json.decodeFromJsonElement(PasswordPolicy.serializer(), policyJson)
        } catch (error: Exception) {
            logWarning(logger, "Failed to extract password policy for key=$collectorKey", error)
            null
        }
    }

    /**
     * Read `node.input.form.components.fields[]` as a JSON array.
     *
     * @param node Active continue node.
     * @param logger Optional Ping logger for non-fatal navigation warnings.
     * @param contextLabel Short identifier used in warning messages so callers are distinguishable.
     * @return The fields array, or null if the form/components/fields path is absent or malformed.
     */
    private fun formFields(
        node: ContinueNode,
        logger: Logger? = null,
        contextLabel: String = "form fields lookup"
    ): kotlinx.serialization.json.JsonArray? {
        return try {
            node.input
                .get("form")?.jsonObject
                ?.get("components")?.jsonObject
                ?.get("fields")?.jsonArray
        } catch (error: Exception) {
            logWarning(logger, "Failed to parse form fields for $contextLabel", error)
            null
        }
    }

    /**
     * Locate the field-level JSON object whose `key` matches the given collector key.
     *
     * @param node Active continue node.
     * @param collectorKey Collector key to look up under `form.components.fields[]`.
     * @param logger Optional Ping logger for non-fatal navigation warnings.
     * @return The matching field object, or null when not present.
     */
    private fun findFieldJson(
        node: ContinueNode,
        collectorKey: String,
        logger: Logger? = null
    ): JsonObject? {
        val fields = formFields(node, logger, "raw field lookup for key=$collectorKey") ?: return null
        return fields.firstOrNull {
            try {
                it.jsonObject["key"]?.jsonPrimitive?.content == collectorKey
            } catch (error: Exception) {
                logWarning(logger, "Skipping non-object entry while resolving raw field for key=$collectorKey", error)
                false
            }
        }?.jsonObject
    }

    /**
     * Look up the field-level JSON for a collector and emit it as `raw` on the collector map.
     * Collectors whose key has no matching field entry (e.g. action buttons) have `raw` omitted.
     */
    private fun applyRawField(
        payload: Map<String, Any?>,
        collectorKey: String,
        node: ContinueNode,
        logger: Logger? = null
    ): Map<String, Any?> {
        val fieldJson = findFieldJson(node, collectorKey, logger) ?: return payload
        val withRaw = LinkedHashMap(payload)
        withRaw["raw"] = JsonBridgeMapper.encodeJsonElement(fieldJson)
        return withRaw
    }

    private fun encodePasswordPolicy(policy: PasswordPolicy): Any? {
        val policyJson = json.encodeToJsonElement(PasswordPolicy.serializer(), policy)
        return JsonBridgeMapper.encodeJsonElement(policyJson.jsonObject)
    }

    private fun mapLabelCollector(collector: LabelCollector): Map<String, Any?> {
        return linkedMapOf(
            "key" to collector.key,
            "type" to "LABEL",
            "content" to collector.content
        )
    }

    private fun mapSingleSelectCollector(collector: SingleSelectCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["value"] = collector.value ?: ""
        map["options"] = mapOptions(collector.options)
        collector.validation?.let { validation ->
            map["validation"] = mapOf("regex" to validation.regex.pattern)
        }
        return map
    }

    private fun mapMultiSelectCollector(collector: MultiSelectCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["value"] = collector.value?.toList() ?: emptyList<String>()
        map["options"] = mapOptions(collector.options)
        return map
    }

    private fun mapPhoneNumberCollector(collector: PhoneNumberCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["defaultCountryCode"] = collector.defaultCountryCode
        map["validatePhoneNumber"] = collector.validatePhoneNumber
        map["countryCode"] = collector.countryCode
        map["phoneNumber"] = collector.phoneNumber
        return map
    }

    private fun mapDeviceRegistrationCollector(collector: DeviceRegistrationCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["devices"] = mapDevices(collector.devices)
        return map
    }

    private fun mapDeviceAuthenticationCollector(collector: DeviceAuthenticationCollector): Map<String, Any?> {
        val map = baseCollectorMap(collector)
        map["devices"] = mapDevices(collector.devices)
        return map
    }

    private fun mapOptions(options: List<com.pingidentity.davinci.collector.Option>): List<Map<String, Any?>> {
        return options.map { option ->
            mapOf(
                "label" to option.label,
                "value" to option.value
            )
        }
    }

    private fun mapDevices(devices: List<Device>): List<Map<String, Any?>> {
        return devices.map { device ->
            buildMap {
                device.id?.let { put("id", it) }
                put("type", device.type)
                put("title", device.title)
                device.description?.let { put("description", it) }
                put("iconSrc", device.iconSrc)
                put("isDefault", device.default)
            }
        }
    }
}
