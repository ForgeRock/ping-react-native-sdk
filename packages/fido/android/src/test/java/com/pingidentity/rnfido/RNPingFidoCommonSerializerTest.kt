/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.pingidentity.davinci.collector.TextCollector
import com.pingidentity.davinci.plugin.DaVinci
import com.pingidentity.fido.Constants
import com.pingidentity.fido.davinci.FidoAuthenticationCollector
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.orchestrate.WorkflowConfig
import com.pingidentity.rncore.CoreRuntime
import io.mockk.every
import io.mockk.mockk
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for the DaVinci FIDO2 collector serializer registered by
 * `RNPingFidoCommon.registerDaVinciSerializer`.
 *
 * Collectors are initialised through their real `init` path with a mocked `DaVinci`
 * injected, because every `AbstractFidoCollector` property is `private set` and `init`
 * reads `logger`, which is lazily derived from `davinci.config.logger`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingFidoCommonSerializerTest {

  private lateinit var registrationCollector: FidoRegistrationCollector
  private lateinit var authenticationCollector: FidoAuthenticationCollector

  /**
   * Initializes both FIDO collectors through `init` with a mocked DaVinci instance
   * supplying the default workflow logger.
   */
  @Before
  fun setUp() {
    val daVinci = mockk<DaVinci>()
    every { daVinci.config } returns WorkflowConfig()

    registrationCollector = FidoRegistrationCollector().apply {
      davinci = daVinci
      init(registrationInput())
    }

    authenticationCollector = FidoAuthenticationCollector().apply {
      davinci = daVinci
      init(authenticationInput())
    }
  }

  /**
   * Ensures the registered serializer emits the action-discriminated registration payload.
   */
  @Test
  fun daVinciSerializerReturnsActionAndCreationOptionsForRegistration() {
    RNPingFidoCommon.registerDaVinciSerializer()

    val payload = CoreRuntime.serializeDaVinciCollector(registrationCollector)

    assertNotNull(payload)
    val map = payload!!
    assertEquals("fido-register-key", map["key"])
    assertEquals("FIDO2", map["type"])
    assertEquals("REGISTER", map["action"])
    assertEquals("Set up passkeys", map["label"])
    assertEquals(true, map["required"])
    assertEquals("submit", map["trigger"])

    val options = map[Constants.FIELD_PUBLIC_KEY_CREDENTIAL_CREATION_OPTIONS]
    assertTrue(options is Map<*, *>)
    val optionsMap = options as Map<*, *>
    assertEquals("example.com", (optionsMap["rp"] as Map<*, *>)["id"])
    // transform() emits base64url without padding: bytes [72, 101] encode to "SGU".
    assertEquals("SGU", optionsMap["challenge"])
  }

  /**
   * Ensures the registered serializer emits the action-discriminated authentication payload.
   */
  @Test
  fun daVinciSerializerReturnsActionAndRequestOptionsForAuthentication() {
    RNPingFidoCommon.registerDaVinciSerializer()

    val payload = CoreRuntime.serializeDaVinciCollector(authenticationCollector)

    assertNotNull(payload)
    val map = payload!!
    assertEquals("fido-auth-key", map["key"])
    assertEquals("FIDO2", map["type"])
    assertEquals("AUTHENTICATE", map["action"])
    assertEquals("Sign in with passkey", map["label"])
    assertEquals(false, map["required"])
    // No trigger in the server payload; Android still emits the default empty string.
    assertEquals("", map["trigger"])

    val options = map[Constants.FIELD_PUBLIC_KEY_CREDENTIAL_REQUEST_OPTIONS]
    assertTrue(options is Map<*, *>)
    val optionsMap = options as Map<*, *>
    assertEquals("example.com", optionsMap["rpId"])
    // transform() emits base64url without padding: bytes [1, 2] encode to "AQI".
    assertEquals("AQI", optionsMap["challenge"])
  }

  /**
   * Ensures the registered serializer returns null for non-FIDO collectors so other
   * serializers and the DaVinci mapper fallback remain in control.
   */
  @Test
  fun daVinciSerializerReturnsNullForNonFidoCollector() {
    RNPingFidoCommon.registerDaVinciSerializer()

    val payload = CoreRuntime.serializeDaVinciCollector(TextCollector())

    assertNull(payload)
  }

  /**
   * Builds a registration collector payload with server-style int-array binary fields.
   */
  private fun registrationInput() = buildJsonObject {
    put("type", JsonPrimitive("FIDO2"))
    put("key", JsonPrimitive("fido-register-key"))
    put("label", JsonPrimitive("Set up passkeys"))
    put("trigger", JsonPrimitive("submit"))
    put("required", true)
    put(
      Constants.FIELD_PUBLIC_KEY_CREDENTIAL_CREATION_OPTIONS,
      buildJsonObject {
        put("rp", buildJsonObject { put("id", JsonPrimitive("example.com")) })
        put("challenge", JsonArray(listOf(JsonPrimitive(72), JsonPrimitive(101))))
      }
    )
  }

  /**
   * Builds an authentication collector payload with server-style int-array binary fields.
   */
  private fun authenticationInput() = buildJsonObject {
    put("type", JsonPrimitive("FIDO2"))
    put("key", JsonPrimitive("fido-auth-key"))
    put("label", JsonPrimitive("Sign in with passkey"))
    put("required", false)
    put(
      Constants.FIELD_PUBLIC_KEY_CREDENTIAL_REQUEST_OPTIONS,
      buildJsonObject {
        put("rpId", JsonPrimitive("example.com"))
        put("challenge", JsonArray(listOf(JsonPrimitive(1), JsonPrimitive(2))))
      }
    )
  }
}
