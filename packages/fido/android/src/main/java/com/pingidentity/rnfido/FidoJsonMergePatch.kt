/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * JSON merge patch (RFC 7396) restricted to object patches.
 *
 * Nested objects merge, arrays and primitives replace, and a `null` patch value deletes
 * the key.
 */
internal object FidoJsonMergePatch {

  /**
   * Applies [patch] to a JSON document given as text.
   *
   * @param target JSON text to patch.
   * @param patch Merge patch object.
   * @return The patched document as text.
   * @throws IllegalArgumentException when [target] is not a JSON object.
   */
  fun applyToText(target: String, patch: JsonObject): String {
    return apply(Json.parseToJsonElement(target).jsonObject, patch).toString()
  }

  /**
   * Applies [patch] to [target] without mutating either argument.
   *
   * @param target Document to patch.
   * @param patch Merge patch object.
   * @return The patched document.
   */
  fun apply(target: JsonObject, patch: JsonObject): JsonObject {
    val result = target.toMutableMap()
    patch.forEach { (key, value) ->
      when (value) {
        is JsonNull -> result.remove(key)
        is JsonObject -> result[key] = apply(result[key] as? JsonObject ?: JsonObject(emptyMap()), value)
        else -> result[key] = value
      }
    }
    return JsonObject(result)
  }
}
