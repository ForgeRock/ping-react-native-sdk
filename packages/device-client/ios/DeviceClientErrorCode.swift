/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Stable error codes emitted by the Device Client module.
///
/// Keep these in sync with JS `DeviceClientErrorCode` and Android
/// `DeviceClientErrorCodes`. Each case maps to a unique string that JS
/// consumers can match on to provide user-facing error handling.
internal enum DeviceClientErrorCode: String {
  /// Generic / catch-all error.
  case unknown = "DEVICE_CLIENT_ERROR"
  /// A network-level failure (timeout, DNS, connectivity).
  case network = "DEVICE_CLIENT_NETWORK_ERROR"
  /// The server returned a non-success HTTP status.
  case requestFailed = "DEVICE_CLIENT_REQUEST_FAILED"
  /// The SSO token was rejected (HTTP 401).
  case invalidToken = "DEVICE_CLIENT_INVALID_TOKEN"
  /// JSON decoding or encoding failed.
  case decodingFailed = "DEVICE_CLIENT_DECODING_FAILED"
  /// Required configuration values are missing or invalid.
  case missingConfig = "DEVICE_CLIENT_MISSING_CONFIG"
  /// The requested resource was not found (HTTP 404).
  case notFound = "DEVICE_CLIENT_NOT_FOUND"
  /// The supplied handle does not correspond to a live `DeviceClient`.
  case handleNotFound = "DEVICE_CLIENT_HANDLE_NOT_FOUND"
}
