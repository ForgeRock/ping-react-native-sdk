/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Promise
import io.mockk.mockk
import io.mockk.verify
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for the TurboModule entry point of the Protect bridge.
 *
 * Only the new-architecture module is referenced: the Gradle source sets include one
 * architecture variant at a time, so the classic module is absent from the test compile
 * classpath under the default build. It mirrors the same behavior one-to-one.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingProtectModuleTest {

  /**
   * Ensures registerJourneyCallbacks resolves with null without touching the Protect SDK,
   * because the native Android SDK registers its Journey callbacks at app launch.
   */
  @Test
  fun registerJourneyCallbacksResolvesNull() {
    val promise = mockk<Promise>(relaxed = true)

    RNPingProtectModule(mockk(relaxed = true)).registerJourneyCallbacks(promise)

    verify(exactly = 1) { promise.resolve(null) }
  }

  /**
   * Ensures repeated registration calls each resolve, keeping the method idempotent.
   */
  @Test
  fun registerJourneyCallbacksIsIdempotent() {
    val promise = mockk<Promise>(relaxed = true)
    val module = RNPingProtectModule(mockk(relaxed = true))

    module.registerJourneyCallbacks(promise)
    module.registerJourneyCallbacks(promise)

    verify(exactly = 2) { promise.resolve(null) }
  }
}
