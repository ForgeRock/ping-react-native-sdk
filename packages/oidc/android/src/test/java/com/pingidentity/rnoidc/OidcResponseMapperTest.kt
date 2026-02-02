/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.oidc.Token
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], shadows = [ShadowOidcResponseArguments::class])
class OidcResponseMapperTest {

  @Test
  fun encodeUserinfo_convertsJsonObject() {
    val userinfo = JsonObject(
      mapOf(
        "name" to JsonPrimitive("Jane Doe"),
        "email" to JsonPrimitive("jane@example.com"),
        "email_verified" to JsonPrimitive(true),
        "age" to JsonPrimitive(42),
        "roles" to JsonArray(listOf(JsonPrimitive("admin"), JsonPrimitive("user")))
      )
    )

    val mapped: ReadableMap = OidcResponseMapper.encodeUserinfo(userinfo)

    assertEquals("Jane Doe", mapped.getString("name"))
    assertEquals("jane@example.com", mapped.getString("email"))
    assertTrue(mapped.getBoolean("email_verified"))
    assertEquals(42.0, mapped.getDouble("age"), 0.01)
    val roles = mapped.getArray("roles")
    assertNotNull(roles)
    assertEquals("admin", roles?.getString(0))
    assertEquals("user", roles?.getString(1))
  }

  @Test
  fun encodeTokens_mapsValuesAndExpiry() {
    val token = Token(
      accessToken = "access-token",
      refreshToken = "refresh-token",
      idToken = "id-token",
      expiresIn = 120
    )
    val before = System.currentTimeMillis() / 1000

    val mapped = OidcResponseMapper.encodeTokens(token)

    val after = System.currentTimeMillis() / 1000
    assertEquals("access-token", mapped.getString("accessToken"))
    assertEquals("refresh-token", mapped.getString("refreshToken"))
    assertEquals("id-token", mapped.getString("idToken"))
    val expiry = mapped.getDouble("tokenExpiry").toLong()
    assertTrue(expiry in (before + 120)..(after + 120))
  }

  @Test
  fun encodeTokens_allowsMissingOptionalTokens() {
    val token = Token(accessToken = "access-token", expiresIn = 0)

    val mapped = OidcResponseMapper.encodeTokens(token)

    assertEquals("access-token", mapped.getString("accessToken"))
    assertTrue(!mapped.hasKey("refreshToken"))
    assertTrue(!mapped.hasKey("idToken"))
  }

}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowOidcResponseArguments {
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = JavaOnlyArray()
}
