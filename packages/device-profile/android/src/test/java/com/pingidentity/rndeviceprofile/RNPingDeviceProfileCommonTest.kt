/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.WritableMap
import com.pingidentity.device.profile.collector.BluetoothCollector
import com.pingidentity.device.profile.collector.BrowserCollector
import com.pingidentity.device.profile.collector.DeviceCollector
import com.pingidentity.device.profile.collector.HardwareCollector
import com.pingidentity.device.profile.collector.LocationCollector
import com.pingidentity.device.profile.collector.NetworkCollector
import com.pingidentity.device.profile.collector.PlatformCollector
import com.pingidentity.device.profile.collector.TelephonyCollector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import io.mockk.every
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Unit tests for shared helpers exposed by `RNPingDeviceProfileCommon`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingDeviceProfileCommonTest {

  @Before
  fun setUp() {
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
  }

  @After
  fun tearDown() {
    unmockkStatic(Arguments::class)
  }

  /**
   * Verifies collector instances are built for all requested types and location is included.
   */
  @Test
  fun buildCollectorsCreatesAllRequestedCollectorsIncludingLocation() {
    val collectors = callBuildCollectors(
      listOf("platform", "hardware", "network", "telephony", "browser", "bluetooth", "location"),
      includeLocation = true
    )

    // Verify all 7 collectors were created
    assertEquals(7, collectors.size)
    assertTrue(collectors.any { it is PlatformCollector })
    assertTrue(collectors.any { it is HardwareCollector })
    assertTrue(collectors.any { it is NetworkCollector })
    assertTrue(collectors.any { it is LocationCollector })
    // Note: TelephonyCollector, BrowserCollector, BluetoothCollector are singleton objects
    // and verified by count instead of type check
  }

  /**
   * Verifies the location collector is omitted when location capture is disabled.
   */
  @Test
  fun buildCollectorsDoesNotIncludeLocationWhenFlagDisabled() {
    val collectors = callBuildCollectors(listOf("location"), includeLocation = false)
    assertFalse(collectors.any { it is LocationCollector })
  }

  /**
   * Verifies location service detection returns true when the Play Services class is present.
   */
  @Test
  fun isLocationServicesAvailableReturnsTrueWhenClassPresent() {
    withLocationServicesResolver({ LocationCollector::class.java }) {
      assertTrue(callIsLocationServicesAvailable())
    }
  }

  /**
   * Verifies location service detection returns false when the Play Services class is missing.
   */
  @Test
  fun isLocationServicesAvailableReturnsFalseWhenClassMissing() {
    withLocationServicesResolver({
      throw ClassNotFoundException("missing")
    }) {
      assertFalse(callIsLocationServicesAvailable())
    }
  }

  /**
   * Verifies location collection rejects with a shared error payload when play services are unavailable.
   */
  @Test
  fun collectDeviceProfileRejectsWhenLocationServicesMissing() {
    val collectors = JavaOnlyArray().apply {
      pushString("location")
    }
    val promise = TestPromise()

    RNPingDeviceProfileCommon.collectDeviceProfile(collectors, promise)

    assertTrue(promise.awaitCompletion())

    val payload = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("DEVICE_PROFILE_LOCATION_UNAVAILABLE", promise.rejectCode)
    assertEquals("state_error", payload.getString("type"))
    assertEquals("DEVICE_PROFILE_LOCATION_UNAVAILABLE", payload.getString("error"))
    assertTrue(payload.getString("message")?.contains("play-services-location") == true)
  }

  /**
   * Verifies journey collection rejects with a shared error payload when location services are unavailable.
   */
  @Test
  fun collectDeviceProfileForJourneyRejectsWhenLocationServicesMissing() {
    val collectors = JavaOnlyArray().apply {
      pushString("location")
    }
    val promise = TestPromise()

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      "journey-123",
      collectors,
      null,
      promise
    )

    assertTrue(promise.awaitCompletion())

    val payload = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("DEVICE_PROFILE_LOCATION_UNAVAILABLE", promise.rejectCode)
    assertEquals("state_error", payload.getString("type"))
    assertEquals("DEVICE_PROFILE_LOCATION_UNAVAILABLE", payload.getString("error"))
    assertTrue(payload.getString("message")?.contains("play-services-location") == true)
  }

  /**
   * Verifies journey collection rejects with a shared error payload when no callback is registered.
   */
  @Test
  fun collectDeviceProfileForJourneyRejectsWhenCallbackMissing() {
    val collectors = JavaOnlyArray()
    val promise = TestPromise()

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      "journey-456",
      collectors,
      null,
      promise
    )

    assertTrue(promise.awaitCompletion())

    val payload = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", promise.rejectCode)
    assertEquals("state_error", payload.getString("type"))
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", payload.getString("error"))
    assertTrue(payload.getString("message")?.contains("journey-456") == true)
  }

  /**
   * Verifies buildCollectors returns empty list when no collectors are provided.
   */
  @Test
  fun buildCollectorsReturnsEmptyWhenNoCollectorsProvided() {
    val collectors = callBuildCollectors(emptyList(), includeLocation = true)
    assertEquals(0, collectors.size)
  }

  /**
   * Verifies buildCollectors returns empty list when collectors are unknown.
   */
  @Test
  fun buildCollectorsReturnsEmptyWhenCollectorsUnknown() {
    val collectors = callBuildCollectors(listOf("unknown", "ignored"), includeLocation = true)
    assertEquals(0, collectors.size)
  }

  /**
   * Verifies buildCollectors creates multiple collectors correctly.
   */
  @Test
  fun buildCollectorsCreatesMultipleCollectors() {
    val collectors = callBuildCollectors(
      listOf("platform", "hardware", "network"),
      includeLocation = true
    )
    assertEquals(3, collectors.size)
    assertTrue(collectors.any { it is PlatformCollector })
    assertTrue(collectors.any { it is HardwareCollector })
    assertTrue(collectors.any { it is NetworkCollector })
  }

  /**
   * Verifies buildCollectors handles duplicate collectors by creating multiple instances.
   */
  @Test
  fun buildCollectorsHandlesDuplicateCollectors() {
    val collectors = callBuildCollectors(
      listOf("platform", "platform", "hardware"),
      includeLocation = true
    )
    // Duplicates result in multiple collector instances
    assertEquals(3, collectors.size)
  }

  /**
   * Verifies buildCollectors handles mixed valid and invalid collectors.
   */
  @Test
  fun buildCollectorsHandlesMixedCollectors() {
    val collectors = callBuildCollectors(
      listOf("platform", "unknown", "hardware"),
      includeLocation = true
    )
    // Only valid collectors are created
    assertEquals(2, collectors.size)
    assertTrue(collectors.any { it is PlatformCollector })
    assertTrue(collectors.any { it is HardwareCollector })
  }

  /**
   * Verifies buildCollectors creates all known collectors.
   */
  @Test
  fun buildCollectorsCreatesAllKnownCollectorsExceptLocation() {
    val collectors = callBuildCollectors(
      listOf("platform", "hardware", "network", "telephony", "browser", "bluetooth"),
      includeLocation = true
    )
    assertEquals(6, collectors.size)
  }

  /**
   * Verifies buildCollectors ignores empty string collectors.
   */
  @Test
  fun buildCollectorsIgnoresEmptyStringCollector() {
    val collectors = callBuildCollectors(
      listOf("", "platform"),
      includeLocation = true
    )
    // Empty string should be ignored
    assertEquals(1, collectors.size)
    assertTrue(collectors.any { it is PlatformCollector })
  }

  /**
   * Verifies buildCollectors is case-sensitive for collector names.
   */
  @Test
  fun buildCollectorsIsCaseSensitive() {
    val collectors = callBuildCollectors(
      listOf("Platform", "HARDWARE", "platform"),
      includeLocation = true
    )
    // Only lowercase "platform" should match
    assertEquals(1, collectors.size)
    assertTrue(collectors.any { it is PlatformCollector })
  }

  /**
   * Verifies readCollectors helper parses array correctly.
   */
  @Test
  fun readCollectorsReturnsEmptyListForEmptyArray() {
    val readableArray = JavaOnlyArray()
    val result = callReadCollectors(readableArray)
    assertEquals(0, result.size)
  }

  /**
   * Verifies readCollectors handles multiple strings.
   */
  @Test
  fun readCollectorsHandlesMultipleStrings() {
    val readableArray = JavaOnlyArray().apply {
      pushString("platform")
      pushString("hardware")
      pushString("network")
    }
    val result = callReadCollectors(readableArray)
    assertEquals(3, result.size)
    assertTrue(result.contains("platform"))
    assertTrue(result.contains("hardware"))
    assertTrue(result.contains("network"))
  }

  /**
   * Verifies readCollectors handles non-string values gracefully.
   */
  @Test
  fun readCollectorsIgnoresNonStringValues() {
    val readableArray = JavaOnlyArray().apply {
      pushString("platform")
      pushInt(123)
      pushBoolean(true)
      pushString("hardware")
    }
    val result = callReadCollectors(readableArray)
    // Only strings should be included
    assertEquals(2, result.size)
    assertTrue(result.contains("platform"))
    assertTrue(result.contains("hardware"))
  }

  /**
   * Verifies readCollectors handles null strings.
   */
  @Test
  fun readCollectorsHandlesNullStrings() {
    val readableArray = JavaOnlyArray().apply {
      pushString("platform")
      pushNull()
      pushString("hardware")
    }
    val result = callReadCollectors(readableArray)
    // Nulls should be skipped
    assertEquals(2, result.size)
    assertTrue(result.contains("platform"))
    assertTrue(result.contains("hardware"))
  }

  /**
   * Verifies journey collection rejects with a shared error payload with empty journey ID.
   */
  @Test
  fun collectDeviceProfileForJourneyWithEmptyJourneyIdRejects() {
    val collectors = JavaOnlyArray().apply {
      pushString("platform")
    }
    val promise = TestPromise()

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      "",
      collectors,
      null,
      promise
    )

    assertTrue(promise.awaitCompletion())

    val payload = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", promise.rejectCode)
    assertEquals("state_error", payload.getString("type"))
    assertEquals("DEVICE_PROFILE_CALLBACK_NOT_FOUND", payload.getString("error"))
    assertTrue(payload.getString("message")?.isNotEmpty() == true)
  }

  private class TestPromise : com.facebook.react.bridge.Promise {
    var rejectCode: String? = null
    var rejectMessage: String? = null
    var rejectError: Throwable? = null
    var rejectUserInfo: WritableMap? = null
    var resolvedValue: Any? = null
    private val completionLatch = CountDownLatch(1)

    override fun resolve(value: Any?) {
      resolvedValue = value
      signalCompletion()
    }

    override fun reject(code: String, message: String?) {
      rejectCode = code
      rejectMessage = message
      signalCompletion()
    }

    override fun reject(code: String, throwable: Throwable?) {
      rejectCode = code
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(throwable: Throwable) {
      rejectError = throwable
      signalCompletion()
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, userInfo: WritableMap) {
      rejectCode = code
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      rejectCode = code
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      rejectCode = code
      rejectMessage = message
      rejectUserInfo = userInfo
      signalCompletion()
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
      rejectUserInfo = userInfo
      signalCompletion()
    }

    @Suppress("DEPRECATION")
    override fun reject(message: String) {
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

  /**
   * Temporarily overrides the resolver that locates Play Services classes.
   */
  private inline fun <T> withLocationServicesResolver(
    noinline resolver: (String) -> Class<*>,
    block: () -> T
  ): T {
    val previousResolver = RNPingDeviceProfileCommon.locationServicesClassResolver
    return try {
      RNPingDeviceProfileCommon.locationServicesClassResolver = resolver
      block()
    } finally {
      RNPingDeviceProfileCommon.locationServicesClassResolver = previousResolver
    }
  }

  private fun callBuildCollectors(
    collectorTypes: List<String>,
    includeLocation: Boolean
  ): List<DeviceCollector<*>> {
    val method = RNPingDeviceProfileCommon::class.java.getDeclaredMethod(
      "buildCollectors",
      List::class.java,
      Boolean::class.javaPrimitiveType
    ).apply { isAccessible = true }
    @Suppress("UNCHECKED_CAST")
    return method.invoke(RNPingDeviceProfileCommon, collectorTypes, includeLocation) as MutableList<DeviceCollector<*>>
  }

  private fun callIsLocationServicesAvailable(): Boolean {
    val method =
      RNPingDeviceProfileCommon::class.java.getDeclaredMethod("isLocationServicesAvailable").apply { isAccessible = true }
    return method.invoke(RNPingDeviceProfileCommon) as Boolean
  }

  private fun callReadCollectors(collectors: com.facebook.react.bridge.ReadableArray): List<String> {
    val method = RNPingDeviceProfileCommon::class.java.getDeclaredMethod(
      "readCollectors",
      com.facebook.react.bridge.ReadableArray::class.java
    ).apply { isAccessible = true }
    @Suppress("UNCHECKED_CAST")
    return method.invoke(RNPingDeviceProfileCommon, collectors) as List<String>
  }
}
