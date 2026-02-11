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
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import io.mockk.every
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
 * Unit tests for JSON-to-React conversions exposed by `RNPingDeviceProfileCommon`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingDeviceProfileJsonBridgeTest {

  /**
   * Set up shared mocks for React Native bridge helpers.
   */
  @Before
  fun setUp() {
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
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
    val stringValue = RNPingDeviceProfileCommon.run { JsonPrimitive("ping").toReactValue() }
    val booleanValue = RNPingDeviceProfileCommon.run { JsonPrimitive(true).toReactValue() }
    val intValue = RNPingDeviceProfileCommon.run { JsonPrimitive(42).toReactValue() }
    val doubleValue = RNPingDeviceProfileCommon.run { JsonPrimitive(3.14).toReactValue() }
    val longValue = RNPingDeviceProfileCommon.run { JsonPrimitive(9_007_199_254_740_992L).toReactValue() }

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

    val map = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableMap
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

    val array = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableArray

    assertEquals("alpha", array.getString(0))
    assertEquals(ReadableType.Map, array.getType(1))
    val nested = array.getMap(1) as ReadableMap
    assertEquals(false, nested.getBoolean("flag"))
  }

  /**
   * Verifies JsonNull converts to a nullable React Native value.
   */
  @Test
  fun jsonNullToReactValueReturnsNull() {
    val value = RNPingDeviceProfileCommon.run { JsonNull.toReactValue() }
    assertEquals(null, value)
  }

  /**
   * Verifies empty JsonObject and JsonArray convert to empty RN containers.
   */
  @Test
  fun emptyJsonContainersConvertToEmptyReactValues() {
    val map = RNPingDeviceProfileCommon.run { JsonObject(emptyMap()).toReactValue() } as ReadableMap
    val array = RNPingDeviceProfileCommon.run { JsonArray(emptyList()).toReactValue() } as ReadableArray

    assertEquals(0, map.toHashMap().size)
    assertEquals(0, array.size())
  }

  /**
   * Verifies deeply nested structures convert correctly to RN types.
   */
  @Test
  fun deeplyNestedJsonToReactValueBuildsStructure() {
    val json = JsonObject(
      mapOf(
        "level1" to JsonArray(
          listOf(
            JsonObject(
              mapOf(
                "level2" to JsonObject(
                  mapOf(
                    "level3" to JsonArray(
                      listOf(
                        JsonPrimitive(1),
                        JsonObject(mapOf("value" to JsonPrimitive("ok")))
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )

    val map = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableMap
    val level1 = map.getArray("level1") as ReadableArray
    val level2 = level1.getMap(0) as ReadableMap
    val level3 = (level2.getMap("level2") as ReadableMap).getArray("level3") as ReadableArray
    val nested = level3.getMap(1) as ReadableMap

    assertEquals(1, level3.getInt(0))
    assertEquals("ok", nested.getString("value"))
  }

  /**
   * Verifies primitive string values are not coerced into other types.
   */
  @Test
  fun jsonPrimitiveStringDoesNotCoerceTypes() {
    val json = JsonObject(
      mapOf(
        "boolString" to JsonPrimitive("true"),
        "numberString" to JsonPrimitive("123")
      )
    )

    val map = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableMap
    assertEquals(ReadableType.String, map.getType("boolString"))
    assertEquals(ReadableType.String, map.getType("numberString"))
    assertEquals("true", map.getString("boolString"))
    assertEquals("123", map.getString("numberString"))
  }

  /**
   * Verifies large numbers beyond JS safe integer range convert to Double.
   */
  @Test
  fun largeNumbersConvertToDouble() {
    val unsafe = RNPingDeviceProfileCommon.run { JsonPrimitive(9_007_199_254_740_992L).toReactValue() }
    val maxLong = RNPingDeviceProfileCommon.run { JsonPrimitive(Long.MAX_VALUE).toReactValue() }

    assertTrue(unsafe is Double)
    assertTrue(maxLong is Double)
  }

  /**
   * Verifies special characters and Unicode are preserved.
   */
  @Test
  fun unicodeStringsArePreserved() {
    val value = "Ping π 你好"
    val json = JsonObject(mapOf("text" to JsonPrimitive(value)))

    val map = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableMap
    assertEquals(value, map.getString("text"))
  }

  /**
   * Verifies JsonNull within objects maps to ReadableType.Null.
   */
  @Test
  fun jsonNullInObjectMapsToNullType() {
    val json = JsonObject(mapOf("value" to JsonNull))

    val map = RNPingDeviceProfileCommon.run { json.toReactValue() } as ReadableMap
    assertEquals(ReadableType.Null, map.getType("value"))
  }
}
