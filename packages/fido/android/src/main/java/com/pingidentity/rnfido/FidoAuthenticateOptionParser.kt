/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.pingidentity.rncore.utils.JsonBridgeMapper

/**
 * Reads the Android authentication option blocks (`credentialManager` and `playServices`)
 * from a bridge option map.
 *
 * Every invalid value is reported through the reader before it is dropped; values are never
 * included in the warnings.
 */
internal object FidoAuthenticateOptionParser {
  private const val REQUEST_JSON_KEY = "requestJson"
  private const val CLIENT_DATA_HASH_KEY = "clientDataHash"
  private const val ALLOWED_PROVIDERS_KEY = "allowedProviders"
  private const val TIMEOUT_SECONDS_KEY = "timeoutSeconds"
  private const val REQUEST_ID_KEY = "requestId"
  private const val AUTHENTICATION_EXTENSIONS_KEY = "authenticationExtensions"
  private const val FIDO_APP_ID_KEY = "fidoAppId"
  private const val USER_VERIFICATION_METHOD_KEY = "userVerificationMethod"
  private const val TRANSPORTS_KEY = "transports"

  private val SIGN_IN_KEYS = setOf(REQUEST_JSON_KEY, CLIENT_DATA_HASH_KEY, ALLOWED_PROVIDERS_KEY)
  private val PLAY_SERVICES_KEYS = setOf(
    TIMEOUT_SECONDS_KEY,
    REQUEST_ID_KEY,
    AUTHENTICATION_EXTENSIONS_KEY,
    TRANSPORTS_KEY
  )
  private val EXTENSION_KEYS = setOf(FIDO_APP_ID_KEY, USER_VERIFICATION_METHOD_KEY)

  /**
   * Parses the Credential Manager sign-in block.
   *
   * @param reader Reader scoped to `android.credentialManager`.
   * @return The parsed spec; fields that were absent or invalid are null.
   */
  fun credentialManager(reader: FidoOptionReader): FidoCredentialManagerSignInSpec {
    val spec = FidoCredentialManagerSignInSpec(
      requestJsonPatch = reader.map(REQUEST_JSON_KEY)?.let { JsonBridgeMapper.decodeReadableMap(it) },
      clientDataHash = reader.string(CLIENT_DATA_HASH_KEY),
      allowedProviders = reader.stringList(ALLOWED_PROVIDERS_KEY)
    )
    reader.warnUnknownKeys(SIGN_IN_KEYS)
    return spec
  }

  /**
   * Parses the Play Services request block.
   *
   * @param reader Reader scoped to `android.playServices`.
   * @return The parsed spec; fields that were absent or invalid are null.
   */
  fun playServices(reader: FidoOptionReader): FidoPlayServicesRequestSpec {
    val extensions = reader.child(AUTHENTICATION_EXTENSIONS_KEY)
    val spec = FidoPlayServicesRequestSpec(
      timeoutSeconds = timeoutSeconds(reader),
      requestId = requestId(reader),
      fidoAppId = extensions?.string(FIDO_APP_ID_KEY),
      userVerificationMethod = extensions?.boolean(USER_VERIFICATION_METHOD_KEY),
      transports = reader.stringList(TRANSPORTS_KEY)
    )
    extensions?.warnUnknownKeys(EXTENSION_KEYS)
    reader.warnUnknownKeys(PLAY_SERVICES_KEYS)
    return spec
  }

  private fun timeoutSeconds(reader: FidoOptionReader): Double? {
    val seconds = reader.number(TIMEOUT_SECONDS_KEY) ?: return null
    if (!seconds.isFinite() || seconds <= 0.0) {
      reader.warnIfPresent(TIMEOUT_SECONDS_KEY, "a positive number of seconds is expected and the option is ignored")
      return null
    }
    return seconds
  }

  private fun requestId(reader: FidoOptionReader): Int? {
    val id = reader.number(REQUEST_ID_KEY) ?: return null
    val integer = id.toInt()
    if (integer.toDouble() != id) {
      reader.warnIfPresent(REQUEST_ID_KEY, "a 32-bit integer is expected and the option is ignored")
      return null
    }
    return integer
  }
}
