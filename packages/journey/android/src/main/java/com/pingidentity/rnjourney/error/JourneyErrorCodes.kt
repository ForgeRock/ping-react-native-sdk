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
    /** Configuration payload validation failure. */
    const val CONFIG = "JOURNEY_CONFIG_ERROR"
    /** Native workflow construction failure. */
    const val INIT = "JOURNEY_INIT_ERROR"
    /** Journey start execution failure. */
    const val START = "JOURNEY_START_ERROR"
    /** Continue node progression failure. */
    const val NEXT = "JOURNEY_NEXT_ERROR"
    /** Suspended journey resume failure. */
    const val RESUME = "JOURNEY_RESUME_ERROR"
    /** Session/user retrieval failure. */
    const val USER = "JOURNEY_USER_ERROR"
    /** Logout execution failure. */
    const val LOGOUT = "JOURNEY_LOGOUT_ERROR"
    /** Client disposal failure. */
    const val DISPOSE = "JOURNEY_DISPOSE_ERROR"
    /** Missing or invalid runtime state. */
    const val STATE = "JOURNEY_STATE_ERROR"
    /** Callback mutation payload validation/apply failure. */
    const val CALLBACK_APPLY = "JOURNEY_CALLBACK_APPLY_ERROR"
    /** Unsupported callback mutation request. */
    const val UNSUPPORTED_CALLBACK = "JOURNEY_UNSUPPORTED_CALLBACK_ERROR"
    /** Callback requires additional module integration. */
    const val MISSING_INTEGRATION = "JOURNEY_MISSING_INTEGRATION_ERROR"
}
