/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/// Canonical device-kind keys used by the RN bridge contract.
internal enum DeviceType {
  static let oath = "oath"
  static let push = "push"
  static let bound = "bound"
  static let profile = "profile"
  static let webAuthn = "webAuthn"
}
