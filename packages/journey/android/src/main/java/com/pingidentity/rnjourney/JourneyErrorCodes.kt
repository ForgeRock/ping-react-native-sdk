/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

/**
 * Stable Journey error code constants surfaced to JavaScript.
 */
internal object JourneyErrorCodes {
    const val CONFIG = "JOURNEY_CONFIG_ERROR"
    const val INIT = "JOURNEY_INIT_ERROR"
    const val START = "JOURNEY_START_ERROR"
    const val NEXT = "JOURNEY_NEXT_ERROR"
    const val RESUME = "JOURNEY_RESUME_ERROR"
    const val USER = "JOURNEY_USER_ERROR"
    const val LOGOUT = "JOURNEY_LOGOUT_ERROR"
    const val DISPOSE = "JOURNEY_DISPOSE_ERROR"
    const val STATE = "JOURNEY_STATE_ERROR"
    const val CALLBACK_APPLY = "JOURNEY_CALLBACK_APPLY_ERROR"
    const val UNSUPPORTED_CALLBACK = "JOURNEY_UNSUPPORTED_CALLBACK_ERROR"
    const val MISSING_INTEGRATION = "JOURNEY_MISSING_INTEGRATION_ERROR"
}
