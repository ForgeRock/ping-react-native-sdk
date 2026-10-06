/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnfido

/**
 * Builds the JS-facing extras carried by a DaVinci FIDO ceremony rejection.
 *
 * The native DaVinci FIDO collectors record a WebAuthn DOMException name on
 * `errorCode` when a ceremony fails (introduced in native SDK 2.2.0). The bridge forwards
 * that name to JS as the `clientError` key of the rejection userInfo so apps can
 * branch on the client-side outcome without changing the existing rejection
 * codes. DaVinci-scoped only: standalone and Journey FIDO rejections carry no
 * extras.
 */
internal object FidoClientErrorMapper {

  /**
   * Key under which the client error name is placed in the rejection userInfo.
   */
  const val EXTRA_CLIENT_ERROR = "clientError"

  /**
   * Builds the rejection extras from the collector's recorded error code.
   *
   * @param errorCode WebAuthn DOMException name recorded by the native
   *   collector (`AbstractFidoCollector.errorCode`), or null when the ceremony
   *   failed without recording one.
   * @param warn Called with a diagnostic message when the failure carries no
   *   client error code, so the dropped extra is never silent.
   * @return A single-entry map with [EXTRA_CLIENT_ERROR] when `errorCode` is
   *   non-blank, otherwise an empty map.
   */
  fun extras(errorCode: String?, warn: (String) -> Unit): Map<String, String> {
    if (errorCode.isNullOrBlank()) {
      warn("FIDO DaVinci ceremony failed but the collector recorded no client error code")
      return emptyMap()
    }
    return mapOf(EXTRA_CLIENT_ERROR to errorCode)
  }
}
