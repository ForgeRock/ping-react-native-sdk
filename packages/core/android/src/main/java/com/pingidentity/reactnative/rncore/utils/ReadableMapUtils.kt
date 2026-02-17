/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.utils

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

/**
 * Read a required string value from a React Native map.
 *
 * @throws IllegalArgumentException when the key is missing or empty.
 */
fun requireString(map: ReadableMap, key: String): String {
  val value = if (map.hasKey(key)) map.getString(key) else null
  if (value.isNullOrBlank()) {
    throw IllegalArgumentException("Missing required parameter: $key")
  }
  return value
}

/**
 * Read a required array of strings from a React Native map.
 *
 * @throws IllegalArgumentException when the key is missing or the array is empty.
 */
fun requireStringArray(map: ReadableMap, key: String): List<String> {
  val array = if (map.hasKey(key)) map.getArray(key) else null
  val values = readStringArray(array)
  if (values.isEmpty()) {
    throw IllegalArgumentException("Missing required parameter: $key")
  }
  return values
}

/**
 * Convert a ReadableArray into a list of strings, ignoring nulls.
 */
fun readStringArray(array: ReadableArray?): List<String> {
  if (array == null) {
    return emptyList()
  }
  val list = mutableListOf<String>()
  for (index in 0 until array.size()) {
    array.getString(index)?.let { list.add(it) }
  }
  return list
}

/**
 * Convert a ReadableMap of string values into a Kotlin map.
 */
fun readStringMap(map: ReadableMap?): Map<String, String> {
  if (map == null) {
    return emptyMap()
  }
  val result = mutableMapOf<String, String>()
  val iterator = map.keySetIterator()
  while (iterator.hasNextKey()) {
    val key = iterator.nextKey()
    map.getString(key)?.let { result[key] = it }
  }
  return result
}
