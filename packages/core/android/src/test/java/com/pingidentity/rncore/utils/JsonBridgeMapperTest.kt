/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Tests for JSON <-> React Native bridge mapping helpers.
 */
class JsonBridgeMapperTest {

  @Test
  fun decodeReadableMapConvertsNestedStructure() {
    val nestedMap = JavaOnlyMap().apply {
      putString("inner", "value")
    }
    val nestedArray = JavaOnlyArray().apply {
      pushDouble(1.0)
      pushString("two")
      pushNull()
      pushBoolean(true)
      pushMap(JavaOnlyMap().apply { putInt("count", 3) })
    }
    val source = JavaOnlyMap().apply {
      putString("name", "ping")
      putBoolean("enabled", true)
      putInt("attempts", 42)
      putDouble("ratio", 3.14)
      putNull("empty")
      putMap("nested", nestedMap)
      putArray("items", nestedArray)
    }

    val result = JsonBridgeMapper.decodeReadableMap(source)

    assertEquals("ping", result["name"]?.jsonPrimitive?.content)
    assertTrue(result["enabled"]?.jsonPrimitive?.boolean == true)
    assertEquals(42L, result["attempts"]?.jsonPrimitive?.long)
    assertEquals(3.14, result["ratio"]?.jsonPrimitive?.double ?: 0.0, 0.0)
    assertTrue(result["empty"] === JsonNull)
    assertEquals(
      "value",
      result["nested"]?.jsonObject?.get("inner")?.jsonPrimitive?.content
    )

    val items = result["items"]?.jsonArray ?: JsonArray(emptyList())
    assertEquals(1L, items[0].jsonPrimitive.long)
    assertEquals("two", items[1].jsonPrimitive.content)
    assertTrue(items[2] === JsonNull)
    assertTrue(items[3].jsonPrimitive.boolean)
    assertEquals(3L, items[4].jsonObject["count"]?.jsonPrimitive?.long)
  }

  @Test
  fun decodeReadableArrayConvertsWholeAndDecimalNumbers() {
    val source = JavaOnlyArray().apply {
      pushDouble(7.0)
      pushDouble(7.25)
    }

    val result = JsonBridgeMapper.decodeReadableArray(source)

    assertEquals(7L, result[0].jsonPrimitive.long)
    assertEquals(7.25, result[1].jsonPrimitive.double, 0.0)
  }

  @Test
  fun decodeReadableMapTreatsMissingOrNullAsJsonNull() {
    val source = JavaOnlyMap().apply {
      putNull("nullable")
      putMap("child", null)
      putArray("values", null)
    }

    val result = JsonBridgeMapper.decodeReadableMap(source)

    assertTrue(result["nullable"] === JsonNull)
    assertTrue(result["child"] === JsonNull)
    assertTrue(result["values"] === JsonNull)
  }

  @Test
  fun encodeJsonElementConvertsPrimitiveTypes() {
    val stringValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive("ping"))
    val booleanValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(true))
    val wholeNumberValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(42))
    val decimalValue = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(4.25))
    val nullValue = JsonBridgeMapper.encodeJsonElement(JsonNull)

    assertEquals("ping", stringValue)
    assertEquals(true, booleanValue)
    assertEquals(42L, wholeNumberValue)
    assertEquals(4.25, decimalValue as Double, 0.0)
    assertNull(nullValue)
  }

  @Test
  @Suppress("UNCHECKED_CAST")
  fun encodeJsonElementConvertsObjectsWithNestedValues() {
    val source = JsonObject(
      mapOf(
        "name" to JsonPrimitive("android"),
        "flag" to JsonPrimitive(true),
        "whole" to JsonPrimitive(9),
        "decimal" to JsonPrimitive(9.5),
        "nullable" to JsonNull,
        "nested" to JsonObject(
          mapOf("inner" to JsonPrimitive("value"))
        ),
        "items" to JsonArray(
          listOf(
            JsonPrimitive("a"),
            JsonPrimitive(3),
            JsonObject(mapOf("count" to JsonPrimitive(2)))
          )
        )
      )
    )

    val map = JsonBridgeMapper.encodeJsonElement(source) as Map<String, Any?>
    val nested = map["nested"] as Map<String, Any?>
    val items = map["items"] as List<Any?>

    assertEquals("android", map["name"])
    assertEquals(true, map["flag"])
    assertEquals(9L, map["whole"])
    assertEquals(9.5, map["decimal"] as Double, 0.0)
    assertNull(map["nullable"])
    assertEquals("value", nested["inner"])
    assertEquals("a", items[0])
    assertEquals(3L, items[1])
    assertEquals(mapOf("count" to 2L), items[2])
  }

  @Test
  @Suppress("UNCHECKED_CAST")
  fun encodeJsonElementConvertsObjectAndArrayToKotlinContainers() {
    val jsonObject = JsonObject(
      mapOf(
        "key" to JsonPrimitive("value"),
        "list" to JsonArray(listOf(JsonPrimitive(1), JsonPrimitive(false)))
      )
    )
    val jsonArray = JsonArray(
      listOf(
        JsonPrimitive("alpha"),
        JsonObject(mapOf("k" to JsonPrimitive("v")))
      )
    )

    val encodedObject = JsonBridgeMapper.encodeJsonElement(jsonObject) as Map<String, Any?>
    val encodedArray = JsonBridgeMapper.encodeJsonElement(jsonArray) as List<Any?>

    assertEquals("value", encodedObject["key"])
    assertEquals(listOf(1L, false), encodedObject["list"])
    assertEquals("alpha", encodedArray[0])
    assertEquals(mapOf("k" to "v"), encodedArray[1])
  }

  @Test
  fun encodeJsonElementPreservesStringPrimitivesWithoutCoercion() {
    val trueString = JsonBridgeMapper.encodeJsonElement(JsonPrimitive("true"))
    val numberString = JsonBridgeMapper.encodeJsonElement(JsonPrimitive("123"))

    assertEquals("true", trueString)
    assertEquals("123", numberString)
  }

  @Test
  fun encodeJsonElementConvertsLongValuesWithoutNarrowing() {
    val value = JsonBridgeMapper.encodeJsonElement(JsonPrimitive(9_007_199_254_740_992L))

    assertEquals(9_007_199_254_740_992L, value)
  }
}
