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
        assertNull(payload.oidc)
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
        assertEquals("rn-client", payload.oidc?.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.oidc?.redirectUri)
        assertEquals(listOf("openid", "profile"), payload.oidc?.scopes)
        assertNull(payload.oidc?.openId)
        assertNull(payload.oidc?.acrValues)
        assertNull(payload.oidc?.signOutRedirectUri)
        assertNull(payload.oidc?.state)
        assertNull(payload.oidc?.nonce)
        assertNull(payload.oidc?.uiLocales)
        assertNull(payload.oidc?.refreshThreshold)
        assertNull(payload.oidc?.loginHint)
        assertNull(payload.oidc?.display)
        assertNull(payload.oidc?.prompt)
        assertEquals(emptyMap<String, String>(), payload.oidc?.additionalParameters)
        assertEquals("storage-1", payload.sessionStorageId)
        assertEquals("oidc-storage-1", payload.oidc?.storageId)
        assertEquals("logger-1", payload.loggerId)
        assertNull(payload.oidc?.clientHandleId)
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
        assertEquals("oidc-client-1", payload.oidc?.clientHandleId)
        assertNull(payload.oidc?.clientId)
        assertNull(payload.oidc?.discoveryEndpoint)
        assertNull(payload.oidc?.redirectUri)
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
        assertEquals("rn-client", payload.oidc?.clientId)
        assertEquals("com.example.app://oauth2redirect", payload.oidc?.redirectUri)
        assertNull(payload.oidc?.discoveryEndpoint)
        assertEquals(listOf("openid", "profile"), payload.oidc?.scopes)
        assertEquals("https://example.com/am/oauth2/authorize", payload.oidc?.openId?.authorizationEndpoint)
        assertEquals("https://example.com/am/oauth2/token", payload.oidc?.openId?.tokenEndpoint)
        assertEquals("https://example.com/am/oauth2/userinfo", payload.oidc?.openId?.userinfoEndpoint)
        assertEquals("https://example.com/am/oauth2/connect/endSession", payload.oidc?.openId?.endSessionEndpoint)
        assertEquals("https://example.com/am/XUI/#logout", payload.oidc?.openId?.pingEndIdpSessionEndpoint)
        assertEquals("https://example.com/am/oauth2/revoke", payload.oidc?.openId?.revocationEndpoint)
        assertEquals("loa-2", payload.oidc?.acrValues)
        assertEquals("com.example.app://signed-out", payload.oidc?.signOutRedirectUri)
        assertEquals("state-123", payload.oidc?.state)
        assertEquals("nonce-123", payload.oidc?.nonce)
        assertEquals("en fr", payload.oidc?.uiLocales)
        assertEquals(30L, payload.oidc?.refreshThreshold)
        assertEquals("demo-user", payload.oidc?.loginHint)
        assertEquals("page", payload.oidc?.display)
        assertEquals("login", payload.oidc?.prompt)
        assertEquals(mapOf("audience" to "urn:example:api", "foo" to "bar"), payload.oidc?.additionalParameters)
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
        assertEquals("oidc-client-1", payload.oidc?.clientHandleId)
        assertEquals("direct-client", payload.oidc?.clientId)
        assertNull(payload.oidc?.discoveryEndpoint)
        assertNull(payload.oidc?.redirectUri)
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
