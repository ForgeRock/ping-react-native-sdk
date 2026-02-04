/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * TODO: revisit when utils are added to core module
 * Converts a JsonElement into a React Native bridge-compatible value.
 *
 * Recursively converts JSON structures into WritableMap, WritableArray, or primitive values
 * that can be passed through the React Native bridge.
 *
 * @return The converted value suitable for the React Native bridge, or null for JsonNull.
 */
internal fun JsonElement.toReactValue(): Any? = when (this) {
  is JsonObject -> toWritableMap()
  is JsonArray -> toWritableArray()
  is JsonNull -> null
  is JsonPrimitive -> toPrimitiveValue()
}

/**
 * Converts a JsonObject into a WritableMap for React Native.
 *
 * Recursively processes all key-value pairs, converting nested objects and arrays
 * into their corresponding WritableMap and WritableArray types.
 *
 * @return A WritableMap containing the converted JSON object data.
 */
internal fun JsonObject.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  forEach { (key, value) ->
    when (value) {
      is JsonObject -> map.putMap(key, value.toWritableMap())
      is JsonArray -> map.putArray(key, value.toWritableArray())
      is JsonNull -> map.putNull(key)
      is JsonPrimitive -> map.putPrimitiveValue(key, value)
    }
  }
  return map
}

/**
 * Converts a JsonArray into a WritableArray for React Native.
 *
 * Recursively processes all elements, converting nested objects and arrays
 * into their corresponding WritableMap and WritableArray types.
 *
 * @return A WritableArray containing the converted JSON array data.
 */
internal fun JsonArray.toWritableArray(): WritableArray {
  val array = Arguments.createArray()
  forEach { value ->
    when (value) {
      is JsonObject -> array.pushMap(value.toWritableMap())
      is JsonArray -> array.pushArray(value.toWritableArray())
      is JsonNull -> array.pushNull()
      is JsonPrimitive -> array.pushPrimitiveValue(value)
    }
  }
  return array
}

/**
 * Puts a JsonPrimitive value into a WritableMap using the appropriate native type.
 *
 * Automatically determines the primitive type (Boolean, Int, Double, String, or null)
 * and uses the corresponding WritableMap method.
 *
 * @param key The key for the map entry.
 * @param value The JsonPrimitive value to insert.
 */
internal fun WritableMap.putPrimitiveValue(key: String, value: JsonPrimitive) {
  when (val primitiveValue = value.toPrimitiveValue()) {
    null -> putNull(key)
    is Boolean -> putBoolean(key, primitiveValue)
    is Int -> putInt(key, primitiveValue)
    is Double -> putDouble(key, primitiveValue)
    is String -> putString(key, primitiveValue)
    else -> putString(key, primitiveValue.toString())
  }
}

/**
 * Pushes a JsonPrimitive value into a WritableArray using the appropriate native type.
 *
 * Automatically determines the primitive type (Boolean, Int, Double, String, or null)
 * and uses the corresponding WritableArray method.
 *
 * @param value The JsonPrimitive value to push.
 */
internal fun WritableArray.pushPrimitiveValue(value: JsonPrimitive) {
  when (val primitiveValue = value.toPrimitiveValue()) {
    null -> pushNull()
    is Boolean -> pushBoolean(primitiveValue)
    is Int -> pushInt(primitiveValue)
    is Double -> pushDouble(primitiveValue)
    is String -> pushString(primitiveValue)
    else -> pushString(primitiveValue.toString())
  }
}

/**
 * Converts a JsonPrimitive into a Kotlin value suitable for the React Native bridge.
 *
 * @return The converted primitive value (Boolean, Int, Double, String), or null for null values.
 */
internal fun JsonPrimitive.toPrimitiveValue(): Any? {
  if (isString) {
    return content
  }

  content.toBooleanStrictOrNull()?.let { return it }

  content.toLongOrNull()?.let { longValue ->
    return if (longValue in Int.MIN_VALUE..Int.MAX_VALUE) {
      longValue.toInt()
    } else {
      longValue.toDouble()
    }
  }

  content.toDoubleOrNull()?.let { return it }

  return content
}
