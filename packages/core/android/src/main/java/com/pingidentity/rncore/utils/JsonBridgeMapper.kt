/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
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
   * Convert a React Native readable map into a JSON object.
   */
  fun decodeReadableMap(value: ReadableMap): JsonObject {
    val output = mutableMapOf<String, JsonElement>()
    val iterator = value.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      output[key] = decodeReadableMapEntry(value, key)
    }
    return JsonObject(output)
  }

  /**
   * Convert a React Native readable array into a JSON array.
   */
  fun decodeReadableArray(value: ReadableArray): JsonArray {
    val items = mutableListOf<JsonElement>()
    for (index in 0 until value.size()) {
      items.add(decodeReadableArrayItem(value, index))
    }
    return JsonArray(items)
  }

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
    }
  }

  /**
   * Convert a JSON primitive into a bridge-friendly scalar type.
   */
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

  /**
   * Read one key from a React Native map as a JSON element.
   */
  private fun decodeReadableMapEntry(map: ReadableMap, key: String): JsonElement {
    if (!map.hasKey(key) || map.isNull(key)) {
      return JsonNull
    }
    return when (map.getType(key)) {
      ReadableType.Null -> JsonNull
      ReadableType.Boolean -> JsonPrimitive(map.getBoolean(key))
      ReadableType.Number -> decodeReadableNumber(map.getDouble(key))
      ReadableType.String -> JsonPrimitive(map.getString(key) ?: "")
      ReadableType.Map -> map.getMap(key)?.let { decodeReadableMap(it) } ?: JsonNull
      ReadableType.Array -> map.getArray(key)?.let { decodeReadableArray(it) }
        ?: JsonArray(emptyList())
    }
  }

  /**
   * Read one index from a React Native array as a JSON element.
   */
  private fun decodeReadableArrayItem(array: ReadableArray, index: Int): JsonElement {
    return when (array.getType(index)) {
      ReadableType.Null -> JsonNull
      ReadableType.Boolean -> JsonPrimitive(array.getBoolean(index))
      ReadableType.Number -> decodeReadableNumber(array.getDouble(index))
      ReadableType.String -> JsonPrimitive(array.getString(index) ?: "")
      ReadableType.Map -> array.getMap(index)?.let { decodeReadableMap(it) } ?: JsonNull
      ReadableType.Array -> array.getArray(index)?.let { decodeReadableArray(it) }
        ?: JsonArray(emptyList())
    }
  }

  /**
   * Converts a bridge double into integral or decimal JSON primitive.
   */
  private fun decodeReadableNumber(number: Double): JsonPrimitive {
    return if (number % 1.0 == 0.0) {
      JsonPrimitive(number.toLong())
    } else {
      JsonPrimitive(number)
    }
  }

  private fun encodeJsonObjectInternal(value: JsonObject): Map<String, Any?> {
    return value.mapValues { (_, element) ->
      encodeJsonElement(element)
    }
  }

  private fun encodeJsonArray(value: JsonArray): List<Any?> {
    return value.map { element -> encodeJsonElement(element) }
  }

  /**
   * Write an encoded JSON value into the provided writable map.
   */
  private fun putJsonValue(map: WritableMap, key: String, element: JsonElement) {
    when (val encoded = encodeJsonElement(element)) {
      null -> map.putNull(key)
      is Boolean -> map.putBoolean(key, encoded)
      is Double -> map.putDouble(key, encoded)
      is Float -> map.putDouble(key, encoded.toDouble())
      is Int -> map.putInt(key, encoded)
      is Long -> map.putDouble(key, encoded.toDouble())
      is String -> map.putString(key, encoded)
      is Map<*, *> -> {
        val mapped = encoded.entries
          .filter { it.key is String }
          .associate { (key, value) -> key as String to value }
        map.putMap(key, toWritableMap(mapped))
      }
      is List<*> -> map.putArray(key, toWritableArray(encoded))
      else -> map.putString(key, encoded.toString())
    }
  }

  private fun toWritableMap(value: Map<String, Any?>): WritableMap {
    val map = Arguments.createMap()
    value.forEach { (key, item) ->
      when (item) {
        null -> map.putNull(key)
        is Boolean -> map.putBoolean(key, item)
        is Double -> map.putDouble(key, item)
        is Float -> map.putDouble(key, item.toDouble())
        is Int -> map.putInt(key, item)
        is Long -> map.putDouble(key, item.toDouble())
        is String -> map.putString(key, item)
        is Map<*, *> -> {
          val nested = item.entries
            .filter { it.key is String }
            .associate { (nestedKey, nestedValue) -> nestedKey as String to nestedValue }
          map.putMap(key, toWritableMap(nested))
        }
        is List<*> -> map.putArray(key, toWritableArray(item))
        else -> map.putString(key, item.toString())
      }
    }
    return map
  }

  private fun toWritableArray(value: List<*>): WritableArray {
    val array = Arguments.createArray()
    value.forEach { item ->
      when (item) {
        null -> array.pushNull()
        is Boolean -> array.pushBoolean(item)
        is Double -> array.pushDouble(item)
        is Float -> array.pushDouble(item.toDouble())
        is Int -> array.pushInt(item)
        is Long -> array.pushDouble(item.toDouble())
        is String -> array.pushString(item)
        is Map<*, *> -> {
          val mapped = item.entries
            .filter { it.key is String }
            .associate { (key, value) -> key as String to value }
          array.pushMap(toWritableMap(mapped))
        }
        is List<*> -> array.pushArray(toWritableArray(item))
        else -> array.pushString(item.toString())
      }
    }
    return array
  }
}
