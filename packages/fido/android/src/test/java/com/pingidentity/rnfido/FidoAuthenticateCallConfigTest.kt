/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.pingidentity.logger.Logger
import io.mockk.every
import io.mockk.mockk
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for parsing the Android authentication option blocks.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoAuthenticateCallConfigTest {

  private val logger = mockk<Logger>(relaxed = true)
  private val warnings = mutableListOf<String>().also { captured ->
    every { logger.w(capture(captured), any()) } returns Unit
  }

  private fun map(vararg pairs: Pair<String, Any?>): JavaOnlyMap {
    return JavaOnlyMap.of(*pairs.flatMap { listOf(it.first, it.second) }.toTypedArray())
  }

  private fun resolve(
    config: JavaOnlyMap,
    ceremony: FidoCallConfig.Ceremony = FidoCallConfig.Ceremony.AUTHENTICATION
  ): FidoCallConfig {
    return FidoCallConfig.resolve(map("loggerId" to "logger-1").also { it.merge(config) }, ceremony) { logger }
  }

  private fun android(key: String, block: JavaOnlyMap) = map("android" to map(key to block))

  /**
   * Ensures an absent android block yields no authentication specs.
   */
  @Test
  fun absentBlocksYieldNoSpecs() {
    val result = resolve(JavaOnlyMap())

    assertNull(result.credentialManagerSignIn)
    assertNull(result.playServicesRequest)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the Credential Manager block is parsed on authentication.
   */
  @Test
  fun parsesCredentialManagerBlock() {
    val result = resolve(
      android(
        "credentialManager",
        map(
          "requestJson" to map("userVerification" to "required"),
          "clientDataHash" to "AQID",
          "allowedProviders" to JavaOnlyArray.of("a.b/a.b.C")
        )
      )
    )

    val spec = requireNotNull(result.credentialManagerSignIn)
    assertEquals(mapOf("userVerification" to JsonPrimitive("required")), spec.requestJsonPatch)
    assertEquals("AQID", spec.clientDataHash)
    assertEquals(listOf("a.b/a.b.C"), spec.allowedProviders)
    assertNull(result.playServicesRequest)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures an empty block is still present so that it selects routing.
   */
  @Test
  fun emptyBlocksStayPresent() {
    val cm = resolve(android("credentialManager", JavaOnlyMap()))
    val ps = resolve(android("playServices", JavaOnlyMap()))

    assertEquals(FidoCredentialManagerSignInSpec(), cm.credentialManagerSignIn)
    assertEquals(FidoPlayServicesRequestSpec(), ps.playServicesRequest)
  }

  /**
   * Ensures the Play Services block is parsed, including the transport list.
   */
  @Test
  fun parsesPlayServicesBlock() {
    val result = resolve(
      android(
        "playServices",
        map(
          "timeoutSeconds" to 30.0,
          "requestId" to 7,
          "authenticationExtensions" to map("fidoAppId" to "https://app.example", "userVerificationMethod" to true),
          "transports" to JavaOnlyArray.of("usb", "nfc")
        )
      )
    )

    val spec = requireNotNull(result.playServicesRequest)
    assertEquals(30.0, spec.timeoutSeconds)
    assertEquals(7, spec.requestId)
    assertEquals("https://app.example", spec.fidoAppId)
    assertEquals(true, spec.userVerificationMethod)
    assertEquals(listOf("usb", "nfc"), spec.transports)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures authentication blocks are not parsed for registration.
   */
  @Test
  fun registrationDoesNotParseAuthenticationSpecs() {
    val result = resolve(android("credentialManager", map("clientDataHash" to "AQID")), FidoCallConfig.Ceremony.REGISTRATION)

    assertNull(result.credentialManagerSignIn)
    assertNotNull(result.createRequestSpec)
  }

  /**
   * Ensures invalid values warn with key path, type and length only, then fall back.
   */
  @Test
  fun invalidValuesWarnWithoutValues() {
    val result = resolve(
      android(
        "playServices",
        map(
          "timeoutSeconds" to -1.0,
          "requestId" to 1.5,
          "authenticationExtensions" to map("fidoAppId" to 7),
          "transports" to JavaOnlyArray.of("usb", 3)
        )
      )
    )

    val spec = requireNotNull(result.playServicesRequest)
    assertNull(spec.timeoutSeconds)
    assertNull(spec.requestId)
    assertNull(spec.fidoAppId)
    assertEquals(listOf("usb"), spec.transports)
    assertEquals(
      listOf(
        "FIDO config key 'android.playServices.timeoutSeconds' received a Number; a positive number of seconds is expected and the option is ignored",
        "FIDO config key 'android.playServices.requestId' received a Number; a 32-bit integer is expected and the option is ignored",
        "FIDO config key 'android.playServices.authenticationExtensions.fidoAppId' received a Number; a String is expected and the option is ignored",
        "FIDO config key 'android.playServices.transports[1]' received a Number; a String is expected and the entry is ignored"
      ),
      warnings
    )
  }

  /**
   * Ensures wrong-typed and unknown keys inside the blocks are reported.
   */
  @Test
  fun wrongTypesAndUnknownKeysAreReported() {
    resolve(
      android(
        "credentialManager",
        map(
          "clientDataHash" to 5,
          "allowedProviders" to JavaOnlyArray.of(1),
          "preferImmediatelyAvailableCredentials" to true
        )
      )
    )

    assertEquals(
      listOf(
        "FIDO config key 'android.credentialManager.clientDataHash' received a Number; a String is expected and the option is ignored",
        "FIDO config key 'android.credentialManager.allowedProviders[0]' received a Number; a String is expected and the entry is ignored",
        "FIDO config key 'android.credentialManager.preferImmediatelyAvailableCredentials' received a Boolean; this key is not recognized and is ignored"
      ),
      warnings
    )
  }
}
