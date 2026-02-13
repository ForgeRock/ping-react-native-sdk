/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for Journey config parser.
 */
class JourneyConfigParserTest {

    @Test
    fun parseMinimalConfig() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertNull(payload.clientId)
        assertNull(payload.discoveryEndpoint)
        assertNull(payload.redirectUri)
    }

    @Test
    fun parseFullConfig() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("realm", "alpha")
            putString("cookie", "iPlanetDirectoryPro")
            putString("clientId", "rn-client")
            putString("discoveryEndpoint", "https://example.com/am/oauth2/alpha/.well-known/openid-configuration")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putArray("scopes", JavaOnlyArray.of("openid", "profile"))
            putString("sessionStorageId", "storage-1")
            putString("loggerId", "logger-1")
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertEquals("alpha", payload.realm)
        assertEquals("iPlanetDirectoryPro", payload.cookie)
        assertEquals("rn-client", payload.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.redirectUri)
        assertEquals(listOf("openid", "profile"), payload.scopes)
        assertEquals("storage-1", payload.sessionStorageId)
        assertEquals("logger-1", payload.loggerId)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenOidcConfigIsPartial() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("clientId", "rn-client")
        }

        JourneyConfigParser.parse(config)
    }
}
