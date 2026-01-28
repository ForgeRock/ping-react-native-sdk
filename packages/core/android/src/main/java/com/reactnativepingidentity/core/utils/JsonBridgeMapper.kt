/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.utils

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Helpers for converting JSON payloads into React Native bridge maps.
 */
object JsonBridgeMapper {

  /**
   * Convert a JSON object into a React Native readable map.
   */
  fun encodeJsonObject(value: JsonObject): ReadableMap {
    val map = Arguments.createMap()
    value.forEach { (key, element) ->
      putJsonValue(map, key, element)
    }
    return map
  }

  /**
   * Convert a JSON element into a value suitable for the React Native bridge.
   */
  fun encodeJsonElement(element: JsonElement): Any? {
    return when (element) {
      JsonNull -> null
      is JsonPrimitive -> encodeJsonPrimitive(element)
      is JsonObject -> encodeJsonObjectInternal(element)
      is JsonArray -> encodeJsonArray(element)
      else -> null
    }
  }

  private fun encodeJsonPrimitive(value: JsonPrimitive): Any? {
    if (value.isString) {
      return value.content
    }
    val raw = value.content
    raw.toBooleanStrictOrNull()?.let { return it }
    raw.toLongOrNull()?.let { return it }
    raw.toDoubleOrNull()?.let { return it }
    return raw
  }

  private fun encodeJsonObjectInternal(value: JsonObject): WritableMap {
    val map = Arguments.createMap()
    value.forEach { (key, element) ->
      putJsonValue(map, key, element)
    }
    return map
  }

  private fun encodeJsonArray(value: JsonArray): WritableArray {
    val array = Arguments.createArray()
    value.forEach { element ->
      when (val encoded = encodeJsonElement(element)) {
        null -> array.pushNull()
        is Boolean -> array.pushBoolean(encoded)
        is Double -> array.pushDouble(encoded)
        is Float -> array.pushDouble(encoded.toDouble())
        is Int -> array.pushInt(encoded)
        is Long -> array.pushDouble(encoded.toDouble())
        is String -> array.pushString(encoded)
        is WritableMap -> array.pushMap(encoded)
        is WritableArray -> array.pushArray(encoded)
        else -> array.pushString(encoded.toString())
      }
    }
    return array
  }

  private fun putJsonValue(map: WritableMap, key: String, element: JsonElement) {
    when (val encoded = encodeJsonElement(element)) {
      null -> map.putNull(key)
      is Boolean -> map.putBoolean(key, encoded)
      is Double -> map.putDouble(key, encoded)
      is Float -> map.putDouble(key, encoded.toDouble())
      is Int -> map.putInt(key, encoded)
      is Long -> map.putDouble(key, encoded.toDouble())
      is String -> map.putString(key, encoded)
      is WritableMap -> map.putMap(key, encoded)
      is WritableArray -> map.putArray(key, encoded)
      else -> map.putString(key, encoded.toString())
    }
  }
}
