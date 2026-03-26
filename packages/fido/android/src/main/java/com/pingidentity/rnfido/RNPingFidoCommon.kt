/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.Promise
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.reject

/**
 * Shared implementation for FIDO operations on Android.
 *
 * This scaffolding keeps the bridge contract stable while the FIDO SDK
 * method mapping is completed.
 */
object RNPingFidoCommon {

  /**
   * Return the default FIDO identifier.
   *
   * @param promise React Native promise to resolve with the identifier or reject on error.
   */
  @JvmStatic
  fun getDefaultFido(
    promise: Promise
  ) {
    val error = GenericError(
      type = ErrorType.FIDO_ERROR,
      error = FidoErrorCodes.FIDO_ERROR,
      message = "FIDO bridge is scaffolded but not implemented."
    )
    promise.reject(error)
  }
}
