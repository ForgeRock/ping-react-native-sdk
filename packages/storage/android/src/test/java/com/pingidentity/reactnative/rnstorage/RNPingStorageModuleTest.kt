/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnstorage

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class RNPingStorageModuleTest {

    @Test
    fun moduleNameIsCorrect() {
        assertEquals("RNPingStorage", RNPingStorageModule.NAME)
    }

    @Test
    fun constantNameMatchesModuleName() {
        assertEquals("RNPingStorage", RNPingStorageModule.NAME)
    }
}
