/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.CreatePublicKeyCredentialRequest

/**
 * Applies a [FidoCreateRequestSpec] to the `CreatePublicKeyCredentialRequest` built by the
 * native FIDO client.
 *
 * The replacement is built from the original request, so any field the spec leaves unset
 * keeps the original value. Invalid combinations are reported through [warn] and keep the
 * original request unchanged.
 *
 * @property spec Overrides to apply.
 * @property warn Sink for option warnings; messages never contain option values.
 */
internal class FidoCreateRequestCustomizer(
  private val spec: FidoCreateRequestSpec,
  private val warn: (String) -> Unit
) {

  /**
   * Builds the request to use for the registration ceremony.
   *
   * @param original Request built by the native FIDO client.
   * @return A request with the spec applied, or [original] when the spec is invalid.
   * @throws IllegalArgumentException when the original `requestJson` is not a JSON object, which
   *   cannot occur for requests built by the native SDK from its own JSON input, and when
   *   [FidoJsonMergePatch.applyToText] rejects an assembled value.
   */
  fun customize(original: CreatePublicKeyCredentialRequest): CreatePublicKeyCredentialRequest {
    val preferDefaultProvider = spec.preferDefaultProvider ?: original.displayInfo.preferDefaultProvider
    val isConditional = spec.isConditional ?: original.isConditional
    if (preferDefaultProvider != null && isConditional) {
      warn(
        "FIDO create request option 'preferDefaultProvider' cannot be combined with " +
          "'isConditional' set to true; the original request is kept"
      )
      return original
    }
    val clientDataHash = spec.clientDataHash
      ?.let { FidoClientDataHash.decode(it, FidoClientDataHash.Target.CREATE_REQUEST, warn) ?: return original }
      ?: original.clientDataHash
    val requestJson = spec.requestJsonPatch
      ?.let { FidoJsonMergePatch.applyToText(original.requestJson, it) }
      ?: original.requestJson
    val preferImmediatelyAvailableCredentials =
      spec.preferImmediatelyAvailableCredentials ?: original.preferImmediatelyAvailableCredentials
    val origin = spec.origin ?: original.origin
    val isAutoSelectAllowed = spec.isAutoSelectAllowed ?: original.isAutoSelectAllowed

    if (preferDefaultProvider == null) {
      return CreatePublicKeyCredentialRequest(
        requestJson = requestJson,
        clientDataHash = clientDataHash,
        preferImmediatelyAvailableCredentials = preferImmediatelyAvailableCredentials,
        origin = origin,
        isAutoSelectAllowed = isAutoSelectAllowed,
        isConditional = isConditional
      )
    }
    return CreatePublicKeyCredentialRequest(
      requestJson = requestJson,
      clientDataHash = clientDataHash,
      preferImmediatelyAvailableCredentials = preferImmediatelyAvailableCredentials,
      origin = origin,
      preferDefaultProvider = preferDefaultProvider,
      isAutoSelectAllowed = isAutoSelectAllowed
    )
  }
}
