/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.JavaOnlyMap
import com.pingidentity.logger.Logger
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog

/**
 * Unit tests for per-call FIDO option parsing and the warning contract.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoCallConfigTest {

  private val logger = mockk<Logger>(relaxed = true)

  @Before
  fun setUp() {
    ShadowLog.setupLogging()
    ShadowLog.clear()
  }

  private fun resolve(
    config: JavaOnlyMap,
    ceremony: FidoCallConfig.Ceremony = FidoCallConfig.Ceremony.REGISTRATION,
    resolved: Logger? = logger
  ): FidoCallConfig {
    return FidoCallConfig.resolve(config, ceremony) { id ->
      resolved.takeIf { id == "logger-1" }
    }
  }

  private fun loggerWarnings(): List<String> {
    val captured = mutableListOf<String>()
    every { logger.w(capture(captured), any()) } returns Unit
    return captured
  }

  private fun fallbackWarnings(): List<String> {
    return ShadowLog.getLogsForTag(FidoWarningSink.TAG).map { it.msg }
  }

  private fun config(vararg pairs: Pair<String, Any?>): JavaOnlyMap {
    return JavaOnlyMap.of(*pairs.flatMap { listOf(it.first, it.second) }.toTypedArray())
  }

  // MARK: - Parsing

  /**
   * Ensures an empty payload yields the neutral configuration without warnings.
   */
  @Test
  fun emptyPayloadYieldsDefaultsWithoutWarnings() {
    val result = resolve(JavaOnlyMap(), resolved = null)

    assertNull(result.loggerId)
    assertNull(result.logger)
    assertNull(result.useFido2ApiClient)
    assertNull(result.preferImmediatelyAvailableCredentials)
    assertNull(result.createRequestSpec)
    assertTrue(fallbackWarnings().isEmpty())
  }

  /**
   * Ensures the trimmed logger id is resolved through the registry lookup.
   */
  @Test
  fun loggerIdIsTrimmedAndResolved() {
    val result = resolve(config("loggerId" to "  logger-1  "))

    assertEquals("logger-1", result.loggerId)
    assertSame(logger, result.logger)
  }

  /**
   * Ensures a blank logger id is treated as absent.
   */
  @Test
  fun blankLoggerIdIsTreatedAsAbsent() {
    val result = resolve(config("loggerId" to "   "))

    assertNull(result.loggerId)
    assertNull(result.logger)
  }

  /**
   * Ensures the explicit routing flag and the authentication preference are parsed.
   */
  @Test
  fun parsesRoutingFlagAndAuthenticationPreference() {
    val result = resolve(
      config("useFido2ApiClient" to false, "preferImmediatelyAvailableCredentials" to true),
      FidoCallConfig.Ceremony.AUTHENTICATION
    )

    assertEquals(false, result.useFido2ApiClient)
    assertEquals(true, result.preferImmediatelyAvailableCredentials)
  }

  /**
   * Ensures authentication preference is reported as unsupported through the registry
   * logger while the parsed value is retained.
   */
  @Test
  fun authenticationPreferenceIsReportedAsUnsupportedViaLogger() {
    val captured = loggerWarnings()

    val result = resolve(
      config("loggerId" to "logger-1", "preferImmediatelyAvailableCredentials" to true),
      FidoCallConfig.Ceremony.AUTHENTICATION
    )

    assertEquals(true, result.preferImmediatelyAvailableCredentials)
    assertEquals(
      listOf(
        "FIDO config key 'preferImmediatelyAvailableCredentials' received a Boolean; " +
          "Android does not support this option for authentication and the native sign-in flow applies"
      ),
      captured
    )
    assertTrue(fallbackWarnings().isEmpty())
  }

  /**
   * Ensures the unsupported authentication preference falls back to the platform log when
   * no logger resolves.
   */
  @Test
  fun authenticationPreferenceIsReportedAsUnsupportedViaFallbackSink() {
    val result = resolve(
      config("preferImmediatelyAvailableCredentials" to true),
      FidoCallConfig.Ceremony.AUTHENTICATION,
      resolved = null
    )

    assertEquals(true, result.preferImmediatelyAvailableCredentials)
    assertEquals(
      listOf(
        "FIDO config key 'preferImmediatelyAvailableCredentials' received a Boolean; " +
          "Android does not support this option for authentication and the native sign-in flow applies"
      ),
      fallbackWarnings()
    )
  }

  /**
   * Ensures the registration spec is parsed from the Credential Manager block.
   */
  @Test
  fun parsesCredentialManagerRegistrationSpec() {
    val result = resolve(
      config(
        "android" to config(
          "credentialManager" to config(
            "requestJson" to config("timeout" to 5.0),
            "clientDataHash" to "aGFzaA",
            "preferImmediatelyAvailableCredentials" to true,
            "origin" to "https://example.com",
            "isAutoSelectAllowed" to false,
            "isConditional" to false,
            "preferDefaultProvider" to "com.example/.Provider"
          )
        )
      )
    )

    assertEquals(
      FidoCreateRequestSpec(
        requestJsonPatch = buildJsonObject { put("timeout", JsonPrimitive(5)) },
        clientDataHash = "aGFzaA",
        preferImmediatelyAvailableCredentials = true,
        origin = "https://example.com",
        isAutoSelectAllowed = false,
        isConditional = false,
        preferDefaultProvider = "com.example/.Provider"
      ),
      result.createRequestSpec
    )
  }

  // MARK: - Warning contract

  /**
   * Ensures a wrong-typed option is reported with key, type and length, and ignored.
   */
  @Test
  fun wrongTypeOptionIsReportedAndIgnored() {
    val captured = loggerWarnings()

    val result = resolve(
      config(
        "loggerId" to "logger-1",
        "useFido2ApiClient" to "secret-value"
      )
    )

    assertNull(result.useFido2ApiClient)
    assertEquals(1, captured.size)
    assertEquals(
      "FIDO config key 'useFido2ApiClient' received a String of length 12; " +
        "a Boolean is expected and the option is ignored",
      captured.single()
    )
    assertFalse(captured.single().contains("secret-value"))
  }

  /**
   * Ensures wrong-typed nested registration options are reported with a dotted path.
   */
  @Test
  fun wrongTypeNestedOptionIsReportedWithPath() {
    val captured = loggerWarnings()

    val result = resolve(
      config(
        "loggerId" to "logger-1",
        "android" to config("credentialManager" to config("origin" to true, "clientDataHash" to 7.0))
      )
    )

    assertNull(result.createRequestSpec)
    assertEquals(
      listOf(
        "FIDO config key 'android.credentialManager.clientDataHash' received a Number; " +
          "a String is expected and the option is ignored",
        "FIDO config key 'android.credentialManager.origin' received a Boolean; " +
          "a String is expected and the option is ignored"
      ),
      captured.sorted()
    )
  }

  /**
   * Ensures an unknown key is reported by name and type, never by value.
   */
  @Test
  fun unknownKeyIsReportedWithoutValue() {
    val captured = loggerWarnings()

    resolve(config("loggerId" to "logger-1", "surprise" to "do-not-log"))

    assertEquals(
      listOf(
        "FIDO config key 'surprise' received a String of length 10; this key is not recognized and is ignored"
      ),
      captured
    )
  }

  /**
   * Ensures unknown keys inside the nested android blocks are reported.
   */
  @Test
  fun unknownNestedKeysAreReported() {
    val captured = loggerWarnings()

    resolve(
      config(
        "loggerId" to "logger-1",
        "android" to config(
          "other" to 1.0,
          "credentialManager" to config("extra" to config())
        )
      )
    )

    assertEquals(
      listOf(
        "FIDO config key 'android.credentialManager.extra' received an Object; " +
          "this key is not recognized and is ignored",
        "FIDO config key 'android.other' received a Number; this key is not recognized and is ignored"
      ),
      captured.sorted()
    )
  }

  /**
   * Ensures the ios key is reported as off-platform rather than unknown.
   */
  @Test
  fun iosKeyIsReportedAsOffPlatform() {
    val captured = loggerWarnings()

    resolve(config("loggerId" to "logger-1", "ios" to config("anything" to "x")))

    assertEquals(
      listOf("FIDO config key 'ios' received an Object; iOS-only options are ignored on Android"),
      captured
    )
  }

  /**
   * Ensures a playServices block on registration is reported and ignored.
   */
  @Test
  fun playServicesBlockOnRegistrationIsReported() {
    val captured = loggerWarnings()

    val result = resolve(
      config("loggerId" to "logger-1", "android" to config("playServices" to config()))
    )

    assertNull(result.createRequestSpec)
    assertEquals(
      listOf(
        "FIDO config key 'android.playServices' received an Object; " +
          "registration uses Credential Manager and this block is ignored"
      ),
      captured
    )
  }

  /**
   * Ensures a valid top-level preference on registration is applied through the create
   * request spec without any warning.
   */
  @Test
  fun topLevelPreferenceOnRegistrationFoldsIntoSpecWithoutWarning() {
    val captured = loggerWarnings()

    val result = resolve(
      config("loggerId" to "logger-1", "preferImmediatelyAvailableCredentials" to true)
    )

    assertNull(result.preferImmediatelyAvailableCredentials)
    assertEquals(
      FidoCreateRequestSpec(preferImmediatelyAvailableCredentials = true),
      result.createRequestSpec
    )
    assertTrue(captured.isEmpty())
  }

  /**
   * Ensures the Credential Manager value overrides the top-level preference on registration.
   */
  @Test
  fun credentialManagerPreferenceOverridesTopLevel() {
    val result = resolve(
      config(
        "preferImmediatelyAvailableCredentials" to true,
        "android" to config(
          "credentialManager" to config("preferImmediatelyAvailableCredentials" to false, "origin" to "o")
        )
      )
    )

    assertEquals(false, result.createRequestSpec?.preferImmediatelyAvailableCredentials)
    assertEquals("o", result.createRequestSpec?.origin)
  }

  /**
   * Ensures the top-level preference fills in when the Credential Manager block omits it.
   */
  @Test
  fun topLevelPreferenceFillsCredentialManagerBlockWithoutIt() {
    val result = resolve(
      config(
        "preferImmediatelyAvailableCredentials" to true,
        "android" to config("credentialManager" to config("origin" to "o"))
      )
    )

    assertEquals(true, result.createRequestSpec?.preferImmediatelyAvailableCredentials)
    assertEquals("o", result.createRequestSpec?.origin)
  }

  /**
   * Ensures a wrong-typed top-level preference on registration only gets the wrong-type warning.
   */
  @Test
  fun wrongTypeTopLevelPreferenceOnRegistrationIsReportedOnce() {
    val captured = loggerWarnings()

    val result = resolve(
      config("loggerId" to "logger-1", "preferImmediatelyAvailableCredentials" to "yes")
    )

    assertNull(result.createRequestSpec)
    assertEquals(
      listOf(
        "FIDO config key 'preferImmediatelyAvailableCredentials' received a String of length 3; " +
          "a Boolean is expected and the option is ignored"
      ),
      captured
    )
  }

  /**
   * Ensures a wrong-typed android block is reported and ignored.
   */
  @Test
  fun wrongTypeAndroidBlockIsReported() {
    val captured = loggerWarnings()

    val result = resolve(config("loggerId" to "logger-1", "android" to "yes"))

    assertNull(result.createRequestSpec)
    assertEquals(
      listOf(
        "FIDO config key 'android' received a String of length 3; " +
          "an Object is expected and the option is ignored"
      ),
      captured
    )
  }

  /**
   * Ensures warnings fall back to android.util.Log under the bridge tag when no logger resolves.
   */
  @Test
  fun warningsFallBackToPlatformLogWhenNoLoggerResolves() {
    resolve(config("surprise" to 1.0), resolved = null)

    assertEquals(
      listOf("FIDO config key 'surprise' received a Number; this key is not recognized and is ignored"),
      fallbackWarnings()
    )
  }

  /**
   * Ensures an unresolvable logger id also uses the platform fallback sink.
   */
  @Test
  fun unresolvedLoggerIdUsesPlatformFallback() {
    resolve(config("loggerId" to "unknown", "surprise" to true), resolved = logger)

    verify(exactly = 0) { logger.w(any(), any()) }
    assertEquals(1, fallbackWarnings().size)
  }

  /**
   * Ensures the registry logger receives the warning and the platform sink stays silent.
   */
  @Test
  fun resolvedLoggerReceivesWarningsInsteadOfPlatformLog() {
    resolve(config("loggerId" to "logger-1", "surprise" to true))

    verify(exactly = 1) { logger.w(any(), null) }
    assertTrue(fallbackWarnings().isEmpty())
  }
}
