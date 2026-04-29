/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.pingidentity.rncore.error.ErrorType
import java.io.IOException
import java.net.MalformedURLException
import kotlinx.serialization.SerializationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for the pure-function helpers split out of
 * [RNPingDeviceClientCommon].
 *
 * Covers [DeviceClientConfigNormalizer] and [DeviceErrorClassifier].
 * Other behavior (native registry, DeviceClient interactions) is covered
 * by integration tests or the native SDK's own tests.
 */
class RNPingDeviceClientCommonTest {

  // region  normalizeServerUrl

  @Test
  fun `normalizeServerUrl strips single trailing slash`() {
    assertEquals(
      "https://example.com/am",
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am/"),
    )
  }

  @Test
  fun `normalizeServerUrl strips multiple trailing slashes`() {
    assertEquals(
      "https://example.com/am",
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am///"),
    )
  }

  @Test
  fun `normalizeServerUrl trims leading and trailing whitespace`() {
    assertEquals(
      "https://example.com/am",
      DeviceClientConfigNormalizer.normalizeServerUrl("  https://example.com/am  "),
    )
  }

  @Test
  fun `normalizeServerUrl returns already-clean url unchanged`() {
    assertEquals(
      "https://example.com/am",
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am"),
    )
  }

  @Test
  fun `normalizeServerUrl returns empty input unchanged`() {
    assertEquals("", DeviceClientConfigNormalizer.normalizeServerUrl(""))
  }

  @Test
  fun `normalizeServerUrl normalizes whitespace-only input to empty string`() {
    assertEquals("", DeviceClientConfigNormalizer.normalizeServerUrl("   "))
  }

  @Test
  fun `normalizeServerUrl normalizes slash-only input to empty string`() {
    assertEquals("", DeviceClientConfigNormalizer.normalizeServerUrl(" / "))
  }

  // endregion

  // region  normalizeRealm

  @Test
  fun `normalizeRealm strips single leading slash`() {
    assertEquals("alpha", DeviceClientConfigNormalizer.normalizeRealm("/alpha"))
  }

  @Test
  fun `normalizeRealm strips multiple leading slashes`() {
    assertEquals("alpha", DeviceClientConfigNormalizer.normalizeRealm("///alpha"))
  }

  @Test
  fun `normalizeRealm trims whitespace`() {
    assertEquals("alpha", DeviceClientConfigNormalizer.normalizeRealm("  alpha  "))
  }

  @Test
  fun `normalizeRealm returns clean value unchanged`() {
    assertEquals("alpha", DeviceClientConfigNormalizer.normalizeRealm("alpha"))
  }

  @Test
  fun `normalizeRealm defaults to root for null input`() {
    assertEquals(
      DeviceClientConfigNormalizer.DEFAULT_REALM,
      DeviceClientConfigNormalizer.normalizeRealm(null),
    )
  }

  @Test
  fun `normalizeRealm defaults to root for blank input`() {
    assertEquals(
      DeviceClientConfigNormalizer.DEFAULT_REALM,
      DeviceClientConfigNormalizer.normalizeRealm(""),
    )
    assertEquals(
      DeviceClientConfigNormalizer.DEFAULT_REALM,
      DeviceClientConfigNormalizer.normalizeRealm("   "),
    )
  }

  @Test
  fun `normalizeRealm defaults to root when only slashes provided`() {
    assertEquals(
      DeviceClientConfigNormalizer.DEFAULT_REALM,
      DeviceClientConfigNormalizer.normalizeRealm("///"),
    )
  }

  // endregion

  // region  classify

  @Test
  fun `classify maps IO exceptions to NETWORK_ERROR`() {
    val (code, type, status) = DeviceErrorClassifier.classify(
      IOException("Socket timeout"),
    )
    assertEquals(DeviceClientErrorCodes.DEVICE_CLIENT_NETWORK_ERROR, code)
    assertEquals(ErrorType.NETWORK_ERROR, type)
    assertNull(status)
  }

  @Test
  fun `classify maps serialization exceptions to DECODING_FAILED`() {
    val (code, type, status) = DeviceErrorClassifier.classify(
      SerializationException("Invalid JSON"),
    )
    assertEquals(DeviceClientErrorCodes.DEVICE_CLIENT_DECODING_FAILED, code)
    assertEquals(ErrorType.PARSE_ERROR, type)
    assertNull(status)
  }

  @Test
  fun `classify maps malformed URL to MISSING_CONFIG`() {
    val (code, type, status) = DeviceErrorClassifier.classify(
      MalformedURLException("Bad URL"),
    )
    assertEquals(DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG, code)
    assertEquals(ErrorType.ARGUMENT_ERROR, type)
    assertNull(status)
  }

  @Test
  fun `classify maps illegal argument to MISSING_CONFIG`() {
    val (code, type, status) = DeviceErrorClassifier.classify(
      IllegalArgumentException("Missing config"),
    )
    assertEquals(DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG, code)
    assertEquals(ErrorType.ARGUMENT_ERROR, type)
    assertNull(status)
  }

  @Test
  fun `classify falls back to generic error for unknown throwable types`() {
    val (code, type, status) =
      DeviceErrorClassifier.classify(IllegalStateException("Unexpected"))
    assertEquals(DeviceClientErrorCodes.DEVICE_CLIENT_ERROR, code)
    assertEquals(ErrorType.UNKNOWN_ERROR, type)
    assertNull(status)
  }

  // endregion

  // region  error codes contract

  @Test
  fun `error code constants have stable values`() {
    assertEquals("DEVICE_CLIENT_ERROR", DeviceClientErrorCodes.DEVICE_CLIENT_ERROR)
    assertEquals(
      "DEVICE_CLIENT_NETWORK_ERROR",
      DeviceClientErrorCodes.DEVICE_CLIENT_NETWORK_ERROR,
    )
    assertEquals(
      "DEVICE_CLIENT_REQUEST_FAILED",
      DeviceClientErrorCodes.DEVICE_CLIENT_REQUEST_FAILED,
    )
    assertEquals(
      "DEVICE_CLIENT_INVALID_TOKEN",
      DeviceClientErrorCodes.DEVICE_CLIENT_INVALID_TOKEN,
    )
    assertEquals(
      "DEVICE_CLIENT_DECODING_FAILED",
      DeviceClientErrorCodes.DEVICE_CLIENT_DECODING_FAILED,
    )
    assertEquals(
      "DEVICE_CLIENT_MISSING_CONFIG",
      DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG,
    )
    assertEquals(
      "DEVICE_CLIENT_NOT_FOUND",
      DeviceClientErrorCodes.DEVICE_CLIENT_NOT_FOUND,
    )
    assertEquals(
      "DEVICE_CLIENT_HANDLE_NOT_FOUND",
      DeviceClientErrorCodes.DEVICE_CLIENT_HANDLE_NOT_FOUND,
    )
  }

  // endregion
}
