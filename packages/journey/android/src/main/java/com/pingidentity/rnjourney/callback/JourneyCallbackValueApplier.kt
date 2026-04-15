/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
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

/**
 * Applies callback input mutations from JS payloads to active Journey callbacks.
 */
internal object JourneyCallbackValueApplier {
    internal class MissingIntegrationException(message: String) : IllegalStateException(message)

    /**
     * Callback types that require external module integration before values can be applied.
     *
     * Map value describes the required integration for error messaging.
     */
    private val integrationCallbackRequirements = mapOf(
        "DeviceProfileCallback" to "@ping-identity/rn-device-profile",
        "FidoRegistrationCallback" to "@ping-identity/rn-fido",
        "FidoAuthenticationCallback" to "@ping-identity/rn-fido",
        "PingOneProtectInitializeCallback" to "PingOne Protect integration",
        "PingOneProtectEvaluationCallback" to "PingOne Protect integration",
        "SelectIdPCallback" to "External IdP integration",
        "IdPCallback" to "External IdP integration",
        "ReCaptchaCallback" to "ReCaptcha integration",
        "ReCaptchaEnterpriseCallback" to "ReCaptcha Enterprise integration",
        "BindingCallback" to "Binding integration",
        "DeviceBindingCallback" to "Binding integration",
        "DeviceSigningVerifierCallback" to "Binding integration"
    )

    /**
     * Parsed callback mutation instruction received from JavaScript.
     *
     * @property type Callback type name to target.
     * @property value Dynamic callback value to apply.
     * @property index Optional per-type callback index.
     */
    internal data class CallbackMutation(
        val type: String,
        val value: Any?,
        val index: Int?
    )

    /**
     * Parse callback mutation payload from bridge input.
     *
     * @param input Bridge input map.
     * @return Parsed callback mutations.
     */
    fun parseInput(input: ReadableMap): List<CallbackMutation> {
        val callbacks = input.getArray("callbacks") ?: return emptyList()
        val mutations = mutableListOf<CallbackMutation>()

        for (i in 0 until callbacks.size()) {
            val callbackMap = callbacks.getMap(i)
                ?: throw IllegalArgumentException("Invalid callback payload at index $i")
            val type = callbackMap.getString("type")
                ?: throw IllegalArgumentException("Callback type is required at index $i")
            val index = parseOptionalIndex(callbackMap)
            mutations.add(
                CallbackMutation(
                    type = type,
                    value = readDynamicValue(callbackMap, "value"),
                    index = index
                )
            )
        }

        return mutations
    }

    /**
     * Apply parsed callback mutations to the current continue node callbacks.
     *
     * @param continueNode Active continue node.
     * @param mutations Parsed callback mutations.
     */
    suspend fun apply(continueNode: ContinueNode, mutations: List<CallbackMutation>) {
        val callbacks = continueNode.callbacks.map { it as Any }
        applyToCallbacks(callbacks, mutations)
    }

    /**
     * Apply parsed callback mutations to callback list.
     *
     * @param callbacks Active callbacks.
     * @param mutations Parsed callback mutations.
     */
    suspend fun applyToCallbacks(callbacks: List<Any>, mutations: List<CallbackMutation>) {
        val callbacksByType = callbacks.groupBy { it::class.java.simpleName }
        val consumedIndexByType = mutableMapOf<String, Int>()

        mutations.forEach { mutation ->
            val callback = findCallback(callbacksByType, mutation, consumedIndexByType)
            val value = mutation.value

            when (callback) {
                is NameCallback -> callback.name = asString(value, mutation.type)
                is PasswordCallback -> callback.password = asString(value, mutation.type)
                is TextInputCallback -> callback.text = asString(value, mutation.type)
                is StringAttributeInputCallback -> callback.value = asString(value, mutation.type)
                is NumberAttributeInputCallback -> callback.value = asDouble(value, mutation.type)
                is BooleanAttributeInputCallback -> callback.value = asBoolean(value, mutation.type)
                is HiddenValueCallback -> callback.value = asString(value, mutation.type)
                is TermsAndConditionsCallback -> callback.accepted = asBoolean(value, mutation.type)
                is ConsentMappingCallback -> callback.accepted = asBoolean(value, mutation.type)
                is ChoiceCallback -> callback.selectedIndex = asInt(value, mutation.type)
                is ConfirmationCallback -> callback.selectedIndex = asInt(value, mutation.type)
                is ValidatedPasswordCallback -> callback.password = asString(value, mutation.type)
                is ValidatedUsernameCallback -> callback.username = asString(value, mutation.type)
                is KbaCreateCallback -> {
                    val map = asStringMap(value)
                    val selectedQuestion = map["selectedQuestion"] ?: map["question"]
                    val selectedAnswer = map["selectedAnswer"] ?: map["answer"]
                    val allowUserDefinedQuestions = map["allowUserDefinedQuestions"]

                    if (selectedQuestion != null) {
                        callback.selectedQuestion = asString(selectedQuestion, "${mutation.type}.selectedQuestion")
                    }
                    if (selectedAnswer != null) {
                        callback.selectedAnswer = asString(selectedAnswer, "${mutation.type}.selectedAnswer")
                    } else if (value is String) {
                        callback.selectedAnswer = value
                    }
                    if (allowUserDefinedQuestions != null) {
                        callback.allowUserDefinedQuestions = asBoolean(
                            allowUserDefinedQuestions,
                            "${mutation.type}.allowUserDefinedQuestions"
                        )
                    }
                }
                is MetadataCallback,
                is PollingWaitCallback,
                is TextOutputCallback,
                is SuspendedTextOutputCallback -> {
                    throw UnsupportedOperationException(
                        "Callback type ${mutation.type} is output-only and cannot be mutated"
                    )
                }
                else -> {
                    val normalizedType = normalizedCallbackType(mutation.type)
                    val requirement = integrationCallbackRequirements[normalizedType]
                    if (requirement != null) {
                        throw MissingIntegrationException(
                            "Callback type ${mutation.type} requires additional native integration: $requirement"
                        )
                    }

                    throw UnsupportedOperationException(
                        "Callback type ${mutation.type} is not supported for value mutation"
                    )
                }
            }
        }
    }

    /**
     * Normalizes alias callback type names used by JS helper APIs.
     *
     * @param type Callback type from mutation payload.
     * @return Native callback type name used in runtime callback lookup.
     */
    private fun normalizedCallbackType(type: String): String {
        return when (type) {
            "ValidatedCreatePasswordCallback" -> "ValidatedPasswordCallback"
            "ValidatedCreateUsernameCallback" -> "ValidatedUsernameCallback"
            else -> type
        }
    }

    /**
     * Resolves one target callback for a mutation, accounting for callback aliases and indexes.
     *
     * @param callbacksByType Active callbacks grouped by runtime type name.
     * @param mutation Parsed callback mutation.
     * @param consumedIndexByType Running index map used for sequential mutations.
     * @return Matching callback instance.
     * @throws IllegalArgumentException when no matching callback is found.
     */
    private fun findCallback(
        callbacksByType: Map<String, List<Any>>,
        mutation: CallbackMutation,
        consumedIndexByType: MutableMap<String, Int>
    ): Any {
        val normalizedType = normalizedCallbackType(mutation.type)
        val matching = callbacksByType[normalizedType].orEmpty()
        if (matching.isEmpty()) {
            throw IllegalArgumentException("No active callback found for type ${mutation.type}")
        }

        val index = mutation.index ?: consumedIndexByType.getOrDefault(normalizedType, 0)
        consumedIndexByType[normalizedType] = index + 1

        return matching.getOrNull(index)
            ?: throw IllegalArgumentException(
                "No active callback found for type ${mutation.type} at index $index"
            )
    }

    /**
     * Parses optional callback index from bridge payload.
     *
     * @param callbackMap One callback mutation map from JavaScript.
     * @return Parsed callback index or null when absent/invalid.
     */
    private fun parseOptionalIndex(callbackMap: ReadableMap): Int? {
        if (!callbackMap.hasKey("index") || callbackMap.isNull("index")) {
            return null
        }
        return when (callbackMap.getType("index")) {
            ReadableType.Number -> callbackMap.getDouble("index").toInt()
            ReadableType.String -> callbackMap.getString("index")?.toIntOrNull()
            else -> null
        }
    }

    /**
     * Reads one dynamic value from a bridge map using runtime type inspection.
     *
     * @param map Source readable map.
     * @param key Field key.
     * @return Parsed dynamic value.
     */
    private fun readDynamicValue(map: ReadableMap, key: String): Any? {
        if (!map.hasKey(key) || map.isNull(key)) {
            return null
        }
        return when (map.getType(key)) {
            ReadableType.Null -> null
            ReadableType.Boolean -> map.getBoolean(key)
            ReadableType.Number -> map.getDouble(key)
            ReadableType.String -> map.getString(key)
            ReadableType.Map -> map.getMap(key)?.toHashMap()
            ReadableType.Array -> readArrayValue(map.getArray(key))
        }
    }

    /**
     * Converts bridge arrays to plain Kotlin lists.
     *
     * @param array Source readable array.
     * @return Parsed list value.
     */
    private fun readArrayValue(array: ReadableArray?): List<Any?> {
        if (array == null) {
            return emptyList()
        }
        val values = mutableListOf<Any?>()
        for (i in 0 until array.size()) {
            val value = when (array.getType(i)) {
                ReadableType.Null -> null
                ReadableType.Boolean -> array.getBoolean(i)
                ReadableType.Number -> array.getDouble(i)
                ReadableType.String -> array.getString(i)
                ReadableType.Map -> array.getMap(i)?.toHashMap()
                ReadableType.Array -> readArrayValue(array.getArray(i))
            }
            values.add(value)
        }
        return values
    }

    /**
     * Coerces a dynamic value to string.
     *
     * @param value Dynamic value to coerce.
     * @param fieldName Field path used for validation errors.
     * @return String value.
     * @throws IllegalArgumentException when value cannot be represented as a string.
     */
    private fun asString(value: Any?, fieldName: String): String {
        return when (value) {
            is String -> value
            is Number -> value.toString()
            is Boolean -> value.toString()
            else -> throw IllegalArgumentException("$fieldName expects a string-compatible value")
        }
    }

    /**
     * Coerces a dynamic value to boolean.
     *
     * @param value Dynamic value to coerce.
     * @param fieldName Field path used for validation errors.
     * @return Boolean value.
     * @throws IllegalArgumentException when value cannot be represented as a boolean.
     */
    private fun asBoolean(value: Any?, fieldName: String): Boolean {
        return when (value) {
            is Boolean -> value
            is Number -> value.toInt() != 0
            is String -> {
                val normalized = value.trim().lowercase()
                when (normalized) {
                    "true", "1" -> true
                    "false", "0" -> false
                    else -> throw IllegalArgumentException("$fieldName expects a boolean value")
                }
            }
            else -> throw IllegalArgumentException("$fieldName expects a boolean value")
        }
    }

    /**
     * Coerces a dynamic value to double.
     *
     * @param value Dynamic value to coerce.
     * @param fieldName Field path used for validation errors.
     * @return Numeric double value.
     * @throws IllegalArgumentException when value is not numeric.
     */
    private fun asDouble(value: Any?, fieldName: String): Double {
        return when (value) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull()
                ?: throw IllegalArgumentException("$fieldName expects a numeric value")
            else -> throw IllegalArgumentException("$fieldName expects a numeric value")
        }
    }

    /**
     * Coerces a dynamic value to integer.
     *
     * @param value Dynamic value to coerce.
     * @param fieldName Field path used for validation errors.
     * @return Integer value.
     * @throws IllegalArgumentException when value is not an integer.
     */
    private fun asInt(value: Any?, fieldName: String): Int {
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
                ?: throw IllegalArgumentException("$fieldName expects an integer value")
            else -> throw IllegalArgumentException("$fieldName expects an integer value")
        }
    }

    /**
     * Coerces a dynamic value to a string-keyed map.
     *
     * @param value Dynamic value to coerce.
     * @return String-keyed map representation, or an empty map.
     */
    private fun asStringMap(value: Any?): Map<String, Any?> {
        val raw = value as? Map<*, *> ?: return emptyMap()
        return raw.entries.mapNotNull { entry ->
            val key = entry.key as? String ?: return@mapNotNull null
            key to entry.value
        }.toMap()
    }
}
