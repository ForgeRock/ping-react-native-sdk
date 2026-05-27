/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.pingidentity.mfa.commons.exception.CredentialLockedException
import com.pingidentity.mfa.commons.exception.CredentialNotFoundException
import com.pingidentity.mfa.commons.exception.DuplicateCredentialException
import com.pingidentity.mfa.commons.exception.MfaClientNotInitializedException
import com.pingidentity.mfa.commons.exception.MfaException
import com.pingidentity.mfa.commons.exception.MfaInitializationException
import com.pingidentity.mfa.commons.exception.MfaPolicyViolationException
import com.pingidentity.mfa.commons.exception.MfaStorageException
import com.pingidentity.mfa.push.exception.DeviceTokenMissingException
import com.pingidentity.mfa.push.exception.NotificationExpiredException
import com.pingidentity.mfa.push.exception.NotificationNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for Push module metadata and bridge behavior.
 *
 * Covers:
 * - PushErrorMapper error code contract for all mapped exception types
 * - PushSerializers.deserializeCredential argument validation (via JavaOnlyMap)
 *
 * Note: Tests that require constructing native PushCredential or PushNotification SDK
 * objects (serializeCredential, serializeNotification) are omitted because the SDK
 * object constructors are not discoverable without IDE/Javadoc access for the
 * com.pingidentity.sdks:push:2.0.0 and com.pingidentity.sdks:mfa-commons:2.0.0
 * artifacts, which are not available in the local Gradle cache at test-write time.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingPushTest {

  @Before
  fun setUp() {
    runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
    runCatching { NativeLoader.init(SystemDelegate()) }
  }

  // MARK: - Error code contract tests

  /**
   * MfaInitializationException maps to "initialization_failed".
   */
  @Test
  fun mfaInitializationExceptionMapsToInitializationFailed() {
    val error = MfaInitializationException("init failed")
    assertEquals("initialization_failed", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * MfaClientNotInitializedException maps to "not_initialized".
   */
  @Test
  fun mfaClientNotInitializedExceptionMapsToNotInitialized() {
    val error = MfaClientNotInitializedException("not initialized")
    assertEquals("not_initialized", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * MfaStorageException maps to "storage_failure".
   */
  @Test
  fun mfaStorageExceptionMapsToStorageFailure() {
    val error = MfaStorageException("storage failed")
    assertEquals("storage_failure", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * CredentialLockedException maps to "credential_locked".
   */
  @Test
  fun credentialLockedExceptionMapsToCredentialLocked() {
    val error = CredentialLockedException("credential is locked")
    assertEquals("credential_locked", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * MfaPolicyViolationException maps to "policy_violation".
   */
  @Test
  fun mfaPolicyViolationExceptionMapsToPolicyViolation() {
    val error = MfaPolicyViolationException("policy violation")
    assertEquals("policy_violation", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * DuplicateCredentialException maps to "duplicate_credential".
   */
  @Test
  fun duplicateCredentialExceptionMapsToDuplicateCredential() {
    val error = DuplicateCredentialException("Example", "user@example.com")
    assertEquals("duplicate_credential", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * CredentialNotFoundException maps to "credential_not_found".
   */
  @Test
  fun credentialNotFoundExceptionMapsToCredentialNotFound() {
    val error = CredentialNotFoundException("credential not found")
    assertEquals("credential_not_found", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * DeviceTokenMissingException maps to "device_token_not_set".
   */
  @Test
  fun deviceTokenMissingExceptionMapsToDeviceTokenNotSet() {
    val error = DeviceTokenMissingException("device token missing")
    assertEquals("device_token_not_set", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * NotificationNotFoundException maps to "notification_not_found".
   */
  @Test
  fun notificationNotFoundExceptionMapsToNotificationNotFound() {
    val error = NotificationNotFoundException("notification not found")
    assertEquals("notification_not_found", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * NotificationExpiredException maps to "notification_not_found" (subtype, checked first).
   * Expired notifications are a subset of not-found and share the same error code.
   */
  @Test
  fun notificationExpiredExceptionMapsToNotificationNotFound() {
    val error = NotificationExpiredException("notif-expired-id", 60)
    assertEquals("notification_not_found", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * Generic MfaException (not a specific subtype) maps to "network_failure".
   */
  @Test
  fun genericMfaExceptionMapsToNetworkFailure() {
    val error = object : MfaException("generic mfa error") {}
    assertEquals("network_failure", PushErrorMapper.resolveErrorCode(error))
  }

  /**
   * Non-SDK RuntimeException (unexpected runtime error) maps to "network_failure".
   */
  @Test
  fun runtimeExceptionMapsToNetworkFailure() {
    val error = RuntimeException("unexpected runtime error")
    assertEquals("network_failure", PushErrorMapper.resolveErrorCode(error))
  }

  // MARK: - resolveErrorType tests

  /**
   * MfaStorageException maps to INTERNAL_ERROR type.
   */
  @Test
  fun mfaStorageExceptionMapsToInternalErrorType() {
    val error = MfaStorageException("storage failed")
    assertEquals(com.pingidentity.rncore.error.ErrorType.INTERNAL_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * MfaInitializationException maps to INTERNAL_ERROR type.
   */
  @Test
  fun mfaInitializationExceptionMapsToInternalErrorType() {
    val error = MfaInitializationException("init failed")
    assertEquals(com.pingidentity.rncore.error.ErrorType.INTERNAL_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * MfaClientNotInitializedException maps to STATE_ERROR type.
   */
  @Test
  fun mfaClientNotInitializedExceptionMapsToStateErrorType() {
    val error = MfaClientNotInitializedException("not initialized")
    assertEquals(com.pingidentity.rncore.error.ErrorType.STATE_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * CredentialLockedException maps to STATE_ERROR type.
   */
  @Test
  fun credentialLockedExceptionMapsToStateErrorType() {
    val error = CredentialLockedException("locked")
    assertEquals(com.pingidentity.rncore.error.ErrorType.STATE_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * NotificationNotFoundException maps to STATE_ERROR type.
   */
  @Test
  fun notificationNotFoundExceptionMapsToStateErrorType() {
    val error = NotificationNotFoundException("not found")
    assertEquals(com.pingidentity.rncore.error.ErrorType.STATE_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * Generic MfaException maps to NETWORK_ERROR type.
   */
  @Test
  fun genericMfaExceptionMapsToNetworkErrorType() {
    val error = object : MfaException("mfa error") {}
    assertEquals(com.pingidentity.rncore.error.ErrorType.NETWORK_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  /**
   * Generic RuntimeException maps to NETWORK_ERROR type.
   */
  @Test
  fun runtimeExceptionMapsToNetworkErrorType() {
    val error = RuntimeException("runtime error")
    assertEquals(com.pingidentity.rncore.error.ErrorType.NETWORK_ERROR, PushErrorMapper.resolveErrorType(error))
  }

  // MARK: - deserializeCredential argument validation

  /**
   * deserializeCredential throws when "id" is missing.
   */
  @Test
  fun deserializeCredentialThrowsWhenIdMissing() {
    val map = JavaOnlyMap().apply {
      putString("issuer", "Example")
      putString("accountName", "user@example.com")
    }

    var caught: Throwable? = null
    try {
      deserializeCredential(map)
    } catch (e: IllegalArgumentException) {
      caught = e
    }

    assertTrue(caught != null)
    assertTrue(caught!!.message?.contains("id") == true)
  }

  /**
   * deserializeCredential throws when "id" is blank.
   */
  @Test
  fun deserializeCredentialThrowsWhenIdBlank() {
    val map = JavaOnlyMap().apply {
      putString("id", "   ")
      putString("issuer", "Example")
      putString("accountName", "user@example.com")
    }

    var caught: Throwable? = null
    try {
      deserializeCredential(map)
    } catch (e: IllegalArgumentException) {
      caught = e
    }

    assertTrue(caught != null)
  }

  /**
   * deserializeCredential throws when "issuer" is missing.
   */
  @Test
  fun deserializeCredentialThrowsWhenIssuerMissing() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("accountName", "user@example.com")
    }

    var caught: Throwable? = null
    try {
      deserializeCredential(map)
    } catch (e: IllegalArgumentException) {
      caught = e
    }

    assertTrue(caught != null)
    assertTrue(caught!!.message?.contains("issuer") == true)
  }

  /**
   * deserializeCredential throws when "issuer" is blank.
   */
  @Test
  fun deserializeCredentialThrowsWhenIssuerBlank() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("issuer", "")
      putString("accountName", "user@example.com")
    }

    var caught: Throwable? = null
    try {
      deserializeCredential(map)
    } catch (e: IllegalArgumentException) {
      caught = e
    }

    assertTrue(caught != null)
  }

  /**
   * deserializeCredential throws when "accountName" is missing.
   */
  @Test
  fun deserializeCredentialThrowsWhenAccountNameMissing() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("issuer", "Example")
    }

    var caught: Throwable? = null
    try {
      deserializeCredential(map)
    } catch (e: IllegalArgumentException) {
      caught = e
    }

    assertTrue(caught != null)
    assertTrue(caught!!.message?.contains("accountName") == true)
  }

  /**
   * deserializeCredential succeeds when all required fields are present.
   * displayIssuer and displayAccountName default to issuer/accountName when absent.
   */
  @Test
  fun deserializeCredentialSucceedsWithRequiredFieldsOnly() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("issuer", "Example")
      putString("accountName", "user@example.com")
      putString("platform", "PING_AM")
    }

    val credential = deserializeCredential(map)

    assertEquals("cred-1", credential.id)
    assertEquals("Example", credential.issuer)
    assertEquals("user@example.com", credential.accountName)
    assertEquals("Example", credential.displayIssuer)
    assertEquals("user@example.com", credential.displayAccountName)
  }

  /**
   * deserializeCredential reads optional fields when present.
   */
  @Test
  fun deserializeCredentialReadsOptionalFields() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-2")
      putString("issuer", "Ping")
      putString("accountName", "admin@ping.com")
      putString("displayIssuer", "Ping Identity")
      putString("displayAccountName", "Admin User")
      putString("platform", "PING_ONE")
      putDouble("createdAt", 1000.0)
      putBoolean("isLocked", true)
    }

    val credential = deserializeCredential(map)

    assertEquals("cred-2", credential.id)
    assertEquals("Ping Identity", credential.displayIssuer)
    assertEquals("Admin User", credential.displayAccountName)
    assertEquals(1000L, credential.createdAt.time)
    assertTrue(credential.isLocked)
  }

  /**
   * deserializeCredential defaults isLocked to false when absent.
   */
  @Test
  fun deserializeCredentialDefaultsIsLockedToFalse() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("issuer", "Example")
      putString("accountName", "user@example.com")
      putString("platform", "PING_AM")
    }

    val credential = deserializeCredential(map)

    assertFalse(credential.isLocked)
  }

  /**
   * deserializeCredential defaults createdAt to epoch 0 when createdAt is absent.
   */
  @Test
  fun deserializeCredentialDefaultsTimeAddedToZeroWhenAbsent() {
    val map = JavaOnlyMap().apply {
      putString("id", "cred-1")
      putString("issuer", "Example")
      putString("accountName", "user@example.com")
      putString("platform", "PING_AM")
    }

    val credential = deserializeCredential(map)

    assertEquals(0L, credential.createdAt.time)
  }

}
