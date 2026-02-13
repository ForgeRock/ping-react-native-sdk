/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.pingidentity.journey.callback.NameCallback
import com.pingidentity.journey.callback.ValidatedPasswordCallback
import com.pingidentity.journey.callback.ValidatedUsernameCallback
import com.pingidentity.orchestrate.EmptySession
import com.pingidentity.orchestrate.ErrorNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.orchestrate.SuccessNode
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/**
 * Unit tests for Journey node and callback mapping.
 */
class JourneyNodeMapperTest {

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
        assertNotNull(map["id"])
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
    fun mapUnknownCallbackReturnsOpaqueMetadata() {
        class UnknownCustomCallback

        val map = JourneyNodeMapper.mapCallbackPayload(UnknownCustomCallback())

        assertEquals("UnknownCustomCallback", map["type"])
        assertEquals(true, map["opaque"])
        assertNotNull(map["nativeClass"])
    }
}
