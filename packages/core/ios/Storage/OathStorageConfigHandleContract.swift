/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Native handle contract for OATH storage configuration values.
///
/// OATH uses `OathKeychainStorage(service:logger:securityOptions:)` whose keychain params
/// (`service`, `requireBiometrics`, `requireDevicePasscode`, `biometricPrompt`, `accessGroup`)
/// are entirely different from binding's `cacheable`/`account`/`encryptor` fields. Extending
/// would corrupt keychain queries via `kSecAttrService` vs `kSecAttrAccount` conflation.
public protocol OathStorageConfigHandleContract: NativeHandle, Sendable {
  /// Keychain service identifier for the OATH credential store.
  var service: String? { get }

  /// Whether biometric authentication is required to access stored OATH tokens.
  var requireBiometrics: Bool? { get }

  /// Whether a device passcode is required to access stored OATH tokens.
  var requireDevicePasscode: Bool? { get }

  /// Localized prompt shown to the user during biometric authentication.
  var biometricPrompt: String? { get }

  /// Keychain access group for sharing OATH credentials across app extensions.
  var accessGroup: String? { get }
}
