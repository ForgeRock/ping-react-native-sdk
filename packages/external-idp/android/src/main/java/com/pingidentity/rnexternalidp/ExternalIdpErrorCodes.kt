/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

/**
 * Stable error codes emitted by the ExternalIdp module.
 *
 * @remarks
 * Keep these in sync with JS `ExternalIdpErrorCode`.
 */
object ExternalIdpErrorCodes {
  const val AUTHORIZE_ERROR        = "EXTERNAL_IDP_AUTHORIZE_ERROR"
  const val CANCELLED              = "EXTERNAL_IDP_CANCELLED"
  const val UNSUPPORTED_PROVIDER   = "EXTERNAL_IDP_UNSUPPORTED_PROVIDER"
  const val CALLBACK_NOT_FOUND     = "EXTERNAL_IDP_CALLBACK_NOT_FOUND"
  const val CONFIG_ERROR           = "EXTERNAL_IDP_CONFIG_ERROR"
  const val ACTIVITY_UNAVAILABLE   = "EXTERNAL_IDP_ACTIVITY_UNAVAILABLE"
}
