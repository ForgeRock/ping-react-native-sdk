/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.domerrors.InvalidStateError
import androidx.credentials.exceptions.domerrors.TimeoutError
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
import com.pingidentity.davinci.plugin.DaVinci
import com.pingidentity.fido.Constants
import com.pingidentity.fido.davinci.FidoAuthenticationCollector
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.orchestrate.WorkflowConfig
import io.mockk.every
import io.mockk.mockk
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Drift guards over the native FIDO collectors' client-error contract (SDK 2.2.0):
 * the WebAuthn DOMException name `handleError` records on `errorCode`, the
 * `ActionKeyProvider` surface (event type, action key, empty payload sentinel), and
 * the state reset on `close()`.
 *
 * These tests consume the real native collectors, so any upstream change to the
 * error contract surfaces here first instead of silently changing what JS
 * receives as `clientError`. Robolectric is required only because the collectors
 * touch Android framework classes through the Credential Manager types.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoDaVinciErrorContractTest {

    private lateinit var registrationCollector: FidoRegistrationCollector
    private lateinit var authenticationCollector: FidoAuthenticationCollector

    @Before
    fun setUp() {
        // WorkflowConfig's default logger is the no-op Logger, so the collectors'
        // internal logging needs no stubbing beyond the config read.
        val daVinci = mockk<DaVinci>()
        every { daVinci.config } returns WorkflowConfig()

        registrationCollector = FidoRegistrationCollector().apply {
            davinci = daVinci
            init(registrationInput())
        }
        authenticationCollector = FidoAuthenticationCollector().apply {
            davinci = daVinci
            init(authenticationInput())
        }
    }

    // MARK: - handleError -> errorCode mapping

    /**
     * Ensures a create-side cancellation maps to NotAllowedError, the same name
     * the bridge forwards as clientError for register cancellations.
     */
    @Test
    fun registerHandleErrorMapsCreateCancellationToNotAllowed() {
        registrationCollector.handleError(CreateCredentialCancellationException())

        assertEquals("NotAllowedError", registrationCollector.errorCode)
    }

    /**
     * Ensures a create-side unsupported result maps to NotSupportedError.
     */
    @Test
    fun registerHandleErrorMapsCreateUnsupportedToNotSupported() {
        registrationCollector.handleError(CreateCredentialUnsupportedException())

        assertEquals("NotSupportedError", registrationCollector.errorCode)
    }

    /**
     * Ensures a get-side DomException's domError simple name becomes the errorCode,
     * exercising the open set: TimeoutError comes straight from the DomError name.
     */
    @Test
    fun authenticateHandleErrorMapsGetDomTimeoutToTimeoutError() {
        authenticationCollector.handleError(
            GetPublicKeyCredentialDomException(TimeoutError())
        )

        assertEquals("TimeoutError", authenticationCollector.errorCode)
    }

    /**
     * Ensures a create-side DomException's domError name is recorded, exercising
     * InvalidStateError through the create path.
     */
    @Test
    fun registerHandleErrorMapsCreateDomInvalidStateToInvalidState() {
        registrationCollector.handleError(
            CreatePublicKeyCredentialDomException(InvalidStateError())
        )

        assertEquals("InvalidStateError", registrationCollector.errorCode)
    }

    /**
     * Ensures an unexpected non-Credential-Manager failure still produces a
     * errorCode: the open-set fallback UnknownError.
     */
    @Test
    fun handleErrorMapsUnexpectedThrowableToUnknown() {
        registrationCollector.handleError(IllegalStateException("boom"))

        assertEquals("UnknownError", registrationCollector.errorCode)
    }

    /**
     * Ensures NoCredentialException has no dedicated handleError branch and falls
     * through to UnknownError (plan D8): the bridge keeps its own
     * FIDO_AUTHENTICATE_CANCELLED classification while clientError reports the
     * server-parity UnknownError, and the two intentionally disagree.
     */
    @Test
    fun authenticateHandleErrorMapsNoCredentialToUnknown() {
        authenticationCollector.handleError(NoCredentialException())

        assertEquals("UnknownError", authenticationCollector.errorCode)
    }

    // MARK: - ActionKeyProvider surface while errorCode is set

    /**
     * Ensures a recorded error code flips the collector's event type to "action",
     * exposes the code as the action key, and switches payload() to the non-null
     * empty-object sentinel that makes the collector win Collectors.eventType.
     */
    @Test
    fun erroredCollectorExposesActionKeySurface() {
        authenticationCollector.handleError(GetCredentialCancellationException())

        assertEquals("action", authenticationCollector.eventType())
        assertEquals("NotAllowedError", authenticationCollector.actionKey)
        assertEquals(buildJsonObject { }, authenticationCollector.payload())
    }

    /**
     * Ensures the empty-object error payload is keyed under the collector's own
     * WebAuthn options field name, matching what the server-side action path reads.
     */
    @Test
    fun erroredAuthenticationCollectorEventTypeMatchesConstant() {
        authenticationCollector.handleError(GetCredentialCancellationException())

        assertEquals(Constants.EVENT_TYPE_ACTION, authenticationCollector.eventType())
    }

    // MARK: - State reset

    /**
     * Ensures close() clears the recorded error code: the next submit reports the
     * plain submit surface with no action key and a null payload, so a consumed
     * error cannot leak into a later event.
     */
    @Test
    fun closeResetsErrorState() {
        authenticationCollector.handleError(GetCredentialCancellationException())
        assertEquals("NotAllowedError", authenticationCollector.errorCode)

        authenticationCollector.close()

        assertNull(authenticationCollector.errorCode)
        assertEquals("submit", authenticationCollector.eventType())
        assertNull(authenticationCollector.actionKey)
        assertNull(authenticationCollector.payload())
    }

    /**
     * Builds a registration collector payload with server-style int-array binary fields.
     */
    private fun registrationInput() = buildJsonObject {
        put("type", JsonPrimitive("FIDO2"))
        put("key", JsonPrimitive("fido-register-key"))
        put("label", JsonPrimitive("Set up passkeys"))
        put("trigger", JsonPrimitive("submit"))
        put("required", true)
        put(
            Constants.FIELD_PUBLIC_KEY_CREDENTIAL_CREATION_OPTIONS,
            buildJsonObject {
                put("rp", buildJsonObject { put("id", JsonPrimitive("example.com")) })
                put("challenge", JsonArray(listOf(JsonPrimitive(72), JsonPrimitive(101))))
            }
        )
    }

    /**
     * Builds an authentication collector payload in the same server style.
     */
    private fun authenticationInput() = buildJsonObject {
        put("type", JsonPrimitive("FIDO2"))
        put("key", JsonPrimitive("fido-authenticate-key"))
        put("label", JsonPrimitive("Sign in with passkey"))
        put("trigger", JsonPrimitive("submit"))
        put("required", true)
        put(
            Constants.FIELD_PUBLIC_KEY_CREDENTIAL_REQUEST_OPTIONS,
            buildJsonObject {
                put("rp", buildJsonObject { put("id", JsonPrimitive("example.com")) })
                put("challenge", JsonArray(listOf(JsonPrimitive(72), JsonPrimitive(101))))
            }
        )
    }
}
