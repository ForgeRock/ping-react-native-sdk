/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

/**
 * Stable error codes emitted by the Device Client module.
 *
 * @remarks
 * Keep these in sync with JS `DeviceClientErrorCode` and iOS `DeviceClientErrorCode`.
 */
object DeviceClientErrorCodes {
  /** General, unclassified Device Client error. */
  const val DEVICE_CLIENT_ERROR = "DEVICE_CLIENT_ERROR"

  /** A network-level failure occurred (connectivity, DNS, TLS, etc.). */
  const val DEVICE_CLIENT_NETWORK_ERROR = "DEVICE_CLIENT_NETWORK_ERROR"

  /** The server returned an HTTP error status that does not map to a more specific code. */
  const val DEVICE_CLIENT_REQUEST_FAILED = "DEVICE_CLIENT_REQUEST_FAILED"

  /** The SSO token or session cookie is invalid or expired (HTTP 401). */
  const val DEVICE_CLIENT_INVALID_TOKEN = "DEVICE_CLIENT_INVALID_TOKEN"

  /** The server response could not be deserialized into the expected model. */
  const val DEVICE_CLIENT_DECODING_FAILED = "DEVICE_CLIENT_DECODING_FAILED"

  /** Required configuration values (e.g. `serverUrl`, `ssoToken`) were missing or invalid. */
  const val DEVICE_CLIENT_MISSING_CONFIG = "DEVICE_CLIENT_MISSING_CONFIG"

  /** The requested device resource was not found on the server (HTTP 404). */
  const val DEVICE_CLIENT_NOT_FOUND = "DEVICE_CLIENT_NOT_FOUND"

  /** The handle id supplied by JS does not map to a live [DeviceClient] instance in the registry. */
  const val DEVICE_CLIENT_HANDLE_NOT_FOUND = "DEVICE_CLIENT_HANDLE_NOT_FOUND"
}
