/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the rejection extras built from a DaVinci FIDO collector's
 * recorded client error code.
 */
class FidoClientErrorMapperTest {

    /**
     * Ensures each known WebAuthn DOMException name is forwarded as the clientError
     * extra without triggering the warning path.
     */
    @Test
    fun extrasContainsClientErrorForEachKnownName() {
        listOf(
            "NotAllowedError",
            "TimeoutError",
            "NotSupportedError",
            "InvalidStateError",
            "UnknownError",
        ).forEach { name ->
            val warnings = mutableListOf<String>()

            val extras = FidoClientErrorMapper.extras(name) { warnings.add(it) }

            assertEquals(mapOf(FidoClientErrorMapper.EXTRA_CLIENT_ERROR to name), extras)
            assertTrue(warnings.isEmpty())
        }
    }

    /**
     * Ensures unknown DOMException names pass through unchanged: the Android error
     * set is open, so the bridge must not drop unrecognized names.
     */
    @Test
    fun extrasPassesThroughUnknownDomName() {
        val warnings = mutableListOf<String>()

        val extras = FidoClientErrorMapper.extras("SecurityError") { warnings.add(it) }

        assertEquals(mapOf(FidoClientErrorMapper.EXTRA_CLIENT_ERROR to "SecurityError"), extras)
        assertTrue(warnings.isEmpty())
    }

    /**
     * Ensures a null error code produces no extras and emits exactly one warning
     * naming the dropped extra.
     */
    @Test
    fun extrasWarnsAndReturnsEmptyWhenErrorCodeNull() {
        val warnings = mutableListOf<String>()

        val extras = FidoClientErrorMapper.extras(null) { warnings.add(it) }

        assertTrue(extras.isEmpty())
        assertEquals(1, warnings.size)
    }

    /**
     * Ensures a blank error code behaves like a null one: no extras, one warning.
     */
    @Test
    fun extrasWarnsAndReturnsEmptyWhenErrorCodeBlank() {
        val warnings = mutableListOf<String>()

        val extras = FidoClientErrorMapper.extras("   ") { warnings.add(it) }

        assertTrue(extras.isEmpty())
        assertEquals(1, warnings.size)
    }
}
