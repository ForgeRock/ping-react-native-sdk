/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

/**
 * Canonical device-kind keys used by the RN bridge contract.
 */
internal object DeviceType {
  const val OATH = "oath"
  const val PUSH = "push"
  const val BOUND = "bound"
  const val PROFILE = "profile"
  const val WEB_AUTHN = "webAuthn"
}
