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
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for device profile JSON conversion helpers.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class RNPingDeviceProfileModuleTest {

  private lateinit var module: RNPingDeviceProfileModule

  /**
   * Set up shared mocks for React Native bridge helpers.
   */
  @Before
  fun setUp() {
    mockkStatic(Arguments::class)
    io.mockk.every { Arguments.createMap() } answers { JavaOnlyMap() }
    io.mockk.every { Arguments.createArray() } answers { JavaOnlyArray() }

    module = RNPingDeviceProfileModule(mockk(relaxed = true))
  }

  /**
   * Release static mocks after each test.
   */
  @After
  fun tearDown() {
    unmockkStatic(Arguments::class)
  }

  /**
   * Verifies primitive conversions preserve expected Kotlin types.
   */
  @Test
  fun jsonPrimitiveToReactValuePreservesTypes() {
    val stringValue = module.run { JsonPrimitive("ping").toReactValue() }
    val booleanValue = module.run { JsonPrimitive(true).toReactValue() }
    val intValue = module.run { JsonPrimitive(42).toReactValue() }
    val doubleValue = module.run { JsonPrimitive(3.14).toReactValue() }
    val longValue = module.run { JsonPrimitive(9_007_199_254_740_992L).toReactValue() }

    assertEquals("ping", stringValue)
    assertEquals(true, booleanValue)
    assertEquals(42, intValue)
    assertEquals(3.14, doubleValue as Double, 0.0)
    assertTrue(longValue is Double)
  }

  /**
   * Verifies nested JSON objects and arrays map correctly to RN types.
   */
  @Test
  fun jsonObjectToReactValueBuildsNestedMaps() {
    val json = JsonObject(
      mapOf(
        "name" to JsonPrimitive("device"),
        "enabled" to JsonPrimitive(true),
        "count" to JsonPrimitive(7),
        "ratio" to JsonPrimitive(1.5),
        "nested" to JsonObject(mapOf("key" to JsonPrimitive("value"))),
        "items" to JsonArray(listOf(JsonPrimitive("a"), JsonPrimitive(2)))
      )
    )

    val map = module.run { json.toReactValue() } as ReadableMap
    val nested = map.getMap("nested") as ReadableMap
    val items = map.getArray("items") as ReadableArray

    assertEquals("device", map.getString("name"))
    assertEquals(true, map.getBoolean("enabled"))
    assertEquals(7, map.getInt("count"))
    assertEquals(1.5, map.getDouble("ratio"), 0.0)
    assertEquals("value", nested.getString("key"))
    assertEquals("a", items.getString(0))
    assertEquals(2, items.getInt(1))
  }

  /**
   * Verifies arrays convert to RN arrays with nested maps.
   */
  @Test
  fun jsonArrayToReactValueBuildsNestedArrays() {
    val json = JsonArray(
      listOf(
        JsonPrimitive("alpha"),
        JsonObject(mapOf("flag" to JsonPrimitive(false)))
      )
    )

    val array = module.run { json.toReactValue() } as ReadableArray

    assertEquals("alpha", array.getString(0))
    assertEquals(ReadableType.Map, array.getType(1))
    val nested = array.getMap(1) as ReadableMap
    assertEquals(false, nested.getBoolean("flag"))
  }
}
