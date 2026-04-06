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
import com.pingidentity.rncore.utils.JsonBridgeMapper
import io.mockk.every
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
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
 *
 * `JsonBridgeMapper.encodeJsonElement` returns plain Kotlin types:
 * - [JsonObject] → `Map<String, Any?>`
 * - [JsonArray] → `List<Any?>`
 * - primitives → Kotlin scalars
 *
 * Only `encodeJsonObject` returns a [ReadableMap] directly.
 * Tests use these actual return types instead of casting to bridge interfaces.
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
    val stringValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive("ping"))
    val booleanValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(true))
    val intValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(42))
    val doubleValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(3.14))
    val longValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(9_007_199_254_740_992L))

    assertEquals("ping", stringValue)
    assertEquals(true, booleanValue)
    assertEquals(42L, intValue)
    assertEquals(3.14, doubleValue as Double, 0.0)
    assertTrue(longValue is Long)
  }

  /**
   * Verifies nested JSON objects and arrays map correctly to RN types via encodeJsonObject.
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

    val map = JsonBridgeMapper.encodeJsonObject(json)
    val nested = map.getMap("nested") as ReadableMap
    val items = map.getArray("items") as ReadableArray

    assertEquals("device", map.getString("name"))
    assertEquals(true, map.getBoolean("enabled"))
    assertEquals(7.0, map.getDouble("count"), 0.0)
    assertEquals(1.5, map.getDouble("ratio"), 0.0)
    assertEquals("value", nested.getString("key"))
    assertEquals("a", items.getString(0))
    assertEquals(2.0, items.getDouble(1), 0.0)
  }

  /**
   * Verifies arrays convert to plain List with nested Map entries.
   */
  @Test
  @Suppress("UNCHECKED_CAST")
  fun jsonArrayToReactValueBuildsNestedArrays() {
    val json = JsonArray(
      listOf(
        JsonPrimitive("alpha"),
        JsonObject(mapOf("flag" to JsonPrimitive(false)))
      )
    )

    val list = JsonBridgeMapper.encodeJsonElement(json) as List<Any?>

    assertEquals("alpha", list[0])
    val nested = list[1] as Map<String, Any?>
    assertEquals(false, nested["flag"])
  }

  /**
   * Verifies JsonNull converts to null.
   */
  @Test
  fun jsonNullToReactValueReturnsNull() {
    val value = JsonBridgeMapper.encodeJsonElement(JsonNull)
    assertEquals(null, value)
  }

  /**
   * Verifies empty JsonObject converts to an empty ReadableMap and empty JsonArray to empty List.
   */
  @Test
  @Suppress("UNCHECKED_CAST")
  fun emptyJsonContainersConvertToEmptyReactValues() {
    val map = JsonBridgeMapper.encodeJsonObject(JsonObject(emptyMap()))
    val list = JsonBridgeMapper.encodeJsonElement(JsonArray(emptyList())) as List<Any?>

    assertEquals(0, map.toHashMap().size)
    assertEquals(0, list.size)
  }

  /**
   * Verifies deeply nested structures convert correctly to RN types via encodeJsonObject.
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

    val map = JsonBridgeMapper.encodeJsonObject(json)
    val level1 = map.getArray("level1") as ReadableArray

    @Suppress("UNCHECKED_CAST")
    val level1Item = level1.getMap(0) as ReadableMap

    @Suppress("UNCHECKED_CAST")
    val level2 = level1Item.getMap("level2") as ReadableMap

    @Suppress("UNCHECKED_CAST")
    val level3 = level2.getArray("level3") as ReadableArray

    @Suppress("UNCHECKED_CAST")
    val nested = level3.getMap(1) as ReadableMap

    assertEquals(1.0, level3.getDouble(0), 0.0)
    assertEquals("ok", nested.getString("value"))
  }

  /**
   * Verifies primitive string values are not coerced into other types.
   * Uses `encodeJsonObject` to get a [ReadableMap] for type introspection.
   */
  @Test
  fun jsonPrimitiveStringDoesNotCoerceTypes() {
    val json = JsonObject(
      mapOf(
        "boolString" to JsonPrimitive("true"),
        "numberString" to JsonPrimitive("123")
      )
    )

    val map = JsonBridgeMapper.encodeJsonObject(json)
    assertEquals(ReadableType.String, map.getType("boolString"))
    assertEquals(ReadableType.String, map.getType("numberString"))
    assertEquals("true", map.getString("boolString"))
    assertEquals("123", map.getString("numberString"))
  }

  /**
   * Verifies large numbers beyond JS safe integer range convert to Double.
   * Uses `encodeJsonObject` to get a [ReadableMap] for numeric access.
   */
  @Test
  fun largeNumbersConvertToDouble() {
    val json = JsonObject(
      mapOf(
        "unsafe" to JsonPrimitive(9_007_199_254_740_992L),
        "maxLong" to JsonPrimitive(Long.MAX_VALUE)
      )
    )
    val map = JsonBridgeMapper.encodeJsonObject(json)
    val unsafe = map.getDouble("unsafe")
    val maxLong = map.getDouble("maxLong")

    @Suppress("USELESS_IS_CHECK")
    assertTrue(unsafe is Double)
    @Suppress("USELESS_IS_CHECK")
    assertTrue(maxLong is Double)
  }

  /**
   * Verifies special characters and Unicode are preserved.
   */
  @Test
  fun unicodeStringsArePreserved() {
    val value = "Ping π 你好"
    val json = JsonObject(mapOf("text" to JsonPrimitive(value)))

    val map = JsonBridgeMapper.encodeJsonObject(json)
    assertEquals(value, map.getString("text"))
  }

  /**
   * Verifies JsonNull within objects maps to ReadableType.Null.
   * Uses `encodeJsonObject` to get a [ReadableMap] for type introspection.
   */
  @Test
  fun jsonNullInObjectMapsToNullType() {
    val json = JsonObject(mapOf("value" to JsonNull))

    val map = JsonBridgeMapper.encodeJsonObject(json)
    assertEquals(ReadableType.Null, map.getType("value"))
  }

  /**
   * Verifies decodeReadableMap converts nested bridge values to JSON elements.
   */
  @Test
  fun decodeReadableMapConvertsNestedBridgeValues() {
    val nested = JavaOnlyMap().apply { putString("inner", "ok") }
    val values = JavaOnlyArray().apply {
      pushDouble(2.0)
      pushString("three")
      pushBoolean(false)
      pushNull()
    }
    val source = JavaOnlyMap().apply {
      putString("name", "ping")
      putBoolean("enabled", true)
      putDouble("ratio", 1.25)
      putDouble("whole", 7.0)
      putMap("nested", nested)
      putArray("values", values)
      putNull("empty")
    }

    val decoded = JsonBridgeMapper.decodeReadableMap(source)

    assertEquals("ping", decoded["name"]?.jsonPrimitive?.content)
    assertEquals(true, decoded["enabled"]?.jsonPrimitive?.boolean)
    assertEquals(1.25, decoded["ratio"]?.jsonPrimitive?.double ?: 0.0, 0.0)
    assertEquals(7L, decoded["whole"]?.jsonPrimitive?.long)
    assertEquals("ok", decoded["nested"]?.jsonObject?.get("inner")?.jsonPrimitive?.content)

    val decodedValues = decoded["values"]?.jsonArray ?: JsonArray(emptyList())
    assertEquals(2L, decodedValues[0].jsonPrimitive.long)
    assertEquals("three", decodedValues[1].jsonPrimitive.content)
    assertEquals(false, decodedValues[2].jsonPrimitive.boolean)
    assertEquals(JsonNull, decodedValues[3])
    assertEquals(JsonNull, decoded["empty"])
  }

  /**
   * Verifies decodeReadableArray handles primitive and nested bridge values.
   */
  @Test
  fun decodeReadableArrayConvertsBridgeValues() {
    val source = JavaOnlyArray().apply {
      pushDouble(9.0)
      pushDouble(9.5)
      pushString("value")
      pushMap(JavaOnlyMap().apply { putString("k", "v") })
      pushArray(JavaOnlyArray().apply { pushInt(1) })
      pushNull()
    }

    val decoded = JsonBridgeMapper.decodeReadableArray(source)

    assertEquals(9L, decoded[0].jsonPrimitive.long)
    assertEquals(9.5, decoded[1].jsonPrimitive.double, 0.0)
    assertEquals("value", decoded[2].jsonPrimitive.content)
    assertEquals("v", decoded[3].jsonObject["k"]?.jsonPrimitive?.content)
    assertEquals(1L, decoded[4].jsonArray[0].jsonPrimitive.long)
    assertEquals(JsonNull, decoded[5])
  }
}
