/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.error

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for DaVinci error mapper behavior.
 */
class DaVinciErrorMapperTest {

    @Test
    fun mapArgumentExceptionUsesArgumentErrorType() {
        val result = DaVinciErrorMapper.map(
            IllegalArgumentException("bad arg"),
            DaVinciErrorCodes.CONFIG
        )

        assertEquals("argument_error", result.type.rawValue)
        assertEquals(DaVinciErrorCodes.CONFIG, result.error)
        assertEquals("bad arg", result.message)
    }

    @Test
    fun mapStateExceptionUsesStateErrorType() {
        val result = DaVinciErrorMapper.map(
            IllegalStateException("bad state"),
            DaVinciErrorCodes.STATE
        )

        assertEquals("state_error", result.type.rawValue)
        assertEquals(DaVinciErrorCodes.STATE, result.error)
        assertEquals("bad state", result.message)
    }

    @Test
    fun mapUnknownExceptionMapsToUnknownCode() {
        val result = DaVinciErrorMapper.map(
            RuntimeException("unexpected"),
            DaVinciErrorCodes.UNKNOWN
        )

        assertEquals(DaVinciErrorCodes.UNKNOWN, result.error)
        assertEquals("unexpected", result.message)
    }

    @Test
    fun mapNullThrowableProducesErrorWithoutMessage() {
        val result = DaVinciErrorMapper.map(null, DaVinciErrorCodes.UNKNOWN)

        assertEquals(DaVinciErrorCodes.UNKNOWN, result.error)
    }

    @Test
    fun stateHelperBuildsStateError() {
        val result = DaVinciErrorMapper.state(DaVinciErrorCodes.STATE, "No active node")

        assertEquals("state_error", result.type.rawValue)
        assertEquals(DaVinciErrorCodes.STATE, result.error)
        assertEquals("No active node", result.message)
    }

    @Test
    fun argumentHelperBuildsArgumentError() {
        val result = DaVinciErrorMapper.argument(DaVinciErrorCodes.ARGUMENT, "Invalid input")

        assertEquals("argument_error", result.type.rawValue)
        assertEquals(DaVinciErrorCodes.ARGUMENT, result.error)
        assertEquals("Invalid input", result.message)
    }
}
