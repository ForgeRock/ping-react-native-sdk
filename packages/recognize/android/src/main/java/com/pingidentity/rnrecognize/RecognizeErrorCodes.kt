/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecognize

/**
 * Bridge-level error codes surfaced to JavaScript on the rejection path.
 */
internal object RecognizeErrorCodes {
    /** Caller mistake, such as a blank Journey id. */
    const val RECOGNIZE_ERROR = "RECOGNIZE_ERROR"

    /** Unexpected failure while running the Recognize ceremony. */
    const val RECOGNIZE_RUN_ERROR = "RECOGNIZE_RUN_ERROR"

    /** No Recognize callback exists at the requested index of the active node. */
    const val RECOGNIZE_CALLBACK_NOT_FOUND = "RECOGNIZE_CALLBACK_NOT_FOUND"

    /** No Recognize collector exists at the requested index of the active DaVinci node. */
    const val RECOGNIZE_COLLECTOR_NOT_FOUND = "RECOGNIZE_COLLECTOR_NOT_FOUND"

    /** Shared cross-platform code used when a failure carries no Recognize error code. */
    const val SHARED_SDK_ERROR_CODE = "1000"
}
