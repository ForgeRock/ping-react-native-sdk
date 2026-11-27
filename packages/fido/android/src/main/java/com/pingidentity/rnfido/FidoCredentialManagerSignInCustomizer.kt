/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import android.content.ComponentName
import androidx.credentials.GetPublicKeyCredentialOption

/**
 * Applies a [FidoCredentialManagerSignInSpec] to the `GetPublicKeyCredentialOption` built by
 * the native FIDO client.
 *
 * The replacement is built from the original option, so any field the spec leaves unset keeps
 * the original value. Invalid values are reported through [warn] and keep the original option
 * unchanged. The `isAutoSelectAllowed` flag is fixed by the androidx constructors and is not
 * part of the spec.
 *
 * @property spec Overrides to apply.
 * @property warn Sink for option warnings; messages never contain option values.
 */
internal class FidoCredentialManagerSignInCustomizer(
  private val spec: FidoCredentialManagerSignInSpec,
  private val warn: (String) -> Unit
) {

  /**
   * Builds the option to use for the authentication ceremony.
   *
   * @param original Option built by the native FIDO client.
   * @return An option with the spec applied, or [original] when nothing is set or a value is invalid.
   * @throws IllegalArgumentException when the original `requestJson` is not a JSON object, which
   *   cannot occur for options built by the native SDK from its own JSON input.
   */
  fun customize(original: GetPublicKeyCredentialOption): GetPublicKeyCredentialOption {
    if (spec == FidoCredentialManagerSignInSpec()) {
      return original
    }
    val clientDataHash = spec.clientDataHash
      ?.let { FidoClientDataHash.decode(it, FidoClientDataHash.Target.SIGN_IN, warn) ?: return original }
      ?: original.clientDataHash
    val requestJson = spec.requestJsonPatch
      ?.let { FidoJsonMergePatch.applyToText(original.requestJson, it) }
      ?: original.requestJson
    return GetPublicKeyCredentialOption(
      requestJson = requestJson,
      clientDataHash = clientDataHash,
      allowedProviders = spec.allowedProviders?.let { parseProviders(it) } ?: original.allowedProviders
    )
  }

  private fun parseProviders(flattened: List<String>): Set<ComponentName> {
    return flattened.mapIndexedNotNull { index, name ->
      ComponentName.unflattenFromString(name)
        ?: run {
          warn(
            "FIDO sign-in option 'allowedProviders[$index]' is not a valid component name " +
              "(String of length ${name.length}); the entry is ignored"
          )
          null
        }
    }.toSet()
  }
}
