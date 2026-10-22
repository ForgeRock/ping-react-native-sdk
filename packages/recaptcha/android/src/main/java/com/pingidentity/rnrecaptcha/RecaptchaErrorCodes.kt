/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

/**
 * Stable error codes emitted by the reCAPTCHA module.
 *
 * Keep these in sync with JS `RecaptchaErrorCode` and iOS `RecaptchaErrorCode`.
 */
internal object RecaptchaErrorCodes {
    const val RECAPTCHA_ERROR = "RECAPTCHA_ERROR"
    const val RECAPTCHA_VERIFY_ERROR = "RECAPTCHA_VERIFY_ERROR"
    const val RECAPTCHA_CALLBACK_NOT_FOUND = "RECAPTCHA_CALLBACK_NOT_FOUND"
}
