/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.collector

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.pingidentity.davinci.collector.DeviceAuthenticationCollector
import com.pingidentity.davinci.collector.DeviceRegistrationCollector
import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PasswordCollector
import com.pingidentity.davinci.collector.PhoneNumberCollector
import com.pingidentity.davinci.collector.SingleSelectCollector
import com.pingidentity.davinci.collector.SubmitCollector
import com.pingidentity.davinci.collector.TextCollector
import com.pingidentity.network.HttpRequest
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.orchestrate.WorkflowConfig
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for DaVinci collector value application.
 * Uses JavaOnlyMap/Array (no Robolectric needed — these are pure JVM bridge stubs).
 */
class DaVinciCollectorValueApplierTest {

    private fun nodeWith(vararg collectors: com.pingidentity.davinci.plugin.Collector<*>) =
        object : ContinueNode(
            context = FlowContext(SharedContext(mutableMapOf())),
            workflow = Workflow(WorkflowConfig()),
            input = buildJsonObject { },
            actions = listOf(*collectors)
        ) {
            override fun asRequest(): HttpRequest = throw UnsupportedOperationException()
        }

    private fun inputWithCollectors(vararg keyValuePairs: Pair<String, Any?>): JavaOnlyMap {
        val collectorsArray = JavaOnlyArray()
        for ((key, value) in keyValuePairs) {
            val entry = JavaOnlyMap().apply {
                putString("key", key)
                when (value) {
                    is String -> putString("value", value)
                    is Boolean -> putBoolean("value", value)
                    is Int -> putInt("value", value)
                    is Double -> putDouble("value", value)
                    is List<*> -> {
                        val arr = JavaOnlyArray()
                        value.forEach { arr.pushString(it as String) }
                        putArray("value", arr)
                    }
                    is JavaOnlyMap -> putMap("value", value)
                    else -> putNull("value")
                }
            }
            collectorsArray.pushMap(entry)
        }
        return JavaOnlyMap().apply {
            putArray("collectors", collectorsArray)
        }
    }

    private fun deviceMap(vararg pairs: Pair<String, String>): JavaOnlyMap =
        JavaOnlyMap().apply { pairs.forEach { (k, v) -> putString(k, v) } }

    @Test
    fun applyTextCollectorSetsValue() {
        val collector = TextCollector()
        val node = nodeWith(collector)
        val collectorKey = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(collectorKey to "john@example.com"))

        assertEquals("john@example.com", collector.value)
    }

    @Test
    fun applyPasswordCollectorSetsValue() {
        val collector = PasswordCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to "s3cr3t!"))

        assertEquals("s3cr3t!", collector.value)
    }

    @Test
    fun applySubmitCollectorSetsValue() {
        val collector = SubmitCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to "submit"))

        assertEquals("submit", collector.value)
    }

    @Test
    fun applyFlowCollectorReturnsTrueForIsFlowTrigger() {
        val collector = FlowCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        val result = DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to "flow-action"))

        assertTrue(result.isFlowTrigger)
    }

    @Test
    fun applyNonFlowCollectorReturnsFalseForIsFlowTrigger() {
        val collector = TextCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        val result = DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to "hello"))

        assertFalse(result.isFlowTrigger)
    }

    @Test
    fun applyMultiSelectCollectorSetsListValue() {
        val collector = MultiSelectCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to listOf("option1", "option2")))

        assertEquals(listOf("option1", "option2"), collector.value)
    }

    @Test
    fun applySingleSelectCollectorSetsValue() {
        val collector = SingleSelectCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to "selected-option"))

        assertEquals("selected-option", collector.value)
    }

    @Test
    fun applyTextCollectorCoercesIntegerNumberWithoutTrailingZero() {
        val collector = TextCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to 5))

        assertEquals("5", collector.value)
    }

    @Test
    fun applyTextCollectorCoercesIntegerValuedDoubleWithoutTrailingZero() {
        val collector = TextCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to 5.0))

        assertEquals("5", collector.value)
    }

    @Test
    fun applyTextCollectorPreservesFractionalDouble() {
        val collector = TextCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors(key to 5.5))

        assertEquals("5.5", collector.value)
    }

    @Test
    fun applyEmptyCollectorsArrayReturnsNotFlowTrigger() {
        val node = nodeWith(TextCollector())
        val input = JavaOnlyMap().apply {
            putArray("collectors", JavaOnlyArray())
        }

        val result = DaVinciCollectorValueApplier.apply(node, input)

        assertFalse(result.isFlowTrigger)
    }

    @Test
    fun applyNullCollectorsArrayReturnsNotFlowTrigger() {
        val node = nodeWith(TextCollector())
        val input = JavaOnlyMap()

        val result = DaVinciCollectorValueApplier.apply(node, input)

        assertFalse(result.isFlowTrigger)
    }

    @Test(expected = IllegalArgumentException::class)
    fun applyThrowsWhenCollectorKeyNotFound() {
        val collector = TextCollector()
        val node = nodeWith(collector)

        DaVinciCollectorValueApplier.apply(node, inputWithCollectors("no-such-key" to "value"))
    }

    @Test
    fun applyDeviceRegistrationCollectorSelectsDeviceByType() {
        val collector = DeviceRegistrationCollector().apply {
            init(buildJsonObject {
                put("key", "device-reg-key")
                put("type", "DEVICE_REGISTRATION")
                putJsonArray("options") {
                    add(buildJsonObject {
                        put("id", "dev-email")
                        put("type", "EMAIL")
                        put("title", "Email")
                        put("description", "Email device")
                        put("iconSrc", "")
                        put("default", false)
                    })
                    add(buildJsonObject {
                        put("id", "dev-sms")
                        put("type", "SMS")
                        put("title", "SMS")
                        put("description", "SMS device")
                        put("iconSrc", "")
                        put("default", false)
                    })
                }
            })
        }
        val node = nodeWith(collector)

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors("device-reg-key" to deviceMap("type" to "SMS"))
        )

        val selected = collector.value
        assertNotNull(selected)
        assertEquals("SMS", selected?.type)
        assertEquals("dev-sms", selected?.id)
    }

    @Test
    fun applyDeviceRegistrationCollectorThrowsWhenTypeMissing() {
        val collector = DeviceRegistrationCollector().apply {
            init(buildJsonObject {
                put("key", "device-reg-key")
                put("type", "DEVICE_REGISTRATION")
                putJsonArray("options") {
                    add(buildJsonObject {
                        put("id", "dev-email")
                        put("type", "EMAIL")
                        put("title", "Email")
                        put("description", "")
                        put("iconSrc", "")
                        put("default", false)
                    })
                }
            })
        }
        val node = nodeWith(collector)

        try {
            DaVinciCollectorValueApplier.apply(
                node,
                inputWithCollectors("device-reg-key" to deviceMap("id" to "dev-email"))
            )
            throw AssertionError("expected IllegalArgumentException")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message?.contains("must include 'type'") == true)
        }
    }

    @Test
    fun applyDeviceRegistrationCollectorThrowsWhenTypeUnknown() {
        val collector = DeviceRegistrationCollector().apply {
            init(buildJsonObject {
                put("key", "device-reg-key")
                put("type", "DEVICE_REGISTRATION")
                putJsonArray("options") {
                    add(buildJsonObject {
                        put("id", "dev-email")
                        put("type", "EMAIL")
                        put("title", "Email")
                        put("description", "")
                        put("iconSrc", "")
                        put("default", false)
                    })
                }
            })
        }
        val node = nodeWith(collector)

        try {
            DaVinciCollectorValueApplier.apply(
                node,
                inputWithCollectors("device-reg-key" to deviceMap("type" to "PUSH"))
            )
            throw AssertionError("expected IllegalArgumentException")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message?.contains("no device found with type='PUSH'") == true)
        }
    }

    @Test
    fun applyDeviceAuthenticationCollectorSelectsExistingDeviceByType() {
        val collector = DeviceAuthenticationCollector().apply {
            init(buildJsonObject {
                put("key", "device-auth-key")
                put("type", "DEVICE_AUTHENTICATION")
                putJsonArray("options") {
                    add(buildJsonObject {
                        put("id", "dev-email")
                        put("type", "EMAIL")
                        put("title", "Email")
                        put("description", "")
                        put("iconSrc", "")
                        put("default", false)
                    })
                }
            })
        }
        val node = nodeWith(collector)

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors("device-auth-key" to deviceMap("type" to "EMAIL"))
        )

        val selected = collector.value
        assertNotNull(selected)
        assertEquals("EMAIL", selected?.type)
        assertEquals("dev-email", selected?.id)
    }

    @Test
    fun applyDeviceAuthenticationCollectorFabricatesDeviceWhenTypeNotInList() {
        val collector = DeviceAuthenticationCollector().apply {
            init(buildJsonObject {
                put("key", "device-auth-key")
                put("type", "DEVICE_AUTHENTICATION")
                putJsonArray("options") {
                    add(buildJsonObject {
                        put("id", "dev-email")
                        put("type", "EMAIL")
                        put("title", "Email")
                        put("description", "")
                        put("iconSrc", "")
                        put("default", false)
                    })
                }
            })
        }
        val node = nodeWith(collector)

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors(
                "device-auth-key" to deviceMap(
                    "id" to "new-id",
                    "type" to "WEBAUTHN",
                    "title" to "Passkey",
                    "description" to "Passkey device",
                    "iconSrc" to "icon://passkey"
                )
            )
        )

        val selected = collector.value
        assertNotNull(selected)
        assertEquals("WEBAUTHN", selected?.type)
        assertEquals("new-id", selected?.id)
        assertEquals("Passkey", selected?.title)
        assertEquals("Passkey device", selected?.description)
        assertEquals("icon://passkey", selected?.iconSrc)
    }

    @Test
    fun applyPhoneNumberCollectorSetsBothFields() {
        val collector = PhoneNumberCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors(key to deviceMap("countryCode" to "+1", "phoneNumber" to "5550001234"))
        )

        assertEquals("+1", collector.countryCode)
        assertEquals("5550001234", collector.phoneNumber)
    }

    @Test
    fun applyPhoneNumberCollectorSetsOnlyProvidedFields() {
        val collector = PhoneNumberCollector()
        val node = nodeWith(collector)
        val key = collector.id()

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors(key to deviceMap("phoneNumber" to "5550001234"))
        )

        assertEquals("5550001234", collector.phoneNumber)
    }

    @Test
    fun applyMultipleCollectorsInSingleInput() {
        val text = TextCollector().apply {
            init(buildJsonObject {
                put("key", "text-key")
                put("type", "TEXT")
                put("label", "Username")
            })
        }
        val password = PasswordCollector().apply {
            init(buildJsonObject {
                put("key", "password-key")
                put("type", "PASSWORD")
                put("label", "Password")
            })
        }
        val node = nodeWith(text, password)

        DaVinciCollectorValueApplier.apply(
            node,
            inputWithCollectors("text-key" to "username", "password-key" to "pass123")
        )

        assertEquals("username", text.value)
        assertEquals("pass123", password.value)
    }
}
