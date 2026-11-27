/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

/**
 * Overrides for the Play Services `PublicKeyCredentialRequestOptions` built during FIDO
 * authentication.
 *
 * Holds no Play Services types so that reading the configuration never loads them. A null
 * field keeps the value of the request the native SDK built. The spec being present selects
 * Play Services routing even when every field is null.
 *
 * Play Services offers no user verification setter, so none is modelled.
 *
 * @property timeoutSeconds Request timeout in seconds.
 * @property requestId Request id.
 * @property fidoAppId Legacy FIDO AppID extension value.
 * @property userVerificationMethod Whether to request the user verification method extension.
 * @property transports WebAuthn transport names, for example `usb`, `nfc` or `ble`, applied to
 *   every allowed credential.
 */
internal data class FidoPlayServicesRequestSpec(
  val timeoutSeconds: Double? = null,
  val requestId: Int? = null,
  val fidoAppId: String? = null,
  val userVerificationMethod: Boolean? = null,
  val transports: List<String>? = null
)
