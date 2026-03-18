/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Shared native handle contract that exposes storage configuration values.
///
/// Modules that need to compose storage settings (for example OIDC and Journey)
/// can resolve this handle from Core registries without depending on storage
/// package internals.
public protocol StorageConfigHandleContract: NativeHandle {
  /// Whether storage should cache values.
  var cacheable: Bool? { get }

  /// Keychain account identifier.
  var account: String? { get }

  /// Whether encryption should be enabled.
  var encryptor: Bool? { get }
}
