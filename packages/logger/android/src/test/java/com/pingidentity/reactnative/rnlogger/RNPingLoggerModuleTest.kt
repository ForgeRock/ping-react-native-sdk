/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnlogger

import org.junit.Assert.assertEquals
import org.junit.Test

class RNPingLoggerModuleTest {

  @Test
  fun moduleNameIsCorrect() {
    assertEquals("Logger", RNPingLoggerModule.NAME)
  }

  @Test
  fun constantNameMatchesModuleName() {
    assertEquals("Logger", RNPingLoggerModule.NAME)
  }
}
