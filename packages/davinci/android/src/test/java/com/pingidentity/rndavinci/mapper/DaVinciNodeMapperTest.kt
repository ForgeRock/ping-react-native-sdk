/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.mapper

import com.pingidentity.davinci.collector.DeviceAuthenticationCollector
import com.pingidentity.davinci.collector.DeviceRegistrationCollector
import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.LabelCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PasswordCollector
import com.pingidentity.davinci.collector.PhoneNumberCollector
import com.pingidentity.davinci.collector.SingleSelectCollector
import com.pingidentity.davinci.collector.SubmitCollector
import com.pingidentity.davinci.collector.TextCollector
import com.pingidentity.davinci.plugin.Collector
import com.pingidentity.idp.davinci.IdpCollector
import com.pingidentity.network.HttpRequest
import com.pingidentity.orchestrate.Action
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.EmptySession
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.orchestrate.SuccessNode
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.orchestrate.WorkflowConfig
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DaVinciNodeMapperTest {

    private fun makeNode(vararg actions: Action) = makeNode(
        buildJsonObject { put("form", buildJsonObject { }) },
        *actions
    )

    private fun makeNode(input: JsonObject, vararg actions: Action) = object : ContinueNode(
        context = FlowContext(SharedContext(mutableMapOf())),
        workflow = Workflow(WorkflowConfig()),
        input = input,
        actions = listOf(*actions)
    ) {
        override fun asRequest(): HttpRequest = throw UnsupportedOperationException()
    }

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.asMap(key: String): Map<String, Any?>? =
        this[key] as? Map<String, Any?>

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.asList(key: String): List<Map<String, Any?>>? =
        this[key] as? List<Map<String, Any?>>

    private fun makeIdpCollector(
        idpId: String,
        idpType: String,
        label: String,
        href: String? = null
    ): IdpCollector {
        val linksJson = href?.let {
            buildJsonObject {
                put("authenticate", buildJsonObject { put("href", it) })
            }
        }
        return IdpCollector().apply {
            init(buildJsonObject {
                put("idpId", idpId)
                put("idpType", idpType)
                put("label", label)
                put("idpEnabled", true)
                if (linksJson != null) put("links", linksJson)
            })
        }
    }

    // ---- Node type tests ----

    @Test
    fun mapSuccessNodeReturnsTypeAndSession() {
        val node = SuccessNode(buildJsonObject { }, EmptySession)

        val result = DaVinciNodeMapper.mapNodePayload(node)

        assertEquals("SuccessNode", result["type"])
        val session = result.asMap("session")
        assertNotNull(session)
        assertEquals(EmptySession.value, session!!["value"])
    }

    @Test
    fun mapErrorNodeReturnsTypeAndMessage() {
        val node = ErrorNode(
            FlowContext(SharedContext(mutableMapOf())),
            buildJsonObject { },
            "Authentication failed"
        )

        val result = DaVinciNodeMapper.mapNodePayload(node)

        assertEquals("ErrorNode", result["type"])
        assertEquals("Authentication failed", result["message"])
    }

    @Test
    fun mapErrorNodeIncludesInputPayload() {
        val node = ErrorNode(
            FlowContext(SharedContext(mutableMapOf())),
            buildJsonObject {
                put("code", "invalid_request")
                put("description", "missing parameter")
            },
            "Authentication failed"
        )

        val result = DaVinciNodeMapper.mapNodePayload(node)

        val input = result.asMap("input")
        assertNotNull(input)
        assertEquals("invalid_request", input!!["code"])
        assertEquals("missing parameter", input["description"])
    }

    @Test
    fun mapFailureNodeReturnsTypeAndCauseMessage() {
        val node = FailureNode(RuntimeException("Network error"))

        val result = DaVinciNodeMapper.mapNodePayload(node)

        assertEquals("FailureNode", result["type"])
        assertEquals("Network error", result["message"])
        assertEquals("Network error", result["cause"])
    }

    @Test
    fun mapContinueNodeReturnsTypeAndCollectorsArray() {
        val node = makeNode()

        val result = DaVinciNodeMapper.mapNodePayload(node)

        assertEquals("ContinueNode", result["type"])
        assertNotNull(result.asList("collectors"))
    }

    @Test
    fun mapContinueNodeIncludesInputPayload() {
        val input = buildJsonObject {
            put("flowKey", "abc-123")
            put("form", buildJsonObject { })
        }
        val node = makeNode(input)

        val result = DaVinciNodeMapper.mapNodePayload(node)

        val emittedInput = result.asMap("input")
        assertNotNull(emittedInput)
        assertEquals("abc-123", emittedInput!!["flowKey"])
        assertNotNull(emittedInput["form"])
    }

    @Test
    fun mapContinueNodeSkipsNonCollectorActions() {
        val nonCollectorAction = object : Action {
            override fun toString() = "IgnoredAction"
        }
        val node = makeNode(nonCollectorAction)

        val result = DaVinciNodeMapper.mapNodePayload(node)

        val collectors = result.asList("collectors")!!
        assertEquals(0, collectors.size)
    }

    // ---- Collector type tests ----

    @Test
    fun mapTextCollectorIncludesBaseFields() {
        val collector = TextCollector()
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        assertEquals(1, collectors.size)
        val c = collectors[0]
        assertTrue(c.containsKey("key"))
        assertTrue(c.containsKey("type"))
        assertTrue(c.containsKey("label"))
        assertTrue(c.containsKey("required"))
        assertTrue(c.containsKey("value"))
    }

    @Test
    fun mapPasswordCollectorHasEmptyValueAndClearPasswordField() {
        val collector = PasswordCollector()
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertEquals("", c["value"])
        assertTrue(c.containsKey("clearPassword"))
    }

    @Test
    fun mapSubmitCollectorIncludesBaseFields() {
        val collector = SubmitCollector()
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertTrue(c.containsKey("key"))
        assertTrue(c.containsKey("type"))
        assertTrue(c.containsKey("label"))
        assertTrue(c.containsKey("required"))
    }

    @Test
    fun mapFlowCollectorIncludesBaseFields() {
        val collector = FlowCollector()
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertTrue(c.containsKey("key"))
        assertTrue(c.containsKey("type"))
    }

    @Test
    fun mapSingleSelectCollectorIncludesOptionsAndValue() {
        val collector = SingleSelectCollector().apply {
            init(buildJsonObject {
                put("key", "single-key")
                put("type", "DROPDOWN")
                put("label", "Pick one")
                put("options", buildJsonArray { })
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertTrue(c.containsKey("value"))
        assertTrue(c.containsKey("options"))
    }

    @Test
    fun mapMultiSelectCollectorIncludesValueArray() {
        val collector = MultiSelectCollector().apply {
            init(buildJsonObject {
                put("key", "multi-key")
                put("type", "CHECKBOX")
                put("label", "Pick many")
                put("options", buildJsonArray { })
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertTrue(c.containsKey("value"))
        assertTrue(c.containsKey("options"))
    }

    @Test
    fun mapLabelCollectorUsesLabelTypeAndContentField() {
        val collector = LabelCollector()
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        val c = collectors[0]
        assertEquals("LABEL", c["type"])
        assertTrue(c.containsKey("content"))
        assertTrue(c.containsKey("key"))
    }

    // ---- Raw field passthrough tests ----

    @Test
    fun mapCollectorIncludesRawFieldFromMatchingFormField() {
        val collector = TextCollector().apply {
            init(buildJsonObject {
                put("key", "username")
                put("type", "TEXT")
                put("label", "Username")
            })
        }
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray {
                        add(buildJsonObject {
                            put("key", "username")
                            put("type", "TEXT")
                            put("label", "Username")
                            put("validation", buildJsonObject {
                                put("regex", "^.+$")
                            })
                        })
                    })
                })
            })
        }
        val node = makeNode(input, collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]
        @Suppress("UNCHECKED_CAST")
        val raw = c["raw"] as? Map<String, Any?>
        assertNotNull(raw)
        assertEquals("username", raw!!["key"])
        assertEquals("TEXT", raw["type"])
        assertNotNull(raw["validation"])
    }

    @Test
    fun mapCollectorOmitsRawWhenNoMatchingField() {
        val collector = SubmitCollector().apply {
            init(buildJsonObject {
                put("key", "submit-button")
                put("type", "SUBMIT_BUTTON")
                put("label", "Submit")
            })
        }
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray { })
                })
            })
        }
        val node = makeNode(input, collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]
        assertFalse(c.containsKey("raw"))
    }

    // ---- Unsupported field surfacing tests ----

    @Test
    fun mapContinueNodeSurfacesUnregisteredFormFields() {
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray {
                        add(buildJsonObject {
                            put("key", "dropdown-1")
                            put("type", "DROPDOWN")
                        })
                        add(buildJsonObject {
                            put("key", "checkbox-1")
                            put("inputType", "CHECKBOX")
                            put("type", "FIELD")
                        })
                    })
                })
            })
        }
        val node = makeNode(input)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val unsupported = result.asList("unsupportedFields")
        assertNotNull(unsupported)
        assertEquals(2, unsupported!!.size)

        assertEquals("dropdown-1", unsupported[0]["key"])
        assertEquals("DROPDOWN", unsupported[0]["type"])

        assertEquals("checkbox-1", unsupported[1]["key"])
        assertEquals("CHECKBOX", unsupported[1]["type"])
    }

    @Test
    fun mapContinueNodeOmitsUnsupportedFieldsWhenAllFieldsRegistered() {
        val collector = TextCollector().apply {
            init(buildJsonObject {
                put("key", "text-1")
                put("type", "TEXT")
                put("label", "Username")
            })
        }
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray {
                        add(buildJsonObject {
                            put("key", "text-1")
                            put("type", "TEXT")
                        })
                    })
                })
            })
        }
        val node = makeNode(input, collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        assertFalse(result.containsKey("unsupportedFields"))
    }

    @Test
    fun mapContinueNodeOmitsUnsupportedFieldsWhenFormMissing() {
        val node = makeNode(buildJsonObject { })

        val result = DaVinciNodeMapper.mapNodePayload(node)
        assertFalse(result.containsKey("unsupportedFields"))
    }

    @Test
    fun mapUnknownCollectorIsSkipped() {
        val unknownCollector = object : Collector<String> {
            override fun id(): String = "unknown-key"
            override fun init(json: JsonObject): Collector<String> = this
            override fun payload(): String = ""
        }
        val node = makeNode(unknownCollector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val collectors = result.asList("collectors")!!
        assertEquals(0, collectors.size)
    }

    // ---- PhoneNumberCollector ----

    @Test
    fun mapPhoneNumberCollectorIncludesBaseAndPhoneFields() {
        val collector = PhoneNumberCollector().apply {
            init(buildJsonObject {
                put("key", "phone")
                put("type", "PHONE")
                put("label", "Phone Number")
                put("defaultCountryCode", "US")
                put("validatePhoneNumber", true)
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("phone", c["key"])
        assertEquals("PHONE", c["type"])
        assertEquals("US", c["defaultCountryCode"])
        assertEquals(true, c["validatePhoneNumber"])
        assertTrue(c.containsKey("countryCode"))
        assertTrue(c.containsKey("phoneNumber"))
    }

    @Test
    fun mapPhoneNumberCollectorDefaultCountryCodeFallsBackToEmpty() {
        val collector = PhoneNumberCollector().apply {
            init(buildJsonObject {
                put("key", "phone")
                put("type", "PHONE")
                put("label", "Phone")
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("", c["defaultCountryCode"])
        assertEquals(false, c["validatePhoneNumber"])
    }

    // ---- DeviceRegistrationCollector ----

    @Test
    fun mapDeviceRegistrationCollectorIncludesDevicesArray() {
        val collector = DeviceRegistrationCollector().apply {
            init(buildJsonObject {
                put("key", "device-reg")
                put("type", "DEVICE_REGISTRATION")
                put("label", "Register Device")
                put("options", buildJsonArray {
                    add(buildJsonObject {
                        put("id", "dev-1")
                        put("type", "TOTP")
                        put("title", "TOTP App")
                        put("iconSrc", "https://example.com/icon.png")
                        put("default", false)
                    })
                })
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("device-reg", c["key"])
        assertTrue(c.containsKey("devices"))
        @Suppress("UNCHECKED_CAST")
        val devices = c["devices"] as? List<Map<String, Any?>>
        assertNotNull(devices)
        assertEquals(1, devices!!.size)
        assertEquals("dev-1", devices[0]["id"])
        assertEquals("TOTP", devices[0]["type"])
        assertEquals("TOTP App", devices[0]["title"])
    }

    @Test
    fun mapDeviceRegistrationCollectorEmptyDevicesWhenNoOptions() {
        val collector = DeviceRegistrationCollector().apply {
            init(buildJsonObject {
                put("key", "device-reg")
                put("type", "DEVICE_REGISTRATION")
                put("label", "Register Device")
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        @Suppress("UNCHECKED_CAST")
        val devices = c["devices"] as? List<*>
        assertNotNull(devices)
        assertEquals(0, devices!!.size)
    }

    // ---- DeviceAuthenticationCollector ----

    @Test
    fun mapDeviceAuthenticationCollectorIncludesDevicesArray() {
        val collector = DeviceAuthenticationCollector().apply {
            init(buildJsonObject {
                put("key", "device-auth")
                put("type", "DEVICE_AUTHENTICATION")
                put("label", "Authenticate Device")
                put("options", buildJsonArray {
                    add(buildJsonObject {
                        put("id", "dev-2")
                        put("type", "PUSH")
                        put("title", "Push Notification")
                        put("iconSrc", "https://example.com/push.png")
                        put("default", true)
                    })
                })
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("device-auth", c["key"])
        assertTrue(c.containsKey("devices"))
        @Suppress("UNCHECKED_CAST")
        val devices = c["devices"] as? List<Map<String, Any?>>
        assertNotNull(devices)
        assertEquals(1, devices!!.size)
        assertEquals("dev-2", devices[0]["id"])
        assertEquals("PUSH", devices[0]["type"])
        assertEquals(true, devices[0]["isDefault"])
    }

    // ---- Password policy extraction ----

    @Test
    fun mapPasswordCollectorExtractsPasswordPolicyFromFormField() {
        val collector = PasswordCollector().apply {
            init(buildJsonObject {
                put("key", "password")
                put("type", "PASSWORD")
                put("label", "Password")
            })
        }
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray {
                        add(buildJsonObject {
                            put("key", "password")
                            put("type", "PASSWORD")
                            put("label", "Password")
                            put("passwordPolicy", buildJsonObject {
                                put("name", "Standard Policy")
                                put("minAgeDays", 0)
                                put("maxAgeDays", 90)
                                put("maxRepeatedCharacters", 2)
                                put("minUniqueCharacters", 5)
                                put("excludesProfileData", false)
                                put("notSimilarToCurrent", true)
                                put("excludesCommonlyUsed", true)
                                put("populationCount", 0)
                                put("default", true)
                            })
                        })
                    })
                })
            })
        }
        val node = makeNode(input, collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertTrue(c.containsKey("passwordPolicy"))
        @Suppress("UNCHECKED_CAST")
        val policy = c["passwordPolicy"] as? Map<String, Any?>
        assertNotNull(policy)
        assertEquals("Standard Policy", policy!!["name"])
        assertEquals(90L, policy["maxAgeDays"])
        assertEquals(true, policy["notSimilarToCurrent"])
    }

    @Test
    fun mapPasswordCollectorOmitsPasswordPolicyWhenNotInFormField() {
        val collector = PasswordCollector().apply {
            init(buildJsonObject {
                put("key", "password")
                put("type", "PASSWORD")
                put("label", "Password")
            })
        }
        val input = buildJsonObject {
            put("form", buildJsonObject {
                put("components", buildJsonObject {
                    put("fields", buildJsonArray {
                        add(buildJsonObject {
                            put("key", "password")
                            put("type", "PASSWORD")
                            put("label", "Password")
                        })
                    })
                })
            })
        }
        val node = makeNode(input, collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertFalse(c.containsKey("passwordPolicy"))
    }

    // ---- IdpCollector ----

    @Test
    fun mapIdpCollectorEmitsTypeIDP() {
        val collector = makeIdpCollector(idpId = "google-idp-1", idpType = "GOOGLE", label = "Sign in with Google")
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals(DaVinciNodeMapper.SOCIAL_LOGIN_BUTTON, c["type"])
    }

    @Test
    fun mapIdpCollectorUsesIdpIdAsKey() {
        val collector = makeIdpCollector(idpId = "facebook-idp-42", idpType = "FACEBOOK", label = "Sign in with Facebook")
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("facebook-idp-42", c["key"])
        assertEquals("facebook-idp-42", c["idpId"])
    }

    @Test
    fun mapIdpCollectorEmitsIdpTypeAndLabel() {
        val collector = makeIdpCollector(idpId = "apple-idp-99", idpType = "APPLE", label = "Sign in with Apple")
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals("APPLE", c["idpType"])
        assertEquals("Sign in with Apple", c["label"])
        assertEquals(true, c["idpEnabled"])
    }

    @Test
    fun mapIdpCollectorEmitsLinkWhenPresent() {
        val href = "https://auth.pingone.com/connections/idp-1/loginFirstFactor?interactionId=abc"
        val collector = makeIdpCollector(idpId = "google-idp-1", idpType = "GOOGLE", label = "Google", href = href)
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertEquals(href, c["link"])
    }

    @Test
    fun mapPasswordCollectorOmitsPasswordPolicyWhenNoFormPresent() {
        val collector = PasswordCollector().apply {
            init(buildJsonObject {
                put("key", "password")
                put("type", "PASSWORD")
                put("label", "Password")
            })
        }
        val node = makeNode(collector)

        val result = DaVinciNodeMapper.mapNodePayload(node)
        val c = result.asList("collectors")!![0]

        assertFalse(c.containsKey("passwordPolicy"))
    }
}
