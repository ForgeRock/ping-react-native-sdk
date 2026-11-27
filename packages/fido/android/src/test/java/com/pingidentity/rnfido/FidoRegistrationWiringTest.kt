/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.CreatePublicKeyCredentialRequest
import android.app.Activity
import android.content.Context
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.exceptions.CreateCredentialCancellationException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.pingidentity.fido.FidoRegistrationCustomizer
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.fido.journey.FidoRegistrationCallback
import com.pingidentity.android.ContextProvider
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.JourneyCallbackResolver
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Verifies that the registration customizer built from the call config reaches the native
 * registration entry points in the standalone, Journey and DaVinci scopes.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoRegistrationWiringTest {

  private var originalDaVinciCollectorResolver: DaVinciCollectorResolver? = null
  private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null

  private val originalRequest = CreatePublicKeyCredentialRequest(
    requestJson = ORIGINAL_JSON,
    clientDataHash = byteArrayOf(1),
    preferImmediatelyAvailableCredentials = false,
    origin = "https://original.example",
    isAutoSelectAllowed = false,
    isConditional = false
  )

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

  private fun config(vararg fields: Pair<String, Any>): JavaOnlyMap {
    return JavaOnlyMap.of(
      "android",
      JavaOnlyMap.of("credentialManager", JavaOnlyMap.of(*fields.flatMap { listOf(it.first, it.second) }.toTypedArray()))
    )
  }

  private fun applyBlock(block: FidoRegistrationCustomizer.() -> Unit): CreatePublicKeyCredentialRequest {
    val customizer = FidoRegistrationCustomizer().apply(block)
    val field = FidoRegistrationCustomizer::class.java.getDeclaredField("customizer")
    field.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    val transform = field.get(customizer) as (CreatePublicKeyCredentialRequest) -> CreatePublicKeyCredentialRequest
    return transform(originalRequest)
  }

  /**
   * Routes the real `FidoClient.register` through a mocked Credential Manager and returns
   * the slot that captures the request it ultimately submits.
   */
  private fun mockCredentialManager(): io.mockk.CapturingSlot<CreatePublicKeyCredentialRequest> {
    val activity = mockk<Activity>(relaxed = true)
    mockkObject(ContextProvider)
    every { ContextProvider.context } returns mockk<Context>(relaxed = true)
    every { ContextProvider.currentActivity } returns activity
    val credentialManager = mockk<CredentialManager>(relaxed = true)
    mockkObject(CredentialManager.Companion)
    every { CredentialManager.create(any()) } returns credentialManager
    val response = mockk<CreatePublicKeyCredentialResponse> {
      every { registrationResponseJson } returns "{}"
    }
    val submitted = slot<CreatePublicKeyCredentialRequest>()
    coEvery {
      credentialManager.createCredential(context = activity, request = capture(submitted))
    } returns response
    return submitted
  }

  private fun creationOptions(): JavaOnlyMap {
    return JavaOnlyMap.of(
      "challenge", "abc",
      "rp", JavaOnlyMap.of("id", "example.com", "name", "Example"),
      "user", JavaOnlyMap.of("id", "dXNlcg", "name", "user", "displayName", "User")
    )
  }

  private fun capturingPromise(latch: CountDownLatch): Promise {
    val promise = mockk<Promise>(relaxed = true)
    every { promise.resolve(any()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<String>(), any<Throwable>()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<String>()) } answers { latch.countDown() }
    every { promise.reject(any<String>(), any<Throwable>()) } answers { latch.countDown() }
    return promise
  }

  private val configuredOverrides = config(
    "preferImmediatelyAvailableCredentials" to true,
    "origin" to "https://configured.example"
  )

  private val topLevelPreference = JavaOnlyMap.of("preferImmediatelyAvailableCredentials", true)

  private fun assertConfiguredRequest(request: CreatePublicKeyCredentialRequest) {
    assertTrue(request.preferImmediatelyAvailableCredentials)
    assertEquals("https://configured.example", request.origin)
    assertEquals(ORIGINAL_JSON, request.requestJson)
    assertEquals(listOf<Byte>(1), request.clientDataHash?.toList())
    assertTrue(!request.isAutoSelectAllowed)
    assertTrue(!request.isConditional)
    assertNull(request.displayInfo.preferDefaultProvider)
  }

  /**
   * Ensures standalone registration forwards the configured overrides, including the
   * registration preference, through the native customizer hook.
   */
  @Test
  fun standaloneRegistrationAppliesOverrides() {
    val submitted = mockCredentialManager()
    val latch = CountDownLatch(1)

    RNPingFidoCommon.register(creationOptions(), configuredOverrides, capturingPromise(latch))

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    val request = submitted.captured
    assertTrue(request.preferImmediatelyAvailableCredentials)
    assertEquals("https://configured.example", request.origin)
    assertTrue(request.requestJson.contains("\"challenge\":\"abc\""))
  }

  /**
   * Ensures Journey registration forwards the same overrides to the callback.
   */
  @Test
  fun journeyRegistrationAppliesOverrides() {
    var applied: CreatePublicKeyCredentialRequest? = null
    var deviceName: String? = "unset"
    val latch = CountDownLatch(1)
    val callback = mockk<FidoRegistrationCallback>()
    coEvery { callback.register(any(), any()) } answers {
      deviceName = firstArg()
      applied = applyBlock(secondArg())
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }

    RNPingFidoCommon.registerForJourney("journey-1", JavaOnlyMap(), configuredOverrides, capturingPromise(latch))

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertNull(deviceName)
    assertConfiguredRequest(requireNotNull(applied))
  }

  /**
   * Ensures DaVinci registration forwards the same overrides to the collector.
   */
  @Test
  fun daVinciRegistrationAppliesOverrides() {
    var applied: CreatePublicKeyCredentialRequest? = null
    val latch = CountDownLatch(1)
    val collector = mockk<FidoRegistrationCollector>()
    coEvery { collector.register(any()) } answers {
      applied = applyBlock(firstArg())
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }

    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), configuredOverrides, capturingPromise(latch))

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertConfiguredRequest(requireNotNull(applied))
  }

  /**
   * Ensures the same configuration yields an identical request in all three scopes.
   */
  @Test
  fun sameConfigurationAppliesIdenticallyInEveryScope() {
    val applied = CopyOnWriteArrayList<CreatePublicKeyCredentialRequest>()
    val latch = CountDownLatch(3)
    val submitted = mockCredentialManager()
    val callback = mockk<FidoRegistrationCallback>()
    coEvery { callback.register(any(), any()) } answers {
      applied.add(applyBlock(secondArg()))
      Result.success(JsonObject(emptyMap()))
    }
    val collector = mockk<FidoRegistrationCollector>()
    coEvery { collector.register(any()) } answers {
      applied.add(applyBlock(firstArg()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = capturingPromise(latch)

    RNPingFidoCommon.register(creationOptions(), configuredOverrides, promise)
    RNPingFidoCommon.registerForJourney("journey-1", JavaOnlyMap(), configuredOverrides, promise)
    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), configuredOverrides, promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    val requests = applied + submitted.captured
    assertEquals(setOf("https://configured.example"), requests.map { it.origin }.toSet())
    assertEquals(setOf(true), requests.map { it.preferImmediatelyAvailableCredentials }.toSet())
    assertEquals(setOf(false), requests.map { it.isAutoSelectAllowed }.toSet())
    assertEquals(setOf(false), requests.map { it.isConditional }.toSet())
  }

  /**
   * Ensures a top-level registration preference reaches the request in every scope.
   */
  @Test
  fun topLevelPreferenceAppliesInEveryScope() {
    val applied = CopyOnWriteArrayList<CreatePublicKeyCredentialRequest>()
    val latch = CountDownLatch(3)
    val submitted = mockCredentialManager()
    val callback = mockk<FidoRegistrationCallback>()
    coEvery { callback.register(any(), any()) } answers {
      applied.add(applyBlock(secondArg()))
      Result.success(JsonObject(emptyMap()))
    }
    val collector = mockk<FidoRegistrationCollector>()
    coEvery { collector.register(any()) } answers {
      applied.add(applyBlock(firstArg()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = capturingPromise(latch)

    RNPingFidoCommon.register(creationOptions(), topLevelPreference, promise)
    RNPingFidoCommon.registerForJourney("journey-1", JavaOnlyMap(), topLevelPreference, promise)
    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), topLevelPreference, promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertTrue(submitted.captured.preferImmediatelyAvailableCredentials)
    assertEquals(2, applied.size)
    applied.forEach { assertTrue(it.preferImmediatelyAvailableCredentials) }
  }

  /**
   * Ensures an absent android block leaves the native request untouched in every scope.
   */
  @Test
  fun absentConfigKeepsOriginalRequestInEveryScope() {
    val applied = CopyOnWriteArrayList<CreatePublicKeyCredentialRequest>()
    val latch = CountDownLatch(3)
    val submitted = mockCredentialManager()
    val callback = mockk<FidoRegistrationCallback>()
    coEvery { callback.register(any(), any()) } answers {
      applied.add(applyBlock(secondArg()))
      Result.success(JsonObject(emptyMap()))
    }
    val collector = mockk<FidoRegistrationCollector>()
    coEvery { collector.register(any()) } answers {
      applied.add(applyBlock(firstArg()))
      Result.success(JsonObject(emptyMap()))
    }
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = capturingPromise(latch)

    RNPingFidoCommon.register(creationOptions(), JavaOnlyMap(), promise)
    RNPingFidoCommon.registerForJourney("journey-1", JavaOnlyMap(), JavaOnlyMap(), promise)
    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertEquals(2, applied.size)
    assertNull(submitted.captured.origin)
    assertEquals(false, submitted.captured.preferImmediatelyAvailableCredentials)
    applied.forEach {
      assertEquals(originalRequest.origin, it.origin)
      assertEquals(originalRequest.preferImmediatelyAvailableCredentials, it.preferImmediatelyAvailableCredentials)
      assertEquals(originalRequest.requestJson, it.requestJson)
    }
  }

  /**
   * Ensures standalone registration keeps the register error code when the user cancels,
   * so only authentication maps cancellation to a dedicated code.
   */
  @Test
  fun standaloneRegistrationCancellationKeepsRegisterErrorCode() {
    val activity = mockk<Activity>(relaxed = true)
    mockkObject(ContextProvider)
    every { ContextProvider.context } returns mockk<Context>(relaxed = true)
    every { ContextProvider.currentActivity } returns activity
    val credentialManager = mockk<CredentialManager>(relaxed = true)
    mockkObject(CredentialManager.Companion)
    every { CredentialManager.create(any()) } returns credentialManager
    coEvery {
      credentialManager.createCredential(context = activity, request = any<CreatePublicKeyCredentialRequest>())
    } throws CreateCredentialCancellationException("Cancelled by user")
    val latch = CountDownLatch(1)
    val code = slot<String>()
    val promise = mockk<Promise>(relaxed = true)
    every { promise.reject(capture(code), any<String>(), any<Throwable>(), any()) } answers { latch.countDown() }

    RNPingFidoCommon.register(creationOptions(), JavaOnlyMap(), promise)

    assertTrue(latch.await(2, TimeUnit.SECONDS))
    assertEquals(FidoErrorCodes.FIDO_REGISTER_ERROR, code.captured)
  }

  private companion object {
    const val ORIGINAL_JSON =
      """{"challenge":"abc","rp":{"id":"example.com","name":"Example"},"user":{"id":"dXNlcg","name":"user","displayName":"User"}}"""
  }
}
