/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

/**
 * Typed reader over one level of a bridge option map.
 *
 * Every mismatch is reported through [warn] before the caller applies its fallback.
 * Warnings carry only the option path, the JS value type and, for strings, the length;
 * values are never included.
 *
 * @property source Bridge map being read.
 * @property path Dotted path of [source] used in warnings; empty for the root map.
 * @property warn Sink invoked once per mismatch.
 */
internal class FidoOptionReader(
  private val source: ReadableMap,
  private val path: String,
  private val warn: (String) -> Unit
) {

  /**
   * Reads a string option.
   *
   * @param key Option key.
   * @return The string, or null when absent or not a string (a warning is emitted for the latter).
   */
  fun string(key: String): String? {
    if (!source.hasKey(key)) {
      return null
    }
    if (source.getType(key) != ReadableType.String) {
      warnWrongType(key, "a String")
      return null
    }
    return source.getString(key)
  }

  /**
   * Reads a boolean option.
   *
   * @param key Option key.
   * @return The boolean, or null when absent or not a boolean (a warning is emitted for the latter).
   */
  fun boolean(key: String): Boolean? {
    if (!source.hasKey(key)) {
      return null
    }
    if (source.getType(key) != ReadableType.Boolean) {
      warnWrongType(key, "a Boolean")
      return null
    }
    return source.getBoolean(key)
  }

  /**
   * Reads a numeric option.
   *
   * @param key Option key.
   * @return The number, or null when absent or not a number (a warning is emitted for the latter).
   */
  fun number(key: String): Double? {
    if (!source.hasKey(key)) {
      return null
    }
    if (source.getType(key) != ReadableType.Number) {
      warnWrongType(key, "a Number")
      return null
    }
    return source.getDouble(key)
  }

  /**
   * Reads an array of strings.
   *
   * @param key Option key.
   * @return The string entries, or null when absent or not an array (a warning is emitted for
   *   the latter). Entries that are not strings are reported with their index and type and
   *   skipped.
   */
  fun stringList(key: String): List<String>? {
    if (!source.hasKey(key)) {
      return null
    }
    if (source.getType(key) != ReadableType.Array) {
      warnWrongType(key, "an Array")
      return null
    }
    val array = source.getArray(key) ?: return null
    return buildList {
      for (index in 0 until array.size()) {
        if (array.getType(index) == ReadableType.String) {
          array.getString(index)?.let { add(it) }
        } else {
          warnEntry(key, index, array.getType(index), "a String is expected and the entry is ignored")
        }
      }
    }
  }

  /**
   * Reads an object option.
   *
   * @param key Option key.
   * @return The map, or null when absent or not an object (a warning is emitted for the latter).
   */
  fun map(key: String): ReadableMap? {
    if (!source.hasKey(key)) {
      return null
    }
    if (source.getType(key) != ReadableType.Map) {
      warnWrongType(key, "an Object")
      return null
    }
    return source.getMap(key)
  }

  /**
   * Returns a reader for the nested object at [key].
   *
   * @param key Option key.
   * @return Reader scoped to the nested map, or null when absent or not an object.
   */
  fun child(key: String): FidoOptionReader? {
    return map(key)?.let { FidoOptionReader(it, qualify(key), warn) }
  }

  /**
   * Reports a key that is understood but not applicable to the current call.
   *
   * @param key Option key; nothing is reported when it is absent.
   * @param consequence Explanation of what happens instead.
   */
  fun warnIfPresent(key: String, consequence: String) {
    if (source.hasKey(key)) {
      warnOption(key, consequence)
    }
  }

  /**
   * Reports every key outside [known].
   *
   * @param known Keys the current call understands.
   */
  fun warnUnknownKeys(known: Set<String>) {
    val iterator = source.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      if (key !in known) {
        warnOption(key, "this key is not recognized and is ignored")
      }
    }
  }

  private fun warnEntry(key: String, index: Int, type: ReadableType, consequence: String) {
    warn("FIDO config key '${qualify(key)}[$index]' received ${describeType(type)}; $consequence")
  }

  private fun warnWrongType(key: String, expected: String) {
    warnOption(key, "$expected is expected and the option is ignored")
  }

  private fun warnOption(key: String, consequence: String) {
    val described = buildString {
      append(describeType(source.getType(key)))
      if (source.getType(key) == ReadableType.String) {
        append(" of length ${source.getString(key)?.length ?: 0}")
      }
    }
    warn("FIDO config key '${qualify(key)}' received $described; $consequence")
  }

  private fun qualify(key: String): String {
    return if (path.isEmpty()) key else "$path.$key"
  }

  private fun describeType(type: ReadableType): String {
    return when (type) {
      ReadableType.String -> "a String"
      ReadableType.Boolean -> "a Boolean"
      ReadableType.Number -> "a Number"
      ReadableType.Map -> "an Object"
      ReadableType.Array -> "an Array"
      ReadableType.Null -> "null"
    }
  }
}
