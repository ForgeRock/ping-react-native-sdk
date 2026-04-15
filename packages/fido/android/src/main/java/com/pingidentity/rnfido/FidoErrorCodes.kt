/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

/**
 * Stable error codes emitted by the FIDO module.
 *
 * @remarks
 * Keep these in sync with JS `FidoErrorCode` and iOS `FidoErrorCode`.
 */
object FidoErrorCodes {
  const val FIDO_ERROR = "FIDO_ERROR"
  const val FIDO_REGISTER_ERROR = "FIDO_REGISTER_ERROR"
  const val FIDO_AUTHENTICATE_ERROR = "FIDO_AUTHENTICATE_ERROR"
  const val FIDO_AUTHENTICATE_CANCELLED = "FIDO_AUTHENTICATE_CANCELLED"
  const val FIDO_ACTIVITY_UNAVAILABLE = "FIDO_ACTIVITY_UNAVAILABLE"
  const val FIDO_WINDOW_UNAVAILABLE = "FIDO_WINDOW_UNAVAILABLE"
  const val FIDO_CALLBACK_NOT_FOUND = "FIDO_CALLBACK_NOT_FOUND"
}
