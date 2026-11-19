/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.google.android.gms.fido.common.Transport
import com.google.android.gms.fido.fido2.api.common.AuthenticationExtensions
import com.google.android.gms.fido.fido2.api.common.FidoAppIdExtension
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialDescriptor
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialRequestOptions
import com.google.android.gms.fido.fido2.api.common.UserVerificationMethodExtension
import com.pingidentity.fido.FidoAuthenticateCustomizer

/**
 * Applies a [FidoPlayServicesRequestSpec] to the Play Services `PublicKeyCredentialRequestOptions`
 * built by the native FIDO client.
 *
 * This is the only class that touches Play Services types, so hosts that never use the Play
 * Services path never load them. The replacement is built from the original request, so any
 * field the spec leaves unset keeps the original value.
 *
 * The transport list replaces the transports of every allowed credential. The native SDK
 * assigns `Transport.INTERNAL` to all of them and ignores any transports sent by the server.
 *
 * @property spec Overrides to apply.
 * @property warn Sink for option warnings; messages never contain option values or credential ids.
 */
internal class FidoPlayServicesRequestCustomizer(
  private val spec: FidoPlayServicesRequestSpec,
  private val warn: (String) -> Unit
) {

  /**
   * Registers this customizer on the native authenticate customizer.
   *
   * @param target Native customizer whose Play Services hook is replaced.
   */
  fun install(target: FidoAuthenticateCustomizer) {
    target.onPublicKeyCredentialRequestOptions(::customize)
  }

  /**
   * Builds the request options to use for the authentication ceremony.
   *
   * @param original Options built by the native FIDO client.
   * @return Options with the spec applied.
   * @throws IllegalArgumentException when Play Services rejects an assembled value.
   */
  fun customize(original: PublicKeyCredentialRequestOptions): PublicKeyCredentialRequestOptions {
    val builder = PublicKeyCredentialRequestOptions.Builder(original)
    spec.timeoutSeconds?.let { builder.setTimeoutSeconds(it) }
    spec.requestId?.let { builder.setRequestId(it) }
    if (spec.fidoAppId != null || spec.userVerificationMethod != null) {
      builder.setAuthenticationExtensions(extensions(original.authenticationExtensions))
    }
    spec.transports?.let { names -> allowList(original.allowList, names)?.let { builder.setAllowList(it) } }
    return builder.build()
  }

  private fun extensions(original: AuthenticationExtensions?): AuthenticationExtensions {
    val builder = original?.let { AuthenticationExtensions.Builder(it) } ?: AuthenticationExtensions.Builder()
    spec.fidoAppId?.let { builder.setFido2Extension(FidoAppIdExtension(it)) }
    spec.userVerificationMethod?.let {
      builder.setUserVerificationMethodExtension(UserVerificationMethodExtension(it))
    }
    return builder.build()
  }

  private fun allowList(
    original: List<PublicKeyCredentialDescriptor>?,
    names: List<String>
  ): List<PublicKeyCredentialDescriptor>? {
    val descriptors = original.orEmpty()
    if (descriptors.isEmpty()) {
      warn("FIDO transports ignored: the request has no allowed credentials (Array of length ${names.size})")
      return original
    }
    val transports = parseTransports(names)
    if (transports.isEmpty()) {
      warn("FIDO transports contain no valid transport (Array of length ${names.size}); the native transports are kept")
      return original
    }
    return descriptors.map { PublicKeyCredentialDescriptor(it.typeAsString, it.id, transports) }
  }

  private fun parseTransports(names: List<String>): List<Transport> {
    return names.mapIndexedNotNull { index, name ->
      try {
        Transport.fromString(name)
      } catch (e: Transport.UnsupportedTransportException) {
        warn("FIDO transports[$index] is not a supported transport (String of length ${name.length}); the entry is ignored")
        null
      }
    }.distinct()
  }
}
