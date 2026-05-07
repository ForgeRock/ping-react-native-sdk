/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

/**
 * Stable error codes emitted by the Binding module.
 *
 * Keep these in sync with JS `BindingErrorCode` and iOS `BindingErrorCode`.
 */
object BindingErrorCodes {
  const val BINDING_ERROR = "BINDING_ERROR"
  const val BINDING_BIND_ERROR = "BINDING_BIND_ERROR"
  const val BINDING_SIGN_ERROR = "BINDING_SIGN_ERROR"
  const val BINDING_CANCELLED = "BINDING_CANCELLED"
  const val BINDING_UNSUPPORTED_DEVICE = "BINDING_UNSUPPORTED_DEVICE"
  const val BINDING_NOT_REGISTERED = "BINDING_NOT_REGISTERED"
  const val BINDING_UI_UNAVAILABLE = "BINDING_UI_UNAVAILABLE"
  const val BINDING_CALLBACK_NOT_FOUND = "BINDING_CALLBACK_NOT_FOUND"
  const val BINDING_INVALID_CONFIG = "BINDING_INVALID_CONFIG"
  const val BINDING_KEY_READ_ERROR = "BINDING_KEY_READ_ERROR"
  const val BINDING_KEY_DELETE_ERROR = "BINDING_KEY_DELETE_ERROR"
  const val BINDING_KEY_INVALIDATED = "BINDING_KEY_INVALIDATED"
  const val BINDING_AUTH_FAILED = "BINDING_AUTH_FAILED"
}
