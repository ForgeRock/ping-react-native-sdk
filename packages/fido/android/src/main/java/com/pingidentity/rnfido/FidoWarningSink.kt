/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import android.util.Log
import com.pingidentity.logger.Logger

/**
 * Destination for FIDO option warnings.
 *
 * Warnings reach the registry logger resolved for the call so they appear next to the
 * ceremony logs; when no logger resolves they fall back to [android.util.Log] under
 * the bridge tag.
 */
internal object FidoWarningSink {
  /** Log tag used by the bridge and by the fallback sink. */
  const val TAG = "RNPingFidoCommon"

  /**
   * Creates a warning sink.
   *
   * @param logger Native logger resolved for the call, or null to use the platform fallback.
   * @return Function that emits a single warning message.
   */
  fun create(logger: Logger?): (String) -> Unit {
    return { message ->
      logger?.w(message, null) ?: Log.w(TAG, message)
    }
  }
}
