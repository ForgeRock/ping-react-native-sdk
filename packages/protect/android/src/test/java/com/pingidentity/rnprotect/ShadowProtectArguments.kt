/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

/**
 * Robolectric shadow for React Native bridge map creation.
 */
@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowProtectArguments {
  /**
   * Creates a Java-only writable map for JVM unit tests.
   */
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  /**
   * Creates a Java-only writable array for JVM unit tests.
   */
  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = com.facebook.react.bridge.JavaOnlyArray()
}
