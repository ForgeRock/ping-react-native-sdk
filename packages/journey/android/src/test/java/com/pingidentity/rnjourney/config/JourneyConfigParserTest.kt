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
        assertNull(payload.timeout)
        assertNull(payload.clientId)
        assertNull(payload.discoveryEndpoint)
        assertNull(payload.redirectUri)
    }

    @Test
    fun parseFullConfig() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putDouble("timeout", 120000.0)
            putString("realm", "alpha")
            putString("cookie", "iPlanetDirectoryPro")
            putString("clientId", "rn-client")
            putString("discoveryEndpoint", "https://example.com/am/oauth2/alpha/.well-known/openid-configuration")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putArray("scopes", JavaOnlyArray.of("openid", "profile"))
            putString("sessionStorageId", "storage-1")
            putString("oidcStorageId", "oidc-storage-1")
            putString("loggerId", "logger-1")
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertEquals(120000L, payload.timeout)
        assertEquals("alpha", payload.realm)
        assertEquals("iPlanetDirectoryPro", payload.cookie)
        assertEquals("rn-client", payload.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.redirectUri)
        assertEquals(listOf("openid", "profile"), payload.scopes)
        assertNull(payload.openId)
        assertNull(payload.acrValues)
        assertNull(payload.signOutRedirectUri)
        assertNull(payload.state)
        assertNull(payload.nonce)
        assertNull(payload.uiLocales)
        assertNull(payload.refreshThreshold)
        assertNull(payload.loginHint)
        assertNull(payload.display)
        assertNull(payload.prompt)
        assertEquals(emptyMap<String, String>(), payload.additionalParameters)
        assertEquals("storage-1", payload.sessionStorageId)
        assertEquals("oidc-storage-1", payload.oidcStorageId)
        assertEquals("logger-1", payload.loggerId)
        assertNull(payload.oidcClientId)
    }

    @Test
    fun parseConfigWithOidcClientHandle() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("oidcClientId", "oidc-client-1")
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertNull(payload.timeout)
        assertEquals("oidc-client-1", payload.oidcClientId)
        assertNull(payload.clientId)
        assertNull(payload.discoveryEndpoint)
        assertNull(payload.redirectUri)
    }

    @Test
    fun parseConfigWithOpenIdAndAdvancedOidcSettings() {
        val openId = JavaOnlyMap().apply {
            putString("authorizationEndpoint", "https://example.com/am/oauth2/authorize")
            putString("tokenEndpoint", "https://example.com/am/oauth2/token")
            putString("userinfoEndpoint", "https://example.com/am/oauth2/userinfo")
            putString("endSessionEndpoint", "https://example.com/am/oauth2/connect/endSession")
            putString("pingEndIdpSessionEndpoint", "https://example.com/am/XUI/#logout")
            putString("revocationEndpoint", "https://example.com/am/oauth2/revoke")
        }
        val additionalParameters = JavaOnlyMap().apply {
            putString("audience", "urn:example:api")
            putString("foo", "bar")
        }
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
            putArray("scopes", JavaOnlyArray.of("openid", "profile"))
            putMap("openId", openId)
            putString("acrValues", "loa-2")
            putString("signOutRedirectUri", "com.example.app://signed-out")
            putString("state", "state-123")
            putString("nonce", "nonce-123")
            putString("uiLocales", "en fr")
            putDouble("refreshThreshold", 30.0)
            putString("loginHint", "demo-user")
            putString("display", "page")
            putString("prompt", "login")
            putMap("additionalParameters", additionalParameters)
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertEquals("rn-client", payload.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.redirectUri)
        assertNull(payload.discoveryEndpoint)
        assertEquals(listOf("openid", "profile"), payload.scopes)
        assertEquals("https://example.com/am/oauth2/authorize", payload.openId?.authorizationEndpoint)
        assertEquals("https://example.com/am/oauth2/token", payload.openId?.tokenEndpoint)
        assertEquals("https://example.com/am/oauth2/userinfo", payload.openId?.userinfoEndpoint)
        assertEquals("https://example.com/am/oauth2/connect/endSession", payload.openId?.endSessionEndpoint)
        assertEquals("https://example.com/am/XUI/#logout", payload.openId?.pingEndIdpSessionEndpoint)
        assertEquals("https://example.com/am/oauth2/revoke", payload.openId?.revocationEndpoint)
        assertEquals("loa-2", payload.acrValues)
        assertEquals("com.example.app://signed-out", payload.signOutRedirectUri)
        assertEquals("state-123", payload.state)
        assertEquals("nonce-123", payload.nonce)
        assertEquals("en fr", payload.uiLocales)
        assertEquals(30L, payload.refreshThreshold)
        assertEquals("demo-user", payload.loginHint)
        assertEquals("page", payload.display)
        assertEquals("login", payload.prompt)
        assertEquals(mapOf("audience" to "urn:example:api", "foo" to "bar"), payload.additionalParameters)
    }

    @Test
    fun parseConfigWithOidcClientHandleIgnoresPartialDirectOidcFields() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("oidcClientId", "oidc-client-1")
            putString("clientId", "direct-client")
        }

        val payload = JourneyConfigParser.parse(config)

        assertEquals("https://example.com/am", payload.serverUrl)
        assertEquals("oidc-client-1", payload.oidcClientId)
        assertEquals("direct-client", payload.clientId)
        assertNull(payload.discoveryEndpoint)
        assertNull(payload.redirectUri)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenOidcConfigIsPartial() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("clientId", "rn-client")
        }

        JourneyConfigParser.parse(config)
    }

    @Test(expected = IllegalArgumentException::class)
    fun parseThrowsWhenOidcStorageIdIsProvidedWithoutOidcConfig() {
        val config = JavaOnlyMap().apply {
            putString("serverUrl", "https://example.com/am")
            putString("oidcStorageId", "oidc-storage-1")
        }

        JourneyConfigParser.parse(config)
    }
}
