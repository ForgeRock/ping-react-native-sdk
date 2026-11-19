/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.google.android.gms.fido.common.Transport
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialDescriptor
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialRequestOptions
import com.pingidentity.android.ContextProvider
import com.pingidentity.fido.FidoAuthenticateCustomizer
import com.pingidentity.fido.davinci.FidoAuthenticationCollector
import com.pingidentity.fido.journey.FidoAuthenticationCallback
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.JourneyCallbackResolver
import io.mockk.CapturingSlot
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkAll
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.JsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Verifies that the authenticate customizer built from the call config reaches the native
 * authentication entry points in the standalone, Journey and DaVinci scopes.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoAuthenticationWiringTest {

  private var originalDaVinciCollectorResolver: DaVinciCollectorResolver? = null
  private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null

  private val idA = byteArrayOf(1, 2, 3)
  private val idB = byteArrayOf(4, 5, 6)
  private val nativeRequest = PublicKeyCredentialRequestOptions.Builder()
    .setChallenge(byteArrayOf(7))
    .setRpId("example.com")
    .setAllowList(
      listOf(
        PublicKeyCredentialDescriptor("public-key", idA, listOf(Transport.INTERNAL)),
        PublicKeyCredentialDescriptor("public-key", idB, listOf(Transport.INTERNAL))
      )
    )
    .build()

  @Before
  fun setUp() {
    runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
    runCatching { NativeLoader.init(SystemDelegate()) }
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
    RNPingFidoCommon.foregroundActivityProvider = { true }
    originalDaVinciCollectorResolver = CoreRuntime.davinciCollectorResolver
    originalJourneyCallbackResolver = CoreRuntime.journeyCallbackResolver
  }

  @After
  fun tearDown() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    CoreRuntime.davinciCollectorResolver = originalDaVinciCollectorResolver
    CoreRuntime.journeyCallbackResolver = originalJourneyCallbackResolver
    unmockkAll()
  }

  private fun block(vararg pairs: Pair<String, Any?>) =
    JavaOnlyMap.of(*pairs.flatMap { listOf(it.first, it.second) }.toTypedArray())

  private fun androidConfig(key: String, block: JavaOnlyMap, useFido2ApiClient: Boolean) =
    block("useFido2ApiClient" to useFido2ApiClient, "android" to block(key to block))

  private val credentialManagerConfig = androidConfig(
    "credentialManager",
    block(
      "clientDataHash" to "AQID",
      "allowedProviders" to JavaOnlyArray.of("com.provider/com.provider.Service")
    ),
    useFido2ApiClient = false
  )

  private val playServicesConfig = androidConfig(
    "playServices",
    block(
      "timeoutSeconds" to 30.0,
      "requestId" to 9,
      "transports" to JavaOnlyArray.of("usb")
    ),
    useFido2ApiClient = true
  )

  @Suppress("UNCHECKED_CAST")
  private fun credentialManagerResult(customizer: FidoAuthenticateCustomizer): GetPublicKeyCredentialOption {
    val field = FidoAuthenticateCustomizer::class.java.getDeclaredField("getOptionCustomizer")
    field.isAccessible = true
    val transform = field.get(customizer) as (GetPublicKeyCredentialOption) -> GetPublicKeyCredentialOption
    return transform(GetPublicKeyCredentialOption("""{"challenge":"abc"}"""))
  }

  @Suppress("UNCHECKED_CAST")
  private fun playServicesResult(customizer: FidoAuthenticateCustomizer): PublicKeyCredentialRequestOptions {
    val field = FidoAuthenticateCustomizer::class.java.getDeclaredField("requestOptionsCustomizer")
    field.isAccessible = true
    val transform = field.get(customizer) as (PublicKeyCredentialRequestOptions) -> PublicKeyCredentialRequestOptions
    return transform(nativeRequest)
  }

  private fun capturingPromise(latch: CountDownLatch): Promise {
    val promise = mockk<Promise>(relaxed = true)
    every { promise.resolve(any()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<String>(), any<Throwable>()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<String>()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<Throwable>()) } answers { latch.countDown() }
    return promise
  }

  private fun mockCredentialManager(): CapturingSlot<GetCredentialRequest> {
    val activity = mockk<Activity>(relaxed = true)
    mockkObject(ContextProvider)
    every { ContextProvider.context } returns mockk<Context>(relaxed = true)
    every { ContextProvider.currentActivity } returns activity
    val credentialManager = mockk<CredentialManager>(relaxed = true)
    mockkObject(CredentialManager.Companion)
    every { CredentialManager.create(any()) } returns credentialManager
    val credential = mockk<PublicKeyCredential> {
      every { authenticationResponseJson } returns "{}"
    }
    val response = mockk<GetCredentialResponse> { every { this@mockk.credential } returns credential }
    val submitted = slot<GetCredentialRequest>()
    coEvery { credentialManager.getCredential(context = activity, request = capture(submitted)) } returns response
    return submitted
  }

  private fun mockFailingCredentialManager(error: Throwable) {
    val activity = mockk<Activity>(relaxed = true)
    mockkObject(ContextProvider)
    every { ContextProvider.context } returns mockk<Context>(relaxed = true)
    every { ContextProvider.currentActivity } returns activity
    val credentialManager = mockk<CredentialManager>(relaxed = true)
    mockkObject(CredentialManager.Companion)
    every { CredentialManager.create(any()) } returns credentialManager
    coEvery { credentialManager.getCredential(context = activity, request = any<GetCredentialRequest>()) } throws error
  }

  private fun rejectedCodeOf(error: Throwable): String? {
    mockFailingCredentialManager(error)
    val latch = CountDownLatch(1)
    val code = slot<String>()
    val promise = mockk<Promise>(relaxed = true)
    every { promise.reject(capture(code), any<String>(), any<Throwable>(), any()) } answers { latch.countDown() }

    RNPingFidoCommon.authenticate(standaloneOptions(), credentialManagerConfig, promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    return code.captured
  }

  private fun assertCredentialManagerApplied(option: GetPublicKeyCredentialOption) {
    assertEquals(listOf<Byte>(1, 2, 3), option.clientDataHash?.toList())
    assertEquals(setOf(ComponentName("com.provider", "com.provider.Service")), option.allowedProviders)
  }

  private fun assertPlayServicesApplied(options: PublicKeyCredentialRequestOptions) {
    assertEquals(30.0, options.timeoutSeconds)
    assertEquals(9, options.requestId)
    assertEquals(listOf(Transport.USB), options.allowList?.get(0)?.transports)
    assertEquals(listOf(Transport.USB), options.allowList?.get(1)?.transports)
  }

  private fun standaloneOptions() = block("challenge" to "abc", "rpId" to "example.com")

  /**
   * Ensures standalone authentication submits the Credential Manager overrides.
   */
  @Test
  fun standaloneAppliesCredentialManagerOverrides() {
    val submitted = mockCredentialManager()
    val latch = CountDownLatch(1)

    RNPingFidoCommon.authenticate(standaloneOptions(), credentialManagerConfig, capturingPromise(latch))

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertCredentialManagerApplied(submitted.captured.credentialOptions.single() as GetPublicKeyCredentialOption)
  }

  /**
   * Ensures Journey authentication hands the same customizer block to the callback.
   */
  @Test
  fun journeyAppliesOverrides() {
    val applied = CopyOnWriteArrayList<FidoAuthenticateCustomizer>()
    val firstLatch = CountDownLatch(1)
    val latch = CountDownLatch(1)
    val callback = mockk<FidoAuthenticationCallback>()
    coEvery { callback.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }

    RNPingFidoCommon.authenticateForJourney("journey-1", JavaOnlyMap(), credentialManagerConfig, capturingPromise(firstLatch))
    assertTrue(firstLatch.await(2, TimeUnit.SECONDS))
    RNPingFidoCommon.authenticateForJourney("journey-1", JavaOnlyMap(), playServicesConfig, capturingPromise(latch))
    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertFalse(applied[0].useFido2ApiClient)
    assertCredentialManagerApplied(credentialManagerResult(applied[0]))
    assertTrue(applied[1].useFido2ApiClient)
    assertPlayServicesApplied(playServicesResult(applied[1]))
  }

  /**
   * Ensures DaVinci authentication hands the same customizer block to the collector.
   */
  @Test
  fun daVinciAppliesOverrides() {
    val applied = CopyOnWriteArrayList<FidoAuthenticateCustomizer>()
    val firstLatch = CountDownLatch(1)
    val latch = CountDownLatch(1)
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), credentialManagerConfig, capturingPromise(firstLatch))
    assertTrue(firstLatch.await(2, TimeUnit.SECONDS))
    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), playServicesConfig, capturingPromise(latch))
    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertFalse(applied[0].useFido2ApiClient)
    assertCredentialManagerApplied(credentialManagerResult(applied[0]))
    assertTrue(applied[1].useFido2ApiClient)
    assertPlayServicesApplied(playServicesResult(applied[1]))
  }

  /**
   * Ensures the same Credential Manager spec yields the same option in all three scopes.
   */
  @Test
  fun credentialManagerSpecAppliesIdenticallyInEveryScope() {
    val submitted = mockCredentialManager()
    val applied = CopyOnWriteArrayList<FidoAuthenticateCustomizer>()
    val latch = CountDownLatch(3)
    val callback = mockk<FidoAuthenticationCallback>()
    coEvery { callback.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = capturingPromise(latch)

    RNPingFidoCommon.authenticate(standaloneOptions(), credentialManagerConfig, promise)
    RNPingFidoCommon.authenticateForJourney("journey-1", JavaOnlyMap(), credentialManagerConfig, promise)
    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), credentialManagerConfig, promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    val options = applied.map { credentialManagerResult(it) } +
      (submitted.captured.credentialOptions.single() as GetPublicKeyCredentialOption)
    assertEquals(3, options.size)
    options.forEach { assertCredentialManagerApplied(it) }
    assertEquals(setOf(false), applied.map { it.useFido2ApiClient }.toSet())
  }

  /**
   * Ensures an absent android block installs nothing in any scope.
   */
  @Test
  fun absentConfigKeepsNativeDefaultsInEveryScope() {
    val submitted = mockCredentialManager()
    val applied = CopyOnWriteArrayList<FidoAuthenticateCustomizer>()
    val latch = CountDownLatch(3)
    val callback = mockk<FidoAuthenticationCallback>()
    coEvery { callback.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } answers {
      applied.add(FidoAuthenticateCustomizer().apply(firstArg<FidoAuthenticateCustomizer.() -> Unit>()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = capturingPromise(latch)
    val config = block("useFido2ApiClient" to false)

    RNPingFidoCommon.authenticate(standaloneOptions(), config, promise)
    RNPingFidoCommon.authenticateForJourney("journey-1", JavaOnlyMap(), config, promise)
    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), config, promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    val untouched = GetPublicKeyCredentialOption("""{"challenge":"abc"}""")
    applied.forEach {
      assertEquals(untouched.requestJson, credentialManagerResult(it).requestJson)
      assertEquals(null, credentialManagerResult(it).clientDataHash)
    }
    assertEquals(null, (submitted.captured.credentialOptions.single() as GetPublicKeyCredentialOption).clientDataHash)
  }

  /**
   * Ensures a Credential Manager cancellation rejects standalone authentication with the
   * cancelled code, matching the Journey and DaVinci scopes.
   */
  @Test
  fun standaloneCancellationRejectsWithCancelledCode() {
    assertEquals(
      FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED,
      rejectedCodeOf(GetCredentialCancellationException("Cancelled by user"))
    )
  }

  /**
   * Ensures a missing credential rejects standalone authentication with the cancelled code.
   */
  @Test
  fun standaloneNoCredentialRejectsWithCancelledCode() {
    assertEquals(
      FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED,
      rejectedCodeOf(NoCredentialException("No eligible passkey credential"))
    )
  }

  /**
   * Ensures a non-recoverable failure keeps the generic authenticate error code.
   */
  @Test
  fun standaloneOtherFailureKeepsAuthenticateErrorCode() {
    assertEquals(
      FidoErrorCodes.FIDO_AUTHENTICATE_ERROR,
      rejectedCodeOf(GetCredentialUnknownException("boom"))
    )
  }
}
