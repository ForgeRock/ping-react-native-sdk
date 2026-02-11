/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.reactnative.rndeviceid

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.pingidentity.device.id.DeviceIdentifier
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for Device ID module metadata.
 */
class RNPingDeviceIdTest {

  /**
   * Ensures the TurboModule name is correct.
   */
  @Test
  fun moduleNameIsCorrect() {
    assertEquals("RNPingDeviceId", RNPingDeviceIdModule.NAME)
  }

  /**
   * Ensures the classic module name matches expectations.
   */
  @Test
  fun classicModuleNameIsCorrect() {
    assertEquals("RNPingDeviceIdClassic", RNPingDeviceIdClassicModule.NAME)
  }

  /**
   * Ensures the classic module annotation uses the expected name.
   */
  @Test
  fun classicModuleAnnotationNameIsCorrect() {
    val annotation = RNPingDeviceIdClassicModule::class.java.getAnnotation(ReactModule::class.java)
    assertNotNull(annotation)
    assertEquals(RNPingDeviceIdClassicModule.NAME, annotation.name)
  }

  /**
   * Ensures default device ID resolution resolves with the expected value.
   */
  @Test
  fun getDefaultDeviceIdResolvesValue() {
    val promise = TestPromise()
    withDefaultIdentifier(identifierReturning("test-device-id")) {
      RNPingDeviceIdCommon.getDefaultDeviceId(promise)
      assertTrue(promise.await())
      assertEquals("test-device-id", promise.resolvedValue)
      assertNull(promise.rejectedCode)
    }
  }

  /**
   * Ensures default device ID resolution rejects with the expected error details.
   */
  @Test
  fun getDefaultDeviceIdRejectsOnException() {
    val error = IllegalStateException("boom")
    val promise = TestPromise()
    withDefaultIdentifier(identifierThrowing(error)) {
      RNPingDeviceIdCommon.getDefaultDeviceId(promise)
      assertTrue(promise.await())
      assertEquals("DEVICE_ID_ERROR", promise.rejectedCode)
      assertEquals("boom", promise.rejectedMessage)
      assertEquals(error, promise.rejectedThrowable)
      assertNull(promise.resolvedValue)
    }
  }

  private fun withDefaultIdentifier(
    identifier: DeviceIdentifier,
    block: () -> Unit
  ): Unit {
    val original = DeviceIdentifier.identifier
    try {
      DeviceIdentifier.identifier = identifier
      block()
    } finally {
      DeviceIdentifier.identifier = original
    }
  }

  private fun identifierReturning(value: String): DeviceIdentifier {
    return object : DeviceIdentifier {
      override val id: suspend () -> String = { value }
    }
  }

  private fun identifierThrowing(error: Exception): DeviceIdentifier {
    return object : DeviceIdentifier {
      override val id: suspend () -> String = { throw error }
    }
  }

  private class TestPromise : Promise {
    private val latch = CountDownLatch(1)

    var resolvedValue: Any? = null
      private set
    var rejectedCode: String? = null
      private set
    var rejectedMessage: String? = null
      private set
    var rejectedThrowable: Throwable? = null
      private set

    fun await(timeoutMs: Long = 2_000): Boolean {
      return latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    }

    override fun resolve(value: Any?) {
      resolvedValue = value
      latch.countDown()
    }

    override fun reject(code: String, message: String?) {
      rejectedCode = code
      rejectedMessage = message
      latch.countDown()
    }

    override fun reject(code: String, throwable: Throwable?) {
      rejectedCode = code
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      rejectedCode = code
      rejectedMessage = message
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable) {
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, userInfo: WritableMap) {
      rejectedCode = code
      latch.countDown()
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedMessage = message
      latch.countDown()
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      rejectedCode = code
      rejectedMessage = message
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(message: String) {
      rejectedMessage = message
      latch.countDown()
    }
  }
}
