/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.journey.plugin.AbstractCallback
import com.pingidentity.journey.callback.AbstractValidatedCallback
import com.pingidentity.journey.callback.BooleanAttributeInputCallback
import com.pingidentity.journey.callback.ChoiceCallback
import com.pingidentity.journey.callback.ConfirmationCallback
import com.pingidentity.journey.callback.ConsentMappingCallback
import com.pingidentity.journey.callback.HiddenValueCallback
import com.pingidentity.journey.callback.KbaCreateCallback
import com.pingidentity.journey.callback.MetadataCallback
import com.pingidentity.journey.callback.NameCallback
import com.pingidentity.journey.callback.NumberAttributeInputCallback
import com.pingidentity.journey.callback.PasswordCallback
import com.pingidentity.journey.callback.PollingWaitCallback
import com.pingidentity.journey.callback.StringAttributeInputCallback
import com.pingidentity.journey.callback.SuspendedTextOutputCallback
import com.pingidentity.journey.callback.TermsAndConditionsCallback
import com.pingidentity.journey.callback.TextInputCallback
import com.pingidentity.journey.callback.TextOutputCallback
import com.pingidentity.journey.callback.ValidatedPasswordCallback
import com.pingidentity.journey.callback.ValidatedUsernameCallback
import com.pingidentity.journey.plugin.callbacks
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.SuccessNode
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Maps native Journey nodes/callbacks to JS bridge payloads.
 */
internal object JourneyNodeMapper {

    /**
     * Convert a native node into bridge-friendly map payload.
     *
     * @param node Native Journey node.
     * @return Serialized node payload.
     */
    fun mapNode(node: Node): WritableMap {
        return toWritableMap(mapNodePayload(node))
    }

    /**
     * Convert a native callback into bridge payload.
     *
     * @param callback Native callback instance.
     * @return Serialized callback payload.
     */
    fun mapCallback(callback: Any): WritableMap {
        return toWritableMap(mapCallbackPayload(callback))
    }

    /**
     * Build a pure Kotlin payload for a native node.
     *
     * @param node Native Journey node.
     * @return Serializable node payload map.
     */
    fun mapNodePayload(node: Node): Map<String, Any?> {
        val payload = linkedMapOf<String, Any?>()

        when (node) {
            is ContinueNode -> {
                payload["type"] = "ContinueNode"
                payload["input"] = jsonElementToAny(node.input)
                payload["callbacks"] = node.callbacks.map { mapCallbackPayload(it) }
            }
            is ErrorNode -> {
                payload["type"] = "ErrorNode"
                payload["message"] = node.message
                payload["input"] = jsonElementToAny(node.input)
            }
            is SuccessNode -> {
                payload["type"] = "SuccessNode"
                payload["input"] = jsonElementToAny(node.input)
            }
            is FailureNode -> {
                val message = node.cause.message ?: node.cause.toString()
                payload["type"] = "FailureNode"
                payload["message"] = message
                payload["cause"] = message
            }
        }

        return payload
    }

    /**
     * Resolves normalized callback type name aliases for bridge payloads.
     *
     * @param callback Native callback instance.
     * @return Callback type string exposed to JavaScript.
     */
    private fun callbackType(callback: Any): String {
        return when (callback) {
            is ValidatedPasswordCallback -> "ValidatedCreatePasswordCallback"
            is ValidatedUsernameCallback -> "ValidatedCreateUsernameCallback"
            else -> callback::class.java.simpleName
        }
    }

    /**
     * Build a pure Kotlin payload for a native callback.
     *
     * @param callback Native callback instance.
     * @return Serializable callback payload map.
     */
    fun mapCallbackPayload(callback: Any): Map<String, Any?> {
        val payload = linkedMapOf<String, Any?>("type" to callbackType(callback))
        if (callback is AbstractCallback) {
            try {
                payload["raw"] = jsonElementToAny(callback.json)
            } catch (_: Throwable) {
                // Callback may be test-constructed without init(json), keep mapping resilient.
            }
        }
        if (callback is AbstractValidatedCallback) {
            payload["validateOnly"] = callback.validateOnly
            payload["prompt"] = callback.prompt
            payload["policies"] = jsonElementToAny(callback.policies)
            payload["failedPolicies"] = callback.failedPolicies.map { failedPolicy ->
                mapOf(
                    "params" to jsonElementToAny(failedPolicy.params),
                    "policyRequirement" to failedPolicy.policyRequirement
                )
            }
        }

        resolveRequired(callback)?.let {
            payload["required"] = it
        }

        when (callback) {
            is NameCallback -> {
                payload["prompt"] = callback.prompt
                payload["value"] = callback.name ?: ""
            }
            is PasswordCallback -> {
                payload["prompt"] = callback.prompt
                payload["value"] = ""
            }
            is TextInputCallback -> {
                payload["prompt"] = callback.prompt
                payload["defaultText"] = callback.defaultText
                payload["value"] = callback.text ?: callback.defaultText ?: ""
            }
            is TextOutputCallback -> {
                payload["prompt"] = callback.message
                payload["message"] = callback.message
                runCatching { callback.messageType.name }
                    .getOrNull()
                    ?.let { payload["messageType"] = it }
            }
            is SuspendedTextOutputCallback -> {
                payload["prompt"] = callback.message
                payload["message"] = callback.message
                runCatching { callback.messageType.name }
                    .getOrNull()
                    ?.let { payload["messageType"] = it }
            }
            is StringAttributeInputCallback -> {
                payload["prompt"] = callback.prompt
                payload["name"] = callback.name
                payload["required"] = callback.required
                payload["validateOnly"] = callback.validateOnly
                payload["value"] = callback.value
            }
            is NumberAttributeInputCallback -> {
                payload["prompt"] = callback.prompt
                payload["name"] = callback.name
                payload["required"] = callback.required
                payload["validateOnly"] = callback.validateOnly
                payload["value"] = callback.value
            }
            is BooleanAttributeInputCallback -> {
                payload["prompt"] = callback.prompt
                payload["name"] = callback.name
                payload["required"] = callback.required
                payload["validateOnly"] = callback.validateOnly
                payload["value"] = callback.value
            }
            is ChoiceCallback -> {
                payload["choices"] = callback.choices
                payload["defaultChoice"] = callback.defaultChoice
                payload["selectedIndex"] = callback.selectedIndex
                payload["prompt"] = callback.prompt
            }
            is ConfirmationCallback -> {
                runCatching { callback.options }
                    .getOrNull()
                    ?.let { payload["options"] = it }
                payload["selectedIndex"] = runCatching { callback.selectedIndex?.toInt() }
                    .getOrNull()
                    ?: -1
                runCatching { callback.prompt }
                    .getOrNull()
                    ?.let { payload["prompt"] = it }
                runCatching { callback.defaultOption.name }
                    .getOrNull()
                    ?.let { payload["defaultOption"] = it }
                runCatching { callback.optionType.name }
                    .getOrNull()
                    ?.let { payload["optionType"] = it }
                runCatching { callback.messageType.name }
                    .getOrNull()
                    ?.let { payload["messageType"] = it }
            }
            is ConsentMappingCallback -> {
                payload["name"] = callback.name
                payload["displayName"] = callback.displayName
                payload["icon"] = callback.icon
                payload["accessLevel"] = callback.accessLevel
                payload["required"] = callback.isRequired
                payload["fields"] = callback.fields
                payload["message"] = callback.message
                payload["accepted"] = callback.accepted
            }
            is TermsAndConditionsCallback -> {
                payload["version"] = callback.version
                payload["terms"] = callback.terms
                payload["createDate"] = callback.createDate
                payload["accepted"] = callback.accepted
            }
            is HiddenValueCallback -> {
                payload["id"] = callback.id
                payload["value"] = callback.value
            }
            is KbaCreateCallback -> {
                payload["prompt"] = callback.prompt
                payload["predefinedQuestions"] = callback.predefinedQuestions
                payload["selectedQuestion"] = callback.selectedQuestion
                payload["selectedAnswer"] = callback.selectedAnswer
                payload["allowUserDefinedQuestions"] = callback.allowUserDefinedQuestions
            }
            is PollingWaitCallback -> {
                payload["waitTime"] = callback.waitTime
                payload["message"] = callback.message
            }
            is MetadataCallback -> {
                payload["value"] = jsonElementToAny(callback.value)
            }
            is ValidatedPasswordCallback -> {
                payload["prompt"] = callback.prompt
                payload["value"] = ""
                payload["validateOnly"] = callback.validateOnly
                payload["echoOn"] = callback.echoOn
            }
            is ValidatedUsernameCallback -> {
                payload["prompt"] = callback.prompt
                payload["value"] = callback.username
                payload["validateOnly"] = callback.validateOnly
            }
            else -> Unit
        }

        return payload
    }

    /**
     * Tries to read callback required metadata from common getter names.
     *
     * @param callback Native callback instance.
     * @return Required flag when discovered, otherwise null.
     */
    private fun resolveRequired(callback: Any): Boolean? {
        val getter = callback::class.java.methods.firstOrNull { method ->
            method.parameterCount == 0 &&
                (method.name == "isRequired" || method.name == "getRequired")
        } ?: return null

        return try {
            when (val value = getter.invoke(callback)) {
                is Boolean -> value
                is Number -> value.toInt() != 0
                is String -> value.equals("true", ignoreCase = true) || value == "1"
                else -> null
            }
        } catch (_: Throwable) {
            null
        }
    }

    /**
     * Converts Kotlin serialization JSON values to plain bridge-friendly objects.
     *
     * @param element JSON element to convert.
     * @return Primitive/map/list value compatible with React Native bridge serialization.
     */
    private fun jsonElementToAny(element: JsonElement): Any? {
        return when (element) {
            JsonNull -> null
            is JsonPrimitive -> {
                if (element.isString) {
                    element.content
                } else {
                    element.booleanOrNull ?: element.longOrNull ?: element.doubleOrNull ?: element.content
                }
            }
            is JsonObject -> element.mapValues { (_, value) -> jsonElementToAny(value) }
            is JsonArray -> element.map { jsonElementToAny(it) }
        }
    }

    /**
     * Converts a plain map payload to React Native `WritableMap`.
     *
     * @param value Source key-value map.
     * @return Writable map payload.
     */
    private fun toWritableMap(value: Map<String, Any?>): WritableMap {
        val map = Arguments.createMap()
        value.forEach { (key, item) ->
            putValue(map, key, item)
        }
        return map
    }

    /**
     * Converts a plain list payload to React Native `WritableArray`.
     *
     * @param values Source list values.
     * @return Writable array payload.
     */
    private fun toWritableArray(values: List<Any?>): WritableArray {
        val array = Arguments.createArray()
        values.forEach { value ->
            when (value) {
                null -> array.pushNull()
                is Boolean -> array.pushBoolean(value)
                is Int -> array.pushInt(value)
                is Long -> array.pushDouble(value.toDouble())
                is Float -> array.pushDouble(value.toDouble())
                is Double -> array.pushDouble(value)
                is String -> array.pushString(value)
                is Map<*, *> -> {
                    val mapValue = value.entries
                        .filter { it.key is String }
                        .associate { it.key as String to it.value }
                    array.pushMap(toWritableMap(mapValue))
                }
                is List<*> -> array.pushArray(toWritableArray(value))
                else -> array.pushString(value.toString())
            }
        }
        return array
    }

    /**
     * Writes one dynamic value into a `WritableMap`.
     *
     * @param map Target writable map.
     * @param key Field key.
     * @param value Field value.
     */
    private fun putValue(map: WritableMap, key: String, value: Any?) {
        when (value) {
            null -> map.putNull(key)
            is Boolean -> map.putBoolean(key, value)
            is Int -> map.putInt(key, value)
            is Long -> map.putDouble(key, value.toDouble())
            is Float -> map.putDouble(key, value.toDouble())
            is Double -> map.putDouble(key, value)
            is String -> map.putString(key, value)
            is Map<*, *> -> {
                val mapValue = value.entries
                    .filter { it.key is String }
                    .associate { it.key as String to it.value }
                map.putMap(key, toWritableMap(mapValue))
            }
            is List<*> -> map.putArray(key, toWritableArray(value))
            else -> map.putString(key, value.toString())
        }
    }
}
