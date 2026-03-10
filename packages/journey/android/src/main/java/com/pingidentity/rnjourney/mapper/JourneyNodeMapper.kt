/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.Arguments
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
import com.pingidentity.logger.Logger
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.SuccessNode
import com.pingidentity.rncore.utils.JsonBridgeMapper

/**
 * Maps native Journey nodes/callbacks to JS bridge payloads.
 */
internal object JourneyNodeMapper {
    private const val TAG = "JourneyNodeMapper"

    /**
     * Best-effort warning log through the configured Ping logger.
     */
    private fun logWarning(logger: Logger?, message: String, error: Throwable) {
        runCatching {
            logger?.w("[$TAG] $message", error)
        }
    }

    /**
     * Convert a native node into bridge-friendly map payload.
     *
     * @param node Native Journey node.
     * @return Serialized node payload.
     */
    fun mapNode(node: Node, logger: Logger? = null): WritableMap {
        return Arguments.makeNativeMap(mapNodePayload(node, logger))
    }

    /**
     * Convert a native callback into bridge payload.
     *
     * @param callback Native callback instance.
     * @return Serialized callback payload.
     */
    fun mapCallback(callback: Any, logger: Logger? = null): WritableMap {
        return Arguments.makeNativeMap(mapCallbackPayload(callback, logger))
    }

    /**
     * Build a pure Kotlin payload for a native node.
     *
     * @param node Native Journey node.
     * @return Serializable node payload map.
     */
    fun mapNodePayload(node: Node, logger: Logger? = null): Map<String, Any?> {
        val payload = linkedMapOf<String, Any?>()

        when (node) {
            is ContinueNode -> {
                payload["type"] = "ContinueNode"
                payload["input"] = JsonBridgeMapper.encodeJsonElement(node.input)
                payload["callbacks"] = node.callbacks.map { mapCallbackPayload(it, logger) }
            }
            is ErrorNode -> {
                payload["type"] = "ErrorNode"
                // TODO(iOS SDK parity): Android Orchestrate ErrorNode currently does not expose
                // an HTTP status field; iOS ErrorNode can include status metadata.
                payload["message"] = node.message
                payload["input"] = JsonBridgeMapper.encodeJsonElement(node.input)
            }
            is SuccessNode -> {
                payload["type"] = "SuccessNode"
                payload["input"] = JsonBridgeMapper.encodeJsonElement(node.input)
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
    fun mapCallbackPayload(callback: Any, logger: Logger? = null): Map<String, Any?> {
        val payload = linkedMapOf<String, Any?>("type" to callbackType(callback))
        if (callback is AbstractCallback) {
            try {
                payload["raw"] = JsonBridgeMapper.encodeJsonElement(callback.json)
            } catch (error: UninitializedPropertyAccessException) {
                // Callback may be test-constructed without init(json); keep mapping resilient.
                logWarning(logger, "Skipping callback.raw for ${callbackType(callback)}: json not initialized", error)
            } catch (error: IllegalStateException) {
                // Some SDK callback accessors may throw when internal state is incomplete.
                logWarning(logger, "Skipping callback.raw for ${callbackType(callback)}: ${error.message}", error)
            }
        }
        if (callback is AbstractValidatedCallback) {
            payload["validateOnly"] = callback.validateOnly
            payload["prompt"] = callback.prompt
            payload["policies"] = JsonBridgeMapper.encodeJsonElement(callback.policies)
            payload["failedPolicies"] = callback.failedPolicies.map { failedPolicy ->
                mapOf(
                    "params" to JsonBridgeMapper.encodeJsonElement(failedPolicy.params),
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
                payload["value"] = JsonBridgeMapper.encodeJsonElement(callback.value)
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

}
