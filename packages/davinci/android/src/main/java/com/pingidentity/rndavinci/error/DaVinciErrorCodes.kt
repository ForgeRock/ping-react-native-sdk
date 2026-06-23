/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.error

/**
 * Stable DaVinci error code constants surfaced to JavaScript.
 */
internal object DaVinciErrorCodes {
    /** Configuration payload validation failure. */
    const val CONFIG = "DAVINCI_CONFIG_ERROR"
    /** Native workflow construction failure. */
    const val INIT = "DAVINCI_INIT_ERROR"
    /** Flow start execution failure. */
    const val START = "DAVINCI_START_ERROR"
    /** Flow progression failure. */
    const val NEXT = "DAVINCI_NEXT_ERROR"
    /** Collector value application failure. */
    const val COLLECTOR_APPLY = "DAVINCI_COLLECTOR_APPLY_ERROR"
    /** Unsupported collector mutation request. */
    const val UNSUPPORTED_COLLECTOR = "DAVINCI_UNSUPPORTED_COLLECTOR_ERROR"
    /** Session/user retrieval failure. */
    const val SESSION = "DAVINCI_SESSION_ERROR"
    /** Logout execution failure. */
    const val LOGOUT = "DAVINCI_LOGOUT_ERROR"
    /** Client disposal failure. */
    const val DISPOSE = "DAVINCI_DISPOSE_ERROR"
    /** JS guardrails: invalid argument at call site. */
    const val ARGUMENT = "DAVINCI_ARGUMENT_ERROR"
    /** Operation on invalid state (e.g. no active node). */
    const val STATE = "DAVINCI_STATE_ERROR"
    /** Collector requires additional module integration. */
    const val MISSING_INTEGRATION = "DAVINCI_MISSING_INTEGRATION_ERROR"
    /** Catch-all for unclassified failures. */
    const val UNKNOWN = "DAVINCI_UNKNOWN_ERROR"
}
