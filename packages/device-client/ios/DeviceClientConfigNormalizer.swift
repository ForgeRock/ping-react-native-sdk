/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Normalizes Device Client configuration values received from JS.
///
/// The native iOS SDK is strict about URL / realm formatting — a trailing
/// slash on `serverUrl` or a leading slash on `realm` causes the session
/// endpoint to return `400`. Normalization tolerates those inputs so that
/// JS callers can pass through user-supplied configuration as-is.
internal enum DeviceClientConfigNormalizer {

  /// Default realm used when the caller does not provide one.
  internal static let defaultRealm = "root"

  /// Trims whitespace and strips trailing `/` from the server URL.
  internal static func normalizeServerUrl(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return trimmed }
    var normalized = trimmed
    while normalized.hasSuffix("/") {
      normalized.removeLast()
    }
    return normalized
  }

  /// Trims whitespace and strips a leading `/` from the realm; defaults to ``defaultRealm``.
  internal static func normalizeRealm(_ value: String?) -> String {
    guard
      var normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines),
      !normalized.isEmpty
    else {
      return defaultRealm
    }
    while normalized.hasPrefix("/") {
      normalized.removeFirst()
    }
    return normalized.isEmpty ? defaultRealm : normalized
  }
}
