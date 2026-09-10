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
import org.junit.Assert.assertFalse
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

        assertEquals("https://example.com/.well-known/openid-configuration", payload.oidc.discoveryEndpoint)
        assertEquals("rn-client", payload.oidc.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.oidc.redirectUri)
        assertTrue(payload.oidc.scopes.isEmpty())
        assertNull(payload.oidc.par)
        assertNull(payload.oidc.storageId)
        assertNull(payload.loggerId)
        assertNull(payload.timeout)
        assertNull(payload.protect)
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
            putBoolean("par", true)
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

        assertEquals("rn-client", payload.oidc.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.oidc.redirectUri)
        assertEquals(listOf("openid", "profile"), payload.oidc.scopes)
        assertTrue(payload.oidc.par == true)
        assertEquals("storage-1", payload.oidc.storageId)
        assertEquals("logger-1", payload.loggerId)
        assertEquals(30000L, payload.timeout)
        assertEquals("com.example.app://signed-out", payload.oidc.signOutRedirectUri)
        assertEquals("demo-user", payload.oidc.loginHint)
        assertEquals("nonce-123", payload.oidc.nonce)
        assertEquals("state-123", payload.oidc.state)
        assertEquals("login", payload.oidc.prompt)
        assertEquals("page", payload.oidc.display)
        assertEquals("en fr", payload.oidc.uiLocales)
        assertEquals("loa-2", payload.oidc.acrValues)
        assertEquals(60L, payload.oidc.refreshThreshold)
        assertEquals(mapOf("audience" to "urn:example:api"), payload.oidc.additionalParameters)
    }

    /**
     * Verifies that parsing rejects a non-boolean PAR value.
     */
    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenParIsNotBoolean() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putString("par", "true")
        }

        DaVinciConfigParser.parse(config)
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

    @Test
    fun parseProtectAbsentReturnsNullProtect() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }

        val payload = DaVinciConfigParser.parse(config)

        assertNull(payload.protect)
    }

    @Test
    fun parseProtectDefaultsAreMapped() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putMap("protect", JavaOnlyMap())
        }

        val payload = DaVinciConfigParser.parse(config)
        val protect = payload.protect!!

        assertNull(protect.envId)
        assertTrue(protect.isBehavioralDataCollection)
        assertFalse(protect.isLazyMetadata)
        assertNull(protect.customHost)
        assertFalse(protect.isConsoleLogEnabled)
        assertTrue(protect.deviceAttributesToIgnore.isEmpty())
        assertFalse(protect.pauseBehavioralDataOnSuccess)
        assertFalse(protect.resumeBehavioralDataOnStart)
    }

    @Test
    fun parseProtectAllFieldsMapped() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putMap("protect", JavaOnlyMap().apply {
                putString("envId", "env-123")
                putBoolean("isBehavioralDataCollection", false)
                putBoolean("isLazyMetadata", true)
                putString("customHost", "https://custom.host")
                putBoolean("isConsoleLogEnabled", true)
                putArray("deviceAttributesToIgnore", JavaOnlyArray.of("deviceId", "screen"))
                putBoolean("pauseBehavioralDataOnSuccess", true)
                putBoolean("resumeBehavioralDataOnStart", true)
            })
        }

        val payload = DaVinciConfigParser.parse(config)
        val protect = payload.protect!!

        assertEquals("env-123", protect.envId)
        assertFalse(protect.isBehavioralDataCollection)
        assertTrue(protect.isLazyMetadata)
        assertEquals("https://custom.host", protect.customHost)
        assertTrue(protect.isConsoleLogEnabled)
        assertEquals(listOf("deviceId", "screen"), protect.deviceAttributesToIgnore)
        assertTrue(protect.pauseBehavioralDataOnSuccess)
        assertTrue(protect.resumeBehavioralDataOnStart)
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
