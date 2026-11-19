/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import java.util.Base64

/** Strict base64url decoding of the `clientDataHash` override shared by the option customizers. */
internal object FidoClientDataHash {

  /**
   * Wording of the warning emitted for an invalid hash.
   *
   * @property optionLabel Name of the customized option as it appears in the message.
   * @property originalLabel Name of the original value that is kept, as it appears in the message.
   */
  enum class Target(val optionLabel: String, val originalLabel: String) {
    CREATE_REQUEST("create request", "request"),
    SIGN_IN("sign-in", "option")
  }

  /**
   * Decodes a base64url client data hash, with or without padding.
   *
   * @param encoded Encoded text.
   * @param target Customized option, used to word the warning.
   * @param warn Sink for the warning; the message never contains the encoded value.
   * @return The decoded bytes, or null when the text is not valid base64url or decodes to nothing.
   */
  fun decode(encoded: String, target: Target, warn: (String) -> Unit): ByteArray? {
    val decoded = runCatching { Base64.getUrlDecoder().decode(encoded) }
      .getOrNull()
      ?.takeIf { it.isNotEmpty() }
    if (decoded == null) {
      warn(
        "FIDO ${target.optionLabel} option 'clientDataHash' is not valid base64url " +
          "(String of length ${encoded.length}); the original ${target.originalLabel} is kept"
      )
    }
    return decoded
  }
}
