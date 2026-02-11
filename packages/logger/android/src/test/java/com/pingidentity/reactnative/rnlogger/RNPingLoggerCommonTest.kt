/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnlogger

import com.facebook.react.bridge.ReadableMap
import com.pingidentity.logger.Logger
import com.pingidentity.logger.NONE
import com.pingidentity.logger.STANDARD
import com.pingidentity.logger.WARN
import com.reactnativepingidentity.core.CoreRuntime
import io.mockk.MockKAnnotations
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class RNPingLoggerCommonTest {

  @Before
  fun setUp() {
    MockKAnnotations.init(this)
    Logger.logger = Logger.NONE
    runBlocking { CoreRuntime.loggerRegistry.removeAll() }
  }

  @After
  fun tearDown() {
    Logger.logger = Logger.NONE
    runBlocking { CoreRuntime.loggerRegistry.removeAll() }
  }

  @Test
  fun configureReturnsId() {
    val config = createReadableMap(mapOf("level" to "STANDARD"))

    val id = RNPingLoggerCommon.configure(config)

    assertTrue(id.isNotEmpty())
  }

  @Test
  fun configureRegistersHandle() {
    val config = createReadableMap(mapOf("level" to "STANDARD"))

    val id = RNPingLoggerCommon.configure(config)
    val handle = runBlocking { CoreRuntime.loggerRegistry.resolve(id) }

    assertNotNull(handle)
  }

  @Test
  fun configureDefaultsToNoneOnInvalidLevel() {
    val config = createReadableMap(mapOf("level" to "INVALID"))

    RNPingLoggerCommon.configure(config)

    assertEquals(Logger.NONE, Logger.logger)
  }

  @Test
  fun syncUpdatesLoggerLevel() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    val id = RNPingLoggerCommon.configure(registerConfig)

    val syncConfig = createReadableMap(mapOf("id" to id, "level" to "WARN"))
    RNPingLoggerCommon.sync(syncConfig)

    assertTrue(waitForLogger(Logger.WARN))
  }

  @Test
  fun syncIgnoresInvalidLevel() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    val id = RNPingLoggerCommon.configure(registerConfig)

    val syncConfig = createReadableMap(mapOf("id" to id, "level" to "INVALID"))
    RNPingLoggerCommon.sync(syncConfig)

    Thread.sleep(150)
    assertEquals(Logger.STANDARD, Logger.logger)
  }

  @Test
  fun syncWithMissingIdDoesNotChangeLogger() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    RNPingLoggerCommon.configure(registerConfig)

    val syncConfig = createReadableMap(mapOf("id" to "missing", "level" to "WARN"))
    RNPingLoggerCommon.sync(syncConfig)

    Thread.sleep(150)
    assertEquals(Logger.STANDARD, Logger.logger)
  }

  private fun createReadableMap(data: Map<String, String>): ReadableMap {
    val map = mockk<ReadableMap>(relaxed = true)
    data.forEach { (key, value) ->
      every { map.getString(key) } returns value
    }
    return map
  }

  private fun waitForLogger(expected: Logger, timeoutMs: Long = 2_000): Boolean {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
      if (Logger.logger == expected) {
        return true
      }
      Thread.sleep(50)
    }
    return false
  }
}
