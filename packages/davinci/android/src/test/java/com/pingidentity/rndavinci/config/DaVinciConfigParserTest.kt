/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.config

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for DaVinci config parser behavior.
 */
class DaVinciConfigParserTest {

    @Test
    fun parseMinimalConfig() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }

        val payload = DaVinciConfigParser.parse(config)

        assertEquals("https://example.com/.well-known/openid-configuration", payload.discoveryEndpoint)
        assertEquals("rn-client", payload.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.redirectUri)
        assertTrue(payload.scopes.isEmpty())
        assertNull(payload.storageId)
        assertNull(payload.loggerId)
        assertNull(payload.timeout)
    }

    @Test
    fun parseFullConfig() {
        val additionalParameters = JavaOnlyMap().apply {
            putString("audience", "urn:example:api")
        }
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putArray("scopes", JavaOnlyArray.of("openid", "profile"))
            putString("storageId", "storage-1")
            putString("loggerId", "logger-1")
            putDouble("timeout", 30000.0)
            putString("signOutRedirectUri", "com.example.app://signed-out")
            putString("loginHint", "demo-user")
            putString("nonce", "nonce-123")
            putString("state", "state-123")
            putString("prompt", "login")
            putString("display", "page")
            putString("uiLocales", "en fr")
            putString("acrValues", "loa-2")
            putDouble("refreshThreshold", 60.0)
            putMap("additionalParameters", additionalParameters)
        }

        val payload = DaVinciConfigParser.parse(config)

        assertEquals("rn-client", payload.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.redirectUri)
        assertEquals(listOf("openid", "profile"), payload.scopes)
        assertEquals("storage-1", payload.storageId)
        assertEquals("logger-1", payload.loggerId)
        assertEquals(30000L, payload.timeout)
        assertEquals("com.example.app://signed-out", payload.signOutRedirectUri)
        assertEquals("demo-user", payload.loginHint)
        assertEquals("nonce-123", payload.nonce)
        assertEquals("state-123", payload.state)
        assertEquals("login", payload.prompt)
        assertEquals("page", payload.display)
        assertEquals("en fr", payload.uiLocales)
        assertEquals("loa-2", payload.acrValues)
        assertEquals(60L, payload.refreshThreshold)
        assertEquals(mapOf("audience" to "urn:example:api"), payload.additionalParameters)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenDiscoveryEndpointMissing() {
        val config = JavaOnlyMap().apply {
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }

        DaVinciConfigParser.parse(config)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenClientIdMissing() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }

        DaVinciConfigParser.parse(config)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenRedirectUriMissing() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
        }

        DaVinciConfigParser.parse(config)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenDiscoveryEndpointBlank() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "   ")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }

        DaVinciConfigParser.parse(config)
    }
}
