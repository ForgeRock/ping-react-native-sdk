/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.config

/**
 * Parsed DaVinci client configuration supplied by JavaScript.
 *
 * @param oidc Required OIDC module configuration.
 * @param timeout Optional network timeout in milliseconds.
 * @param loggerId Optional logger handle id.
 * @param protect Optional Protect lifecycle module configuration.
 */
internal data class DaVinciClientPayload(
    val oidc: DaVinciOidcPayload,
    val timeout: Long?,
    val loggerId: String?,
    val protect: ProtectLifecyclePayload?,
)
