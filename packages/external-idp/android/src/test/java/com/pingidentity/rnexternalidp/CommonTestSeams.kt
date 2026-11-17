/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import kotlinx.coroutines.CoroutineScope

/**
 * Reflective test seams over RNPingExternalIdpCommon's private lifecycle state.
 *
 * Both test classes in this package share these; each file keeps only its
 * single-use reflective helpers inline.
 */
internal object CommonTestSeams {

  /**
   * Reflectively reads the private shared coroutine scope.
   */
  fun readScope(): CoroutineScope {
    val field = RNPingExternalIdpCommon::class.java.getDeclaredField("scope")
    field.isAccessible = true
    return field.get(RNPingExternalIdpCommon) as CoroutineScope
  }

  /**
   * Reflectively reads the private configured flag.
   */
  fun readConfigured(): Boolean {
    val field = RNPingExternalIdpCommon::class.java.getDeclaredField("configured")
    field.isAccessible = true
    return field.getBoolean(RNPingExternalIdpCommon)
  }

  /**
   * Reflectively sets the private configured flag.
   */
  fun setConfigured(value: Boolean) {
    val field = RNPingExternalIdpCommon::class.java.getDeclaredField("configured")
    field.isAccessible = true
    field.setBoolean(RNPingExternalIdpCommon, value)
  }

  /**
   * Reflectively flips the private configured flag and invokes cleanup so the test
   * does not need to call configure() (which requires a ReactApplicationContext).
   */
  fun invokeCleanup() {
    setConfigured(true)
    RNPingExternalIdpCommon.cleanup()
  }
}
