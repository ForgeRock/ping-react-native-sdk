/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import kotlinx.serialization.json.JsonObject

/**
 * Overrides for the Credential Manager `GetPublicKeyCredentialOption` built during FIDO
 * authentication.
 *
 * A null field keeps the value of the option the native SDK built. The spec being present
 * selects Credential Manager routing even when every field is null.
 *
 * @property requestJsonPatch JSON merge patch applied to the request JSON.
 * @property clientDataHash Base64url (unpadded) client data hash.
 * @property allowedProviders Flattened component names (`package/class`) of the credential
 *   providers allowed to serve the request.
 */
internal data class FidoCredentialManagerSignInSpec(
  val requestJsonPatch: JsonObject? = null,
  val clientDataHash: String? = null,
  val allowedProviders: List<String>? = null
)
