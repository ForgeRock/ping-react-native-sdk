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
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.orchestrate.WorkflowConfig
import com.pingidentity.rncore.CoreRuntime
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkObject
import io.mockk.verify
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
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
 * Unit tests for the bridge-facing DaVinci serializer registration contract:
 * the module method delegates to [RNPingFidoCommon.registerDaVinciSerializer]
 * idempotently, and Package construction no longer registers anything.
 *
 * Only the new-architecture module is referenced: the Gradle source sets include
 * one architecture variant at a time, so old-arch classes are absent from the
 * test compile classpath under the default (new-arch) build. The classic module
 * mirrors the delegation one-to-one.
 *
 * `CoreRuntime` is mocked so registration is observable without depending on
 * shared process-wide state. Each test resets the one-shot guard via the
 * [RNPingFidoCommon.resetSerializerRegistrationForTesting] seam, keeping the
 * suite hermetic regardless of test order.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingFidoSerializerRegistrationTest {

  private lateinit var registrationCollector: FidoRegistrationCollector

  @Before
  fun setUp() {
    RNPingFidoCommon.resetSerializerRegistrationForTesting()
    val daVinci = mockk<DaVinci>()
    every { daVinci.config } returns WorkflowConfig()

    registrationCollector = FidoRegistrationCollector().apply {
      davinci = daVinci
      init(registrationInput())
    }
  }

  @After
  fun tearDown() {
    unmockkObject(CoreRuntime)
    RNPingFidoCommon.resetSerializerRegistrationForTesting()
  }

  /**
   * Ensures the TurboModule method delegates to the shared registration.
   */
  @Test
  fun moduleRegisterDaVinciSerializerDelegatesToCommon() {
    mockkObject(CoreRuntime)
    every { CoreRuntime.registerDaVinciCollectorSerializer(any()) } just Runs

    RNPingFidoModule(mockk(relaxed = true)).registerDaVinciSerializer()

    verifyExactlyOneRegistration()
  }

  /**
   * Ensures repeated registration calls through the module surface are no-ops
   * after the first: the one-shot guard in `RNPingFidoCommon` prevents
   * serializer accumulation in `CoreRuntime`.
   */
  @Test
  fun repeatedModuleRegistrationsAreIdempotent() {
    mockkObject(CoreRuntime)
    every { CoreRuntime.registerDaVinciCollectorSerializer(any()) } just Runs

    val module = RNPingFidoModule(mockk(relaxed = true))
    module.registerDaVinciSerializer()
    module.registerDaVinciSerializer()
    module.registerDaVinciSerializer()

    verifyExactlyOneRegistration()
  }

  /**
   * Ensures a registration call without any mocking appends exactly one working
   * serializer: a FIDO registration collector serializes with the
   * action-discriminated payload afterwards.
   */
  @Test
  fun registrationActivatesSerializerForFidoCollectors() {
    RNPingFidoCommon.registerDaVinciSerializer()

    val payload = CoreRuntime.serializeDaVinciCollector(registrationCollector)

    assertNotNull(payload)
    assertEquals("fido-register-key", payload!!["key"])
    assertEquals("FIDO2", payload["type"])
    assertEquals("REGISTER", payload["action"])
  }

  /**
   * Ensures the registered serializer still ignores non-FIDO collectors so the
   * mapper fallback remains in control for other types.
   */
  @Test
  fun registeredSerializerReturnsNullForNonFidoCollector() {
    RNPingFidoCommon.registerDaVinciSerializer()

    assertNull(CoreRuntime.serializeDaVinciCollector(TextCollector()))
  }

  /**
   * Ensures the serializer payload carries the WebAuthn creation options under
   * the expected key after registration.
   */
  @Test
  fun registeredSerializerEmitsWebAuthnCreationOptions() {
    RNPingFidoCommon.registerDaVinciSerializer()

    val payload = CoreRuntime.serializeDaVinciCollector(registrationCollector)

    val options = payload?.get(Constants.FIELD_PUBLIC_KEY_CREDENTIAL_CREATION_OPTIONS)
    assertTrue(options is Map<*, *>)
    val optionsMap = options as Map<*, *>
    assertEquals("example.com", (optionsMap["rp"] as Map<*, *>)["id"])
  }

  /**
   * Ensures Package construction alone performs no registration: instantiating
   * both Package classes never reaches `CoreRuntime.registerDaVinciCollectorSerializer`.
   */
  @Test
  fun packageConstructionDoesNotRegisterSerializer() {
    mockkObject(CoreRuntime)
    every { CoreRuntime.registerDaVinciCollectorSerializer(any()) } just Runs

    RNPingFidoPackage()
    RNPingFidoPackage()

    verify(exactly = 0) { CoreRuntime.registerDaVinciCollectorSerializer(any()) }
  }

  /**
   * Ensures a registration after a reset re-registers: the reset seam clears the
   * one-shot guard so the fresh registration reaches `CoreRuntime` again.
   */
  @Test
  fun registrationAfterResetReRegisters() {
    mockkObject(CoreRuntime)
    every { CoreRuntime.registerDaVinciCollectorSerializer(any()) } just Runs

    RNPingFidoCommon.registerDaVinciSerializer()
    RNPingFidoCommon.resetSerializerRegistrationForTesting()
    RNPingFidoCommon.registerDaVinciSerializer()

    verify(exactly = 2) { CoreRuntime.registerDaVinciCollectorSerializer(any()) }
  }

  /**
   * Verifies `CoreRuntime.registerDaVinciCollectorSerializer` fired exactly once.
   */
  private fun verifyExactlyOneRegistration() {
    verify(exactly = 1) { CoreRuntime.registerDaVinciCollectorSerializer(any()) }
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
}
