/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for Journey error mapper behavior.
 */
class JourneyErrorMapperTest {

    @Test
    fun mapArgumentExceptionUsesArgumentErrorType() {
        val result = JourneyErrorMapper.map(
            IllegalArgumentException("bad arg"),
            JourneyErrorCodes.CONFIG
        )

        assertEquals("argument_error", result.type.rawValue)
        assertEquals(JourneyErrorCodes.CONFIG, result.error)
        assertEquals("bad arg", result.message)
    }

    @Test
    fun mapStateExceptionUsesStateErrorType() {
        val result = JourneyErrorMapper.map(
            IllegalStateException("bad state"),
            JourneyErrorCodes.STATE
        )

        assertEquals("state_error", result.type.rawValue)
        assertEquals(JourneyErrorCodes.STATE, result.error)
        assertEquals("bad state", result.message)
    }

    @Test
    fun stateHelperBuildsStateError() {
        val result = JourneyErrorMapper.state(JourneyErrorCodes.NEXT, "No active node")

        assertEquals("state_error", result.type.rawValue)
        assertEquals(JourneyErrorCodes.NEXT, result.error)
        assertEquals("No active node", result.message)
    }
}
