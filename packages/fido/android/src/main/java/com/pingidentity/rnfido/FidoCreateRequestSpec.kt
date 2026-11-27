/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import kotlinx.serialization.json.JsonObject

/**
 * Overrides for the Credential Manager `CreatePublicKeyCredentialRequest` built during
 * FIDO registration.
 *
 * Every field is optional; a null field keeps the value of the request the native SDK
 * built.
 *
 * @property requestJsonPatch JSON merge patch applied to the SDK-transformed request JSON.
 * @property clientDataHash Base64url (unpadded) client data hash.
 * @property preferImmediatelyAvailableCredentials Restricts creation to immediately available providers.
 * @property origin Caller origin; requires the host app to hold the privileged-apps permission.
 * @property isAutoSelectAllowed Whether the credential may be auto-selected.
 * @property isConditional Whether the request is a conditional (silent) creation.
 * @property preferDefaultProvider Component name of the preferred provider; cannot be
 *   combined with a conditional request.
 */
internal data class FidoCreateRequestSpec(
  val requestJsonPatch: JsonObject? = null,
  val clientDataHash: String? = null,
  val preferImmediatelyAvailableCredentials: Boolean? = null,
  val origin: String? = null,
  val isAutoSelectAllowed: Boolean? = null,
  val isConditional: Boolean? = null,
  val preferDefaultProvider: String? = null
) {
  /** True when no field is set, so applying the spec would change nothing. */
  val isEmpty: Boolean
    get() = this == EMPTY

  private companion object {
    val EMPTY = FidoCreateRequestSpec()
  }
}
