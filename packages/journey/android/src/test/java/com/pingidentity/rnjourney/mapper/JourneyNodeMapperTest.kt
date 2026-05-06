/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.pingidentity.orchestrate.Action
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.journey.callback.BooleanAttributeInputCallback
import com.pingidentity.journey.callback.ChoiceCallback
import com.pingidentity.journey.callback.ConsentMappingCallback
import com.pingidentity.journey.callback.ConfirmationCallback
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
import com.pingidentity.orchestrate.EmptySession
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.orchestrate.SuccessNode
import com.pingidentity.orchestrate.Workflow
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for Journey node and callback mapping.
 */
class JourneyNodeMapperTest {

    @Test
    fun mapContinueNodeReturnsCompletePayload() {
        val context = FlowContext(SharedContext(mutableMapOf("flowId" to "abc-123")))
        val workflow = Workflow { }
        val action = object : Action {
            override fun toString(): String = "FakeAction"
        }
        val node = object : ContinueNode(
            context = context,
            workflow = workflow,
            input = buildJsonObject {
                put("stage", "login")
            },
            actions = listOf(action)
        ) {
            override fun asRequest() = throw UnsupportedOperationException("Not used in mapper tests")
        }

        val map = JourneyNodeMapper.mapNodePayload(node)

        assertEquals("ContinueNode", map["type"])
        assertEquals("login", (map["input"] as Map<*, *>)["stage"])
        assertTrue((map["callbacks"] as List<*>).isEmpty())
    }

    @Test
    fun mapErrorNodeReturnsErrorPayload() {
        val node = ErrorNode(
            FlowContext(SharedContext(mutableMapOf())),
            buildJsonObject { },
            "Invalid credentials"
        )

        val map = JourneyNodeMapper.mapNodePayload(node)

        assertEquals("ErrorNode", map["type"])
        assertEquals("Invalid credentials", map["message"])
        assertNotNull(map["input"])
    }

    @Test
    fun mapFailureNodeReturnsFailurePayload() {
        val node = FailureNode(IllegalStateException("Network down"))

        val map = JourneyNodeMapper.mapNodePayload(node)

        assertEquals("FailureNode", map["type"])
        assertEquals("Network down", map["message"])
        assertEquals("Network down", map["cause"])
    }

    @Test
    fun mapSuccessNodeReturnsSuccessPayload() {
        val node = SuccessNode(buildJsonObject { }, EmptySession)

        val map = JourneyNodeMapper.mapNodePayload(node)

        assertEquals("SuccessNode", map["type"])
        assertNotNull(map["input"])
    }

    @Test
    fun mapCallbackReturnsCallbackTypeAndValue() {
        val callback = NameCallback().apply {
            name = "demo-user"
        }

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("NameCallback", map["type"])
        assertEquals("demo-user", map["value"])
    }

    @Test
    fun mapValidatedCallbacksUsesCreateAliasTypes() {
        val passwordMap = JourneyNodeMapper.mapCallbackPayload(ValidatedPasswordCallback())
        val usernameMap = JourneyNodeMapper.mapCallbackPayload(ValidatedUsernameCallback())

        assertEquals("ValidatedCreatePasswordCallback", passwordMap["type"])
        assertEquals("ValidatedCreateUsernameCallback", usernameMap["type"])
    }

    @Test
    fun mapExternalIdpCallbacksUsesCanonicalAliasTypes() {
        class IdPCallback
        class SelectIdPCallback

        val idpMap = JourneyNodeMapper.mapCallbackPayload(IdPCallback())
        val selectIdpMap = JourneyNodeMapper.mapCallbackPayload(SelectIdPCallback())

        assertEquals("IdpCallback", idpMap["type"])
        assertEquals("SelectIdpCallback", selectIdpMap["type"])
    }

    @Test
    fun mapBooleanAttributeInputCallbackIncludesAmFields() {
        val callback = BooleanAttributeInputCallback().apply {
            value = true
        }

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("BooleanAttributeInputCallback", map["type"])
        assertEquals(true, map["value"])
        assertTrue(map.containsKey("prompt"))
        assertTrue(map.containsKey("name"))
        assertTrue(map.containsKey("required"))
        assertTrue(map.containsKey("validateOnly"))
        assertTrue(map.containsKey("policies"))
        assertTrue(map.containsKey("failedPolicies"))
    }

    @Test
    fun mapTextInputCallbackIncludesDefaultTextField() {
        val callback = TextInputCallback()

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("TextInputCallback", map["type"])
        assertTrue(map.containsKey("defaultText"))
        assertTrue(map.containsKey("prompt"))
    }

    @Test
    fun mapConfirmationCallbackHandlesUninitializedMetadataSafely() {
        val callback = ConfirmationCallback()

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("ConfirmationCallback", map["type"])
        assertEquals(-1, map["selectedIndex"])
    }

    @Test
    fun mapConsentMappingCallbackIncludesAmFields() {
        val callback = ConsentMappingCallback().apply {
            accepted = true
        }

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("ConsentMappingCallback", map["type"])
        assertEquals(true, map["accepted"])
        assertTrue(map.containsKey("name"))
        assertTrue(map.containsKey("displayName"))
        assertTrue(map.containsKey("icon"))
        assertTrue(map.containsKey("accessLevel"))
        assertTrue(map.containsKey("required"))
        assertTrue(map.containsKey("fields"))
        assertTrue(map.containsKey("message"))
    }

    @Test
    fun mapTextOutputCallbackIncludesMessageType() {
        val callback = TextOutputCallback()

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("TextOutputCallback", map["type"])
        assertTrue(map.containsKey("message"))
    }

    @Test
    fun mapValidatedPasswordCallbackIncludesEchoOn() {
        val callback = ValidatedPasswordCallback()

        val map = JourneyNodeMapper.mapCallbackPayload(callback)

        assertEquals("ValidatedCreatePasswordCallback", map["type"])
        assertTrue(map.containsKey("echoOn"))
        assertTrue(map.containsKey("validateOnly"))
        assertTrue(map.containsKey("policies"))
        assertTrue(map.containsKey("failedPolicies"))
    }

    @Test
    fun mapUnknownCallbackReturnsTypeOnly() {
        class UnknownCustomCallback

        val map = JourneyNodeMapper.mapCallbackPayload(UnknownCustomCallback())

        assertEquals("UnknownCustomCallback", map["type"])
        assertEquals(1, map.size)
    }

    @Test
    fun mapCallbackReadsRequiredFromGetter() {
        class RequiredCallback {
            fun isRequired(): Boolean = true
        }

        val map = JourneyNodeMapper.mapCallbackPayload(RequiredCallback())

        assertEquals("RequiredCallback", map["type"])
        assertEquals(true, map["required"])
    }

    @Test
    fun mapCoreCallbackFamiliesExposeExpectedTypeAliases() {
        val callbacks = listOf(
            Pair<Any, String>(NameCallback(), "NameCallback"),
            Pair<Any, String>(PasswordCallback(), "PasswordCallback"),
            Pair<Any, String>(TextInputCallback(), "TextInputCallback"),
            Pair<Any, String>(StringAttributeInputCallback(), "StringAttributeInputCallback"),
            Pair<Any, String>(NumberAttributeInputCallback(), "NumberAttributeInputCallback"),
            Pair<Any, String>(BooleanAttributeInputCallback(), "BooleanAttributeInputCallback"),
            Pair<Any, String>(ChoiceCallback(), "ChoiceCallback"),
            Pair<Any, String>(ConfirmationCallback(), "ConfirmationCallback"),
            Pair<Any, String>(ConsentMappingCallback(), "ConsentMappingCallback"),
            Pair<Any, String>(HiddenValueCallback(), "HiddenValueCallback"),
            Pair<Any, String>(KbaCreateCallback(), "KbaCreateCallback"),
            Pair<Any, String>(MetadataCallback(), "MetadataCallback"),
            Pair<Any, String>(PollingWaitCallback(), "PollingWaitCallback"),
            Pair<Any, String>(SuspendedTextOutputCallback(), "SuspendedTextOutputCallback"),
            Pair<Any, String>(TermsAndConditionsCallback(), "TermsAndConditionsCallback"),
            Pair<Any, String>(TextOutputCallback(), "TextOutputCallback"),
            Pair<Any, String>(ValidatedPasswordCallback(), "ValidatedCreatePasswordCallback"),
            Pair<Any, String>(ValidatedUsernameCallback(), "ValidatedCreateUsernameCallback")
        )

        callbacks.forEach { callbackPair ->
            val map = JourneyNodeMapper.mapCallbackPayload(callbackPair.first)
            assertEquals(callbackPair.second, map["type"])
        }
    }
}
