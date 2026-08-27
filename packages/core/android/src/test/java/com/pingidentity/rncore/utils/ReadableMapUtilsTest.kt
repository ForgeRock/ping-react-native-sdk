/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.Assert.assertThrows

/** Tests boolean value reads from React Native readable maps. */
class ReadableMapUtilsTest {

  /** Verifies missing and null keys return null. */
  @Test
  fun readBoolean_returnsNullWhenKeyIsMissingOrNull() {
    assertNull(readBoolean(JavaOnlyMap(), "par"))
    assertNull(readBoolean(JavaOnlyMap().apply { putNull("par") }, "par"))
  }

  /** Verifies explicit boolean values are preserved. */
  @Test
  fun readBoolean_preservesExplicitBooleanValues() {
    assertEquals(true, readBoolean(JavaOnlyMap().apply { putBoolean("par", true) }, "par"))
    assertEquals(false, readBoolean(JavaOnlyMap().apply { putBoolean("par", false) }, "par"))
  }

  /** Verifies non-boolean values are rejected. */
  @Test
  fun readBoolean_rejectsNonBooleanValues() {
    val map = JavaOnlyMap().apply { putString("par", "true") }

    assertThrows(IllegalArgumentException::class.java) {
      readBoolean(map, "par")
    }
  }
}
