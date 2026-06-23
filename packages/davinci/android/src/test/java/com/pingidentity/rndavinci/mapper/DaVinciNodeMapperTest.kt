/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.mapper

import com.pingidentity.davinci.collector.FlowCollector
import com.pingidentity.davinci.collector.LabelCollector
import com.pingidentity.davinci.collector.MultiSelectCollector
import com.pingidentity.davinci.collector.PasswordCollector
import com.pingidentity.davinci.collector.SingleSelectCollector
import com.pingidentity.davinci.collector.SubmitCollector
import com.pingidentity.davinci.collector.TextCollector
import com.pingidentity.davinci.plugin.Collector
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
}
