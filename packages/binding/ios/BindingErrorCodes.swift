/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation

/// Stable error codes emitted by the Binding module.
///
/// Keep these in sync with JS `BindingErrorCode` and Android `BindingErrorCodes`.
enum BindingErrorCode: String {
  case bindingError = "BINDING_ERROR"
  case bindError = "BINDING_BIND_ERROR"
  case signError = "BINDING_SIGN_ERROR"
  case cancelled = "BINDING_CANCELLED"
  case unsupportedDevice = "BINDING_UNSUPPORTED_DEVICE"
  case notRegistered = "BINDING_NOT_REGISTERED"
  case uiUnavailable = "BINDING_UI_UNAVAILABLE"
  case callbackNotFound = "BINDING_CALLBACK_NOT_FOUND"
  case invalidConfig = "BINDING_INVALID_CONFIG"
  case keyDeleteError = "BINDING_KEY_DELETE_ERROR"
  case keyInvalidated = "BINDING_KEY_INVALIDATED"
  case authFailed = "BINDING_AUTH_FAILED"
}
