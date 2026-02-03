/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class OidcConfigParserTest {

  @Test
  fun parseClientConfig_mapsRequiredAndOptionalFields() {
    val scopes = JavaOnlyArray().apply {
      pushString("openid")
      pushString("profile")
    }
    val additional = JavaOnlyMap().apply {
      putString("foo", "bar")
      putString("baz", "qux")
    }
    val openId = JavaOnlyMap().apply {
      putString("authorizationEndpoint", "https://example.com/oauth2/authorize")
      putString("tokenEndpoint", "https://example.com/oauth2/token")
      putString("userinfoEndpoint", "https://example.com/oauth2/userinfo")
      putString("endSessionEndpoint", "https://example.com/oauth2/logout")
    }

    val config = JavaOnlyMap().apply {
      putString("clientId", "client-id")
      putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
      putString("redirectUri", "com.example.app://callback")
      putArray("scopes", scopes)
      putString("storageId", "storage-1")
      putString("loggerId", "logger-1")
      putString("acrValues", "urn:acr:form")
      putString("signOutRedirectUri", "com.example.app://logout")
      putString("state", "state")
      putString("nonce", "nonce")
      putString("uiLocales", "en-US")
      putDouble("refreshThreshold", 60.0)
      putString("loginHint", "user@example.com")
      putString("display", "page")
      putString("prompt", "login")
      putMap("additionalParameters", additional)
      putMap("openId", openId)
    }

    val payload = OidcConfigParser.parseClientConfig(config)

    assertEquals("client-id", payload.clientId)
    assertEquals("https://example.com/.well-known/openid-configuration", payload.discoveryEndpoint)
    assertEquals("com.example.app://callback", payload.redirectUri)
    assertEquals(listOf("openid", "profile"), payload.scopes)
    assertEquals("storage-1", payload.storageId)
    assertEquals("logger-1", payload.loggerId)
    assertEquals("urn:acr:form", payload.acrValues)
    assertEquals("com.example.app://logout", payload.signOutRedirectUri)
    assertEquals("state", payload.state)
    assertEquals("nonce", payload.nonce)
    assertEquals("en-US", payload.uiLocales)
    assertEquals(60L, payload.refreshThreshold)
    assertEquals("user@example.com", payload.loginHint)
    assertEquals("page", payload.display)
    assertEquals("login", payload.prompt)
    assertEquals(mapOf("foo" to "bar", "baz" to "qux"), payload.additionalParameters)
    assertNotNull(payload.openId)
    assertEquals("https://example.com/oauth2/authorize", payload.openId?.authorizationEndpoint)
    assertEquals("https://example.com/oauth2/token", payload.openId?.tokenEndpoint)
    assertEquals("https://example.com/oauth2/userinfo", payload.openId?.userinfoEndpoint)
    assertEquals("https://example.com/oauth2/logout", payload.openId?.endSessionEndpoint)
  }

  @Test
  fun parseClientConfig_allowsMissingOptionalFields() {
    val scopes = JavaOnlyArray().apply {
      pushString("openid")
    }
    val config = JavaOnlyMap().apply {
      putString("clientId", "client-id")
      putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
      putString("redirectUri", "com.example.app://callback")
      putArray("scopes", scopes)
    }

    val payload = OidcConfigParser.parseClientConfig(config)

    assertEquals("https://example.com/.well-known/openid-configuration", payload.discoveryEndpoint)
    assertNull(payload.storageId)
    assertNull(payload.loggerId)
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
    assertNull(payload.openId)
  }

  @Test
  fun parseClientConfig_missingRequiredFieldThrows() {
    val scopes = JavaOnlyArray().apply {
      pushString("openid")
    }
    val config = JavaOnlyMap().apply {
      putString("clientId", "client-id")
      putString("redirectUri", "com.example.app://callback")
      putArray("scopes", scopes)
    }

    assertThrows(IllegalArgumentException::class.java) {
      OidcConfigParser.parseClientConfig(config)
    }
  }

  @Test
  fun parseClientConfig_allowsOpenIdWithoutDiscoveryEndpoint() {
    val scopes = JavaOnlyArray().apply {
      pushString("openid")
    }
    val openId = JavaOnlyMap().apply {
      putString("authorizationEndpoint", "https://example.com/oauth2/authorize")
      putString("tokenEndpoint", "https://example.com/oauth2/token")
      putString("userinfoEndpoint", "https://example.com/oauth2/userinfo")
    }
    val config = JavaOnlyMap().apply {
      putString("clientId", "client-id")
      putString("redirectUri", "com.example.app://callback")
      putArray("scopes", scopes)
      putMap("openId", openId)
    }

    val payload = OidcConfigParser.parseClientConfig(config)

    assertNull(payload.discoveryEndpoint)
    assertNotNull(payload.openId)
    assertEquals("https://example.com/oauth2/authorize", payload.openId?.authorizationEndpoint)
  }

  @Test
  fun parseClientConfig_openIdMissingRequiredEndpointThrows() {
    val scopes = JavaOnlyArray().apply {
      pushString("openid")
    }
    val openId = JavaOnlyMap().apply {
      putString("authorizationEndpoint", "https://example.com/oauth2/authorize")
      putString("userinfoEndpoint", "https://example.com/oauth2/userinfo")
    }
    val config = JavaOnlyMap().apply {
      putString("clientId", "client-id")
      putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
      putString("redirectUri", "com.example.app://callback")
      putArray("scopes", scopes)
      putMap("openId", openId)
    }

    assertThrows(IllegalArgumentException::class.java) {
      OidcConfigParser.parseClientConfig(config)
    }
  }

  @Test
  fun buildAuthorizeParams_allowsEmptyOptions() {
    val options = JavaOnlyMap()

    val params = OidcConfigParser.buildAuthorizeParams(options)

    assertEquals(emptyMap<String, String>(), params)
  }

  @Test
  fun buildAuthorizeParams_additionalParametersOverrideBuiltIns() {
    val options = JavaOnlyMap().apply {
      putString("prompt", "login")
      putMap("additionalParameters", JavaOnlyMap().apply {
        putString("prompt", "consent")
        putString("foo", "bar")
      })
    }

    val params = OidcConfigParser.buildAuthorizeParams(options)

    assertEquals("consent", params["prompt"])
    assertEquals("bar", params["foo"])
  }

  @Test
  fun buildAuthorizeParams_mapsOverridesAndAdditionalParameters() {
    val options = JavaOnlyMap().apply {
      putString("acrValues", "urn:acr:form")
      putString("state", "state")
      putString("nonce", "nonce")
      putString("uiLocales", "en-US")
      putString("loginHint", "user@example.com")
      putString("display", "page")
      putString("prompt", "login")
      putMap("additionalParameters", JavaOnlyMap().apply {
        putString("foo", "bar")
      })
    }

    val params = OidcConfigParser.buildAuthorizeParams(options)

    assertEquals("urn:acr:form", params["acr_values"])
    assertEquals("state", params["state"])
    assertEquals("nonce", params["nonce"])
    assertEquals("en-US", params["ui_locales"])
    assertEquals("user@example.com", params["login_hint"])
    assertEquals("page", params["display"])
    assertEquals("login", params["prompt"])
    assertEquals("bar", params["foo"])
  }
}
