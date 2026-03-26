/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for FIDO module metadata and fallback behavior.
 */
class RNPingFidoTest {

  /**
   * Ensures the TurboModule name is correct.
   */
  @Test
  fun moduleNameIsCorrect() {
    assertEquals("RNPingFido", RNPingFidoModule.NAME)
  }

  /**
   * Ensures the current scaffold rejects with a stable FIDO error code.
   */
  @Test
  fun getDefaultFidoRejectsWithScaffoldError() {
    val promise = TestPromise()

    RNPingFidoCommon.getDefaultFido(promise)

    assertTrue(promise.await())
    assertEquals("FIDO_ERROR", promise.rejectedCode)
    assertEquals("FIDO bridge is scaffolded but not implemented.", promise.rejectedMessage)
    assertNull(promise.resolvedValue)
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
