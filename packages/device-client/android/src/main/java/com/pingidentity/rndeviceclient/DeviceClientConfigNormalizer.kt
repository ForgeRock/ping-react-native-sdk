/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

/**
 * Normalizes Device Client configuration values received from JS.
 *
 * The native Ping SDKs are strict about URL / realm formatting — a trailing
 * slash on `serverUrl` or a leading slash on `realm` causes the session
 * endpoint to reject the request. Normalization tolerates those inputs so
 * JS callers can pass through user-supplied configuration as-is.
 */
internal object DeviceClientConfigNormalizer {
  // Keep this package-local for now; promote to `packages/core` once a second package
  // needs the same normalization behavior.

  /** Default realm used when the caller does not provide one. */
  internal const val DEFAULT_REALM = "root"

  /** Trims whitespace and strips trailing `/` from the server URL. */
  internal fun normalizeServerUrl(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return trimmed
    return trimmed.trimEnd('/')
  }

  /** Trims whitespace and strips a leading `/` from the realm; defaults to [DEFAULT_REALM]. */
  internal fun normalizeRealm(value: String?): String {
    val trimmed = value?.trim().orEmpty()
    if (trimmed.isEmpty()) return DEFAULT_REALM
    return trimmed.trimStart('/').ifEmpty { DEFAULT_REALM }
  }
}
