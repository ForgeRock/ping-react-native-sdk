/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import com.google.android.recaptcha.RecaptchaErrorCode
import com.google.android.recaptcha.RecaptchaException
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for reCAPTCHA module naming and stable error-code contracts.
 */
class RNPingRecaptchaModuleTest {

    /**
     * Ensures the TurboModule name matches the codegen registry key.
     */
    @Test
    fun moduleNameIsCorrect() {
        assertEquals("RNPingRecaptcha", RNPingRecaptchaModule.NAME)
    }

    /**
     * Ensures RECAPTCHA_ERROR is the correct stable value.
     */
    @Test
    fun errorCodeRecaptchaErrorIsCorrect() {
        assertEquals("RECAPTCHA_ERROR", RecaptchaErrorCodes.RECAPTCHA_ERROR)
    }

    /**
     * Ensures RECAPTCHA_VERIFY_ERROR is the correct stable value.
     */
    @Test
    fun errorCodeVerifyErrorIsCorrect() {
        assertEquals("RECAPTCHA_VERIFY_ERROR", RecaptchaErrorCodes.RECAPTCHA_VERIFY_ERROR)
    }

    /**
     * Ensures RECAPTCHA_CALLBACK_NOT_FOUND is the correct stable value.
     */
    @Test
    fun errorCodeCallbackNotFoundIsCorrect() {
        assertEquals("RECAPTCHA_CALLBACK_NOT_FOUND", RecaptchaErrorCodes.RECAPTCHA_CALLBACK_NOT_FOUND)
    }

    /**
     * Ensures the error mapper surfaces Google's taxonomy for its exceptions.
     */
    @Test
    fun errorMapperMapsRecaptchaExceptionToGoogleCode() {
        val error = RecaptchaErrorMapper.map(
            RecaptchaException(
                com.google.android.recaptcha.RecaptchaErrorCode.INVALID_SITEKEY,
                "bad key"
            ),
            RecaptchaErrorCodes.RECAPTCHA_VERIFY_ERROR
        )
        assertEquals("INVALID_SITEKEY", error.error)
        assertEquals("bad key", error.message)
    }

    /**
     * Ensures the error mapper falls back to the shared mapper otherwise.
     */
    @Test
    fun errorMapperFallsBackToSharedMapper() {
        val error = RecaptchaErrorMapper.map(
            IllegalArgumentException("bad input"),
            RecaptchaErrorCodes.RECAPTCHA_ERROR
        )
        assertEquals("argument_error", error.type.rawValue)
        assertEquals(RecaptchaErrorCodes.RECAPTCHA_ERROR, error.error)
    }
}
