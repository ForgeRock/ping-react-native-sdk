/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rndeviceprofile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactApplicationContext
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Unit tests for the React Native module surface.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingDeviceProfileModuleTest {

  private val reactContext = mockk<ReactApplicationContext>(relaxed = true)
  private lateinit var module: RNPingDeviceProfileModule

  @Before
  fun setUp() {
    module = RNPingDeviceProfileModule(reactContext)
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
  }

  @After
  fun tearDown() {
    unmockkStatic(Arguments::class)
  }

  /**
   * Verifies the module exposes the spec constant used by the React Native bridge.
   */
  @Test
  fun moduleNameMatchesSpec() {
    assertEquals(NativeRNPingDeviceProfileSpec.NAME, RNPingDeviceProfileModule.NAME)
  }

  /**
   * Ensures `collectDeviceProfile` delegates to the shared implementation.
   */
  @Test
  fun collectDeviceProfileDelegatesToCommon() {
    val collectors = JavaOnlyArray()
    val promise = TestPromise()

    module.collectDeviceProfile(collectors, promise)

    // Wait for async operation to complete
    assertTrue(promise.awaitCompletion())
    
    // Verify promise was resolved (empty collectors should succeed with empty object)
    assertTrue(promise.wasResolved)
  }

  /**
   * Ensures `collectDeviceProfileForJourney` delegates to the shared implementation.
   */
  @Test
  fun collectDeviceProfileForJourneyDelegatesToCommon() {
    val collectors = JavaOnlyArray()
    val promise = TestPromise()

    module.collectDeviceProfileForJourney("journey-123", collectors, null, promise)

    // Wait for async operation to complete
    assertTrue(promise.awaitCompletion())
    
    // Verify promise was rejected with a shared error payload (no callback registered for journey)
    assertTrue(promise.wasRejected)
    val payload = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", promise.rejectCode)
    assertEquals("state_error", payload.getString("type"))
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", payload.getString("error"))
  }

  private class TestPromise : com.facebook.react.bridge.Promise {
    var wasResolved = false
    var wasRejected = false
    var rejectCode: String? = null
    var rejectMessage: String? = null
    var rejectError: Throwable? = null
    var rejectUserInfo: com.facebook.react.bridge.WritableMap? = null
    var resolvedValue: Any? = null
    private val completionLatch = CountDownLatch(1)

    override fun resolve(value: Any?) {
      wasResolved = true
      resolvedValue = value
      signalCompletion()
    }

    override fun reject(code: String, message: String?) {
      wasRejected = true
      rejectCode = code
      rejectMessage = message
      signalCompletion()
    }

    override fun reject(code: String, throwable: Throwable?) {
      wasRejected = true
      rejectCode = code
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      wasRejected = true
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(throwable: Throwable) {
      wasRejected = true
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(throwable: Throwable, userInfo: com.facebook.react.bridge.WritableMap) {
      wasRejected = true
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, userInfo: com.facebook.react.bridge.WritableMap) {
      wasRejected = true
      rejectCode = code
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: com.facebook.react.bridge.WritableMap) {
      wasRejected = true
      rejectCode = code
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, message: String?, userInfo: com.facebook.react.bridge.WritableMap) {
      wasRejected = true
      rejectCode = code
      rejectMessage = message
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: com.facebook.react.bridge.WritableMap?
    ) {
      wasRejected = true
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    @Suppress("DEPRECATION")
    override fun reject(message: String) {
      wasRejected = true
      rejectMessage = message
      signalCompletion()
    }

    private fun signalCompletion() {
      completionLatch.countDown()
    }

    fun awaitCompletion(timeoutMs: Long = 2_000): Boolean {
      return completionLatch.await(timeoutMs, TimeUnit.MILLISECONDS)
    }
  }
}
