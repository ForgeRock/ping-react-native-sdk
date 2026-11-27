/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * Unit tests for the JSON merge patch used to edit the create request JSON.
 */
class FidoJsonMergePatchTest {

  private fun obj(json: String): JsonObject = Json.parseToJsonElement(json) as JsonObject

  /**
   * Ensures nested objects merge instead of being replaced.
   */
  @Test
  fun nestedObjectsMerge() {
    val result = FidoJsonMergePatch.apply(
      obj("""{"rp":{"id":"a","name":"A"},"x":1}"""),
      obj("""{"rp":{"name":"B"}}""")
    )

    assertEquals(obj("""{"rp":{"id":"a","name":"B"},"x":1}"""), result)
  }

  /**
   * Ensures arrays are replaced wholesale.
   */
  @Test
  fun arraysReplace() {
    val result = FidoJsonMergePatch.apply(obj("""{"a":[1,2,3]}"""), obj("""{"a":[9]}"""))

    assertEquals(obj("""{"a":[9]}"""), result)
  }

  /**
   * Ensures a null patch value deletes the key, including inside nested objects.
   */
  @Test
  fun nullDeletesKeys() {
    val result = FidoJsonMergePatch.apply(
      obj("""{"a":1,"b":{"c":2,"d":3}}"""),
      obj("""{"a":null,"b":{"c":null}}""")
    )

    assertEquals(obj("""{"b":{"d":3}}"""), result)
  }

  /**
   * Ensures nulls inside a patch object with no matching target object are not materialised.
   */
  @Test
  fun nullsInsideNewObjectsAreDropped() {
    val result = FidoJsonMergePatch.apply(obj("""{"a":1}"""), obj("""{"b":{"c":null,"d":1}}"""))

    assertEquals(obj("""{"a":1,"b":{"d":1}}"""), result)
  }

  /**
   * Ensures a primitive target is replaced by an object patch value.
   */
  @Test
  fun objectPatchReplacesPrimitiveTarget() {
    val result = FidoJsonMergePatch.apply(obj("""{"a":1}"""), obj("""{"a":{"b":2}}"""))

    assertEquals(obj("""{"a":{"b":2}}"""), result)
  }

  /**
   * Ensures neither argument is mutated.
   */
  @Test
  fun doesNotMutateArguments() {
    val target = obj("""{"a":{"b":1}}""")
    val patch = obj("""{"a":{"b":null,"c":2}}""")

    FidoJsonMergePatch.apply(target, patch)

    assertEquals(obj("""{"a":{"b":1}}"""), target)
    assertEquals(obj("""{"a":{"b":null,"c":2}}"""), patch)
  }

  /**
   * Ensures patching JSON text returns the patched text and rejects text that is not an object.
   */
  @Test
  fun applyToTextPatchesObjectsAndRejectsOthers() {
    assertEquals(obj("""{"a":1,"b":2}"""), Json.parseToJsonElement(requireNotNull(FidoJsonMergePatch.applyToText("""{"a":1}""", obj("""{"b":2}""")))))
    assertThrows(IllegalArgumentException::class.java) {
      FidoJsonMergePatch.applyToText("[]", obj("""{"b":2}"""))
    }
  }
}
