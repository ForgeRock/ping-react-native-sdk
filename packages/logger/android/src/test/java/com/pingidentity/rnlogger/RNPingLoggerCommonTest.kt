/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnlogger

import com.facebook.react.bridge.ReadableMap
import com.pingidentity.logger.Logger
import com.pingidentity.logger.NONE
import com.pingidentity.rncore.CoreRuntime
import io.mockk.MockKAnnotations
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
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

    val id = RNPingLoggerCommon.configure(config)
    val level = resolveLevel(id)
    assertEquals("NONE", level)
  }

  @Test
  fun syncUpdatesLoggerLevel() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    val id = RNPingLoggerCommon.configure(registerConfig)
    val loggerBefore = RNPingLoggerCommon.resolveLogger(id)
    assertNotNull(loggerBefore)

    val syncConfig = createReadableMap(mapOf("id" to id, "level" to "WARN"))
    RNPingLoggerCommon.sync(syncConfig)

    assertTrue(waitForLevel(id, "WARN"))
    val loggerAfter = RNPingLoggerCommon.resolveLogger(id)
    assertSame(loggerBefore, loggerAfter)
  }

  @Test
  fun syncIgnoresInvalidLevel() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    val id = RNPingLoggerCommon.configure(registerConfig)

    val syncConfig = createReadableMap(mapOf("id" to id, "level" to "INVALID"))
    RNPingLoggerCommon.sync(syncConfig)

    Thread.sleep(150)
    assertEquals("STANDARD", resolveLevel(id))
  }

  @Test
  fun syncWithMissingIdDoesNotChangeLogger() {
    val registerConfig = createReadableMap(mapOf("level" to "STANDARD"))
    val id = RNPingLoggerCommon.configure(registerConfig)

    val syncConfig = createReadableMap(mapOf("id" to "missing", "level" to "WARN"))
    RNPingLoggerCommon.sync(syncConfig)

    Thread.sleep(150)
    assertEquals("STANDARD", resolveLevel(id))
  }

  private fun createReadableMap(data: Map<String, String>): ReadableMap {
    val map = mockk<ReadableMap>(relaxed = true)
    data.forEach { (key, value) ->
      every { map.getString(key) } returns value
    }
    return map
  }

  private fun waitForLevel(id: String, expected: String, timeoutMs: Long = 2_000): Boolean {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
      if (resolveLevel(id) == expected) {
        return true
      }
      Thread.sleep(50)
    }
    return false
  }

  private fun resolveLevel(id: String): String? {
    val handle = runBlocking { CoreRuntime.loggerRegistry.resolve(id) } as? com.pingidentity.rncore.logger.LoggerHandleContract
    return handle?.loggerLevel
  }
}
