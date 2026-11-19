/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.GetPublicKeyCredentialOption
import com.facebook.react.bridge.JavaOnlyMap
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialRequestOptions
import com.pingidentity.fido.FidoAuthenticateCustomizer
import com.pingidentity.logger.Logger
import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for the authenticate customizer route selection and the Play Services isolation.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoAuthenticateCustomizerFactoryTest {

  private val logger = mockk<Logger>(relaxed = true)
  private val warnings = mutableListOf<String>().also { captured ->
    every { logger.w(capture(captured), any()) } returns Unit
  }

  private val credentialManagerSpec = FidoCredentialManagerSignInSpec(clientDataHash = "AQID")
  private val playServicesSpec = FidoPlayServicesRequestSpec(requestId = 42)
  private val nativeOption = GetPublicKeyCredentialOption("""{"challenge":"abc"}""")
  private val nativeRequest = PublicKeyCredentialRequestOptions.Builder()
    .setChallenge(byteArrayOf(1))
    .setRpId("example.com")
    .build()

  private fun callConfig(
    useFido2ApiClient: Boolean? = null,
    credentialManager: FidoCredentialManagerSignInSpec? = null,
    playServices: FidoPlayServicesRequestSpec? = null,
    preferImmediatelyAvailableCredentials: Boolean? = null
  ) = FidoCallConfig(
    loggerId = null,
    logger = logger,
    useFido2ApiClient = useFido2ApiClient,
    preferImmediatelyAvailableCredentials = preferImmediatelyAvailableCredentials,
    createRequestSpec = null,
    credentialManagerSignIn = credentialManager,
    playServicesRequest = playServices
  )

  private fun build(
    callConfig: FidoCallConfig,
    playServicesAvailable: Boolean = true
  ): FidoAuthenticateCustomizer {
    val block = FidoAuthenticateCustomizerFactory { playServicesAvailable }.create(callConfig)
    return FidoAuthenticateCustomizer().apply(block)
  }

  private fun hookOf(customizer: FidoAuthenticateCustomizer, name: String): Any? {
    val field = FidoAuthenticateCustomizer::class.java.getDeclaredField(name)
    field.isAccessible = true
    return field.get(customizer)
  }

  @Suppress("UNCHECKED_CAST")
  private fun credentialManagerApplied(customizer: FidoAuthenticateCustomizer): Boolean {
    val transform = hookOf(customizer, "getOptionCustomizer") as (GetPublicKeyCredentialOption) -> GetPublicKeyCredentialOption
    return transform(nativeOption) !== nativeOption
  }

  @Suppress("UNCHECKED_CAST")
  private fun playServicesApplied(customizer: FidoAuthenticateCustomizer): Boolean {
    val transform = hookOf(customizer, "requestOptionsCustomizer") as (PublicKeyCredentialRequestOptions) -> PublicKeyCredentialRequestOptions
    return transform(nativeRequest).requestId != nativeRequest.requestId
  }

  private fun notApplied(path: String, reason: String) =
    "FIDO config key '$path' received an Object; $reason"

  private val credentialManagerNotApplied = notApplied(
    "android.credentialManager",
    "the selected route is Play Services; the block is not applied"
  )
  private val playServicesNotApplied = notApplied(
    "android.playServices",
    "the selected route is Credential Manager; the block is not applied"
  )

  // MARK: - Selected route

  /**
   * Ensures no blocks and no flag keep native auto-detection and install no hooks.
   */
  @Test
  fun noBlocksKeepNativeDefaults() {
    val untouched = FidoAuthenticateCustomizer()

    val customizer = build(callConfig())

    assertEquals(untouched.useFido2ApiClient, customizer.useFido2ApiClient)
    assertFalse(credentialManagerApplied(customizer))
    assertFalse(playServicesApplied(customizer))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the explicit flag alone is applied both ways.
   */
  @Test
  fun explicitFlagAloneIsApplied() {
    assertFalse(build(callConfig(useFido2ApiClient = false)).useFido2ApiClient)
    assertTrue(build(callConfig(useFido2ApiClient = true)).useFido2ApiClient)
  }

  /**
   * Ensures an explicit false selects Credential Manager even when Play Services is available.
   */
  @Test
  fun explicitFalseSelectsCredentialManagerWithPlayServicesAvailable() {
    val customizer = build(
      callConfig(useFido2ApiClient = false, credentialManager = credentialManagerSpec),
      playServicesAvailable = true
    )

    assertFalse(customizer.useFido2ApiClient)
    assertTrue(credentialManagerApplied(customizer))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures an explicit true selects Play Services.
   */
  @Test
  fun explicitTrueSelectsPlayServices() {
    val customizer = build(callConfig(useFido2ApiClient = true, playServices = playServicesSpec))

    assertTrue(customizer.useFido2ApiClient)
    assertTrue(playServicesApplied(customizer))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures auto-detection with Play Services available selects Play Services: the
   * Credential Manager block is not applied and is reported, the Play Services block applies.
   */
  @Test
  fun autoDetectionWithPlayServicesSelectsPlayServices() {
    val credentialManagerOnly = build(
      callConfig(credentialManager = credentialManagerSpec),
      playServicesAvailable = true
    )
    val playServicesOnly = build(callConfig(playServices = playServicesSpec), playServicesAvailable = true)

    assertFalse(credentialManagerApplied(credentialManagerOnly))
    assertTrue(playServicesApplied(playServicesOnly))
    assertEquals(listOf(credentialManagerNotApplied), warnings)
  }

  /**
   * Ensures auto-detection without Play Services selects Credential Manager: the
   * Credential Manager block applies, the Play Services block is not applied and is reported.
   */
  @Test
  fun autoDetectionWithoutPlayServicesSelectsCredentialManager() {
    val credentialManagerOnly = build(
      callConfig(credentialManager = credentialManagerSpec),
      playServicesAvailable = false
    )
    assertTrue(credentialManagerApplied(credentialManagerOnly))
    assertTrue(warnings.isEmpty())

    val playServicesOnly = build(callConfig(playServices = playServicesSpec), playServicesAvailable = false)

    assertFalse(playServicesApplied(playServicesOnly))
    assertEquals(listOf(playServicesNotApplied), warnings)
  }

  /**
   * Ensures a block never changes the selected route: the flag stays at the native default
   * when none was supplied.
   */
  @Test
  fun blocksDoNotChangeTheRoute() {
    val untouched = FidoAuthenticateCustomizer()

    assertEquals(
      untouched.useFido2ApiClient,
      build(callConfig(credentialManager = credentialManagerSpec), playServicesAvailable = false).useFido2ApiClient
    )
    assertEquals(
      untouched.useFido2ApiClient,
      build(callConfig(playServices = playServicesSpec), playServicesAvailable = true).useFido2ApiClient
    )
  }

  // MARK: - Block against the selected route

  /**
   * Ensures a Credential Manager block with an explicit true is not applied and the flag stays true.
   */
  @Test
  fun credentialManagerBlockWithExplicitTrueIsNotApplied() {
    val customizer = build(callConfig(useFido2ApiClient = true, credentialManager = credentialManagerSpec))

    assertTrue(customizer.useFido2ApiClient)
    assertFalse(credentialManagerApplied(customizer))
    assertEquals(listOf(credentialManagerNotApplied), warnings)
  }

  /**
   * Ensures a Play Services block with an explicit false is not applied and the flag stays false.
   */
  @Test
  fun playServicesBlockWithExplicitFalseIsNotApplied() {
    val customizer = build(callConfig(useFido2ApiClient = false, playServices = playServicesSpec))

    assertFalse(customizer.useFido2ApiClient)
    assertFalse(playServicesApplied(customizer))
    assertEquals(listOf(playServicesNotApplied), warnings)
  }

  /**
   * Ensures supplying both blocks applies only the one for the explicit route.
   */
  @Test
  fun bothBlocksApplyOnlyTheSelectedRoute() {
    val credentialManagerRoute = build(
      callConfig(useFido2ApiClient = false, credentialManager = credentialManagerSpec, playServices = playServicesSpec)
    )
    assertTrue(credentialManagerApplied(credentialManagerRoute))
    assertFalse(playServicesApplied(credentialManagerRoute))
    assertEquals(listOf(playServicesNotApplied), warnings)

    warnings.clear()
    val playServicesRoute = build(
      callConfig(useFido2ApiClient = true, credentialManager = credentialManagerSpec, playServices = playServicesSpec)
    )
    assertTrue(playServicesApplied(playServicesRoute))
    assertFalse(credentialManagerApplied(playServicesRoute))
    assertEquals(listOf(credentialManagerNotApplied), warnings)
  }

  /**
   * Ensures supplying both blocks without a flag applies the one matching auto-detection.
   */
  @Test
  fun bothBlocksWithoutFlagFollowAutoDetection() {
    val withPlayServices = build(
      callConfig(credentialManager = credentialManagerSpec, playServices = playServicesSpec),
      playServicesAvailable = true
    )
    assertTrue(playServicesApplied(withPlayServices))
    assertFalse(credentialManagerApplied(withPlayServices))
    assertEquals(listOf(credentialManagerNotApplied), warnings)

    warnings.clear()
    val withoutPlayServices = build(
      callConfig(credentialManager = credentialManagerSpec, playServices = playServicesSpec),
      playServicesAvailable = false
    )
    assertTrue(credentialManagerApplied(withoutPlayServices))
    assertFalse(playServicesApplied(withoutPlayServices))
    assertEquals(listOf(playServicesNotApplied), warnings)
  }

  // MARK: - Play Services availability

  /**
   * Ensures an explicit true with a Play Services block on a device without the FIDO API does
   * not touch Play Services types, keeps the explicit flag and reports the block.
   */
  @Test
  fun explicitTrueWithoutPlayServicesDoesNotApplyBlock() {
    val customizer = build(
      callConfig(useFido2ApiClient = true, playServices = playServicesSpec),
      playServicesAvailable = false
    )

    assertTrue(customizer.useFido2ApiClient)
    assertFalse(playServicesApplied(customizer))
    assertEquals(
      listOf(
        notApplied(
          "android.playServices",
          "the Play Services FIDO API is not available on this device; the block is not applied"
        )
      ),
      warnings
    )
  }

  /**
   * Ensures the Credential Manager route does not depend on Play Services availability.
   */
  @Test
  fun credentialManagerRouteDoesNotNeedPlayServices() {
    val customizer = build(
      callConfig(useFido2ApiClient = false, credentialManager = credentialManagerSpec),
      playServicesAvailable = false
    )

    assertFalse(customizer.useFido2ApiClient)
    assertTrue(credentialManagerApplied(customizer))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the default probe agrees with the classpath the tests run on, which carries the
   * Play Services FIDO API.
   */
  @Test
  fun defaultProbeDetectsPlayServicesOnClasspath() {
    val customizer = FidoAuthenticateCustomizer().apply(
      FidoAuthenticateCustomizerFactory().create(callConfig(playServices = playServicesSpec))
    )

    assertTrue(playServicesApplied(customizer))
    assertTrue(warnings.isEmpty())
  }

  // MARK: - Unsupported authentication preference

  /**
   * Ensures the authentication preference neither routes nor installs a hook, and is reported
   * once, before the customizer exists, with key, type and no value.
   */
  @Test
  fun authenticationPreferenceIsReportedOnceAndNotApplied() {
    val parsed = FidoCallConfig.resolve(
      JavaOnlyMap.of("loggerId", "logger-1", "preferImmediatelyAvailableCredentials", true),
      FidoCallConfig.Ceremony.AUTHENTICATION
    ) { logger }
    val reportedBeforeCustomizer = warnings.toList()

    val customizer = FidoAuthenticateCustomizer().apply(FidoAuthenticateCustomizerFactory().create(parsed))

    assertEquals(
      listOf(
        "FIDO config key 'preferImmediatelyAvailableCredentials' received a Boolean; " +
          "Android does not support this option for authentication and the native sign-in flow applies"
      ),
      reportedBeforeCustomizer
    )
    assertEquals(reportedBeforeCustomizer, warnings)
    assertFalse(credentialManagerApplied(customizer))
    assertFalse(playServicesApplied(customizer))
    assertEquals(FidoAuthenticateCustomizer().useFido2ApiClient, customizer.useFido2ApiClient)
  }

  // MARK: - No-GMS safety

  private val playServicesMarker = "com/google/android/gms".toByteArray(Charsets.UTF_8)

  private fun classBytes(type: Class<*>): ByteArray {
    val resource = "${type.name.substringAfterLast('.')}.class"
    val stream = requireNotNull(type.getResourceAsStream(resource)) { "No class file for ${type.name}" }
    return stream.use { it.readBytes() }
  }

  private fun referencesPlayServices(type: Class<*>): Boolean {
    val bytes = classBytes(type)
    val marker = playServicesMarker
    return (0..bytes.size - marker.size).any { start ->
      marker.indices.all { bytes[start + it] == marker[it] }
    }
  }

  /**
   * Ensures no class a Credential Manager only host loads has a Play Services reference in its
   * constant pool, which covers member signatures and method bodies alike. The Play Services
   * customizer is the positive control proving the scan can detect a reference.
   */
  @Test
  fun onlyPlayServicesCustomizerReferencesPlayServicesTypes() {
    val isolated = listOf(
      FidoCallConfig::class.java,
      FidoCallConfig.Companion::class.java,
      FidoAuthenticateOptionParser::class.java,
      FidoCredentialManagerSignInSpec::class.java,
      FidoCredentialManagerSignInCustomizer::class.java,
      FidoPlayServicesRequestSpec::class.java,
      FidoAuthenticateCustomizerFactory::class.java,
      RNPingFidoCommon::class.java
    )

    isolated.forEach { assertFalse(it.name, referencesPlayServices(it)) }
    assertTrue(referencesPlayServices(FidoPlayServicesRequestCustomizer::class.java))
  }
}
