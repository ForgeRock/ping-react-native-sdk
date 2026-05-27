/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoath

import com.pingidentity.mfa.commons.exception.CredentialLockedException
import com.pingidentity.mfa.commons.exception.CredentialNotFoundException
import com.pingidentity.mfa.commons.exception.DuplicateCredentialException
import com.pingidentity.mfa.commons.exception.MfaClientNotInitializedException
import com.pingidentity.mfa.commons.exception.MfaException
import com.pingidentity.mfa.commons.exception.MfaInitializationException
import com.pingidentity.mfa.commons.exception.MfaPolicyViolationException
import com.pingidentity.mfa.commons.exception.MfaStorageException
import com.pingidentity.mfa.commons.policy.MfaPolicy
import com.pingidentity.rncore.error.ErrorType
import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class OathErrorMapperTest {

  @Test
  fun mapThrowable_credentialNotFoundException_mapsToStateError() {
    val error = CredentialNotFoundException("cred-id-123")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.STATE_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND, mapped.error)
    assertNotNull(mapped.message)
  }

  @Test
  fun mapThrowable_credentialLockedException_mapsToStateError() {
    val error = CredentialLockedException("lockout-policy", "too many attempts")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.STATE_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_CREDENTIAL_LOCKED, mapped.error)
  }

  @Test
  fun mapThrowable_duplicateCredentialException_mapsToStateError() {
    val error = DuplicateCredentialException("Acme", "user@acme.com")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.STATE_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_DUPLICATE_CREDENTIAL, mapped.error)
  }

  @Test
  fun mapThrowable_mfaInitializationException_mapsToInternalError() {
    val error = MfaInitializationException("init failed")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.INTERNAL_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_INITIALIZATION_FAILED, mapped.error)
    assertNotNull(mapped.message)
  }

  @Test
  fun mapThrowable_mfaStorageException_mapsToInternalError() {
    val error = MfaStorageException("storage failure")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.INTERNAL_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_STORAGE_FAILURE, mapped.error)
    assertNotNull(mapped.message)
  }

  @Test
  fun mapThrowable_mfaPolicyViolationException_mapsToStateError() {
    // MfaPolicy is an abstract Java class; use relaxed = true so MockK stubs
    // abstract members automatically. The mapper does not access policy.name,
    // so no explicit every { } stub is needed.
    val policy = mockk<MfaPolicy>(relaxed = true)
    val error = MfaPolicyViolationException("policy violation occurred", policy)

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.STATE_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_POLICY_VIOLATION, mapped.error)
    assertNotNull(mapped.message)
  }

  @Test
  fun mapThrowable_mfaClientNotInitializedException_mapsToStateError() {
    val error = MfaClientNotInitializedException("client not initialized")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.STATE_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, mapped.error)
    assertNotNull(mapped.message)
  }

  @Test
  fun mapThrowable_illegalArgumentExceptionWithUri_mapsToArgumentErrorInvalidUri() {
    val error = IllegalArgumentException("invalid uri provided")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.ARGUMENT_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_INVALID_URI, mapped.error)
    assertEquals("invalid uri provided", mapped.message)
  }

  @Test
  fun mapThrowable_illegalArgumentExceptionWithoutUri_mapsToArgumentErrorInvalidParameter() {
    val error = IllegalArgumentException("bad parameter value")

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.ARGUMENT_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_INVALID_PARAMETER, mapped.error)
    assertEquals("bad parameter value", mapped.message)
  }

  @Test
  fun mapThrowable_mfaExceptionCatchAll_mapsToUnknownError() {
    val error = object : MfaException("unexpected mfa error") {}

    val mapped = OathErrorMapper.mapThrowable(error, OathErrorCodes.OATH_UNKNOWN_ERROR)

    assertEquals(ErrorType.UNKNOWN_ERROR, mapped.type)
    assertEquals(OathErrorCodes.OATH_UNKNOWN_ERROR, mapped.error)
  }
}
