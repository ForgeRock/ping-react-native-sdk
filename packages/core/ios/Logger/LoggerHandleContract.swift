/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Shared native handle contract that exposes logger configuration values.
///
/// Modules that need to apply logger settings (for example OIDC and Journey)
/// can resolve this handle from ``CoreRuntime/loggerRegistry`` without
/// depending on logger package internals.
public protocol LoggerHandleContract: NativeHandle {
  /// Native logger level value.
  ///
  /// Expected values are `STANDARD`, `WARN`, and `NONE`.
  var loggerLevel: String { get }
}
