/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingExternalIdP

/// Errors thrown when registering a custom external IdP handler.
public enum IdpHandlerRegistrationError: LocalizedError, Sendable {
  /// The provider name is blank or contains a reserved built-in provider token.
  /// The associated value describes the reason.
  case reservedProvider(String)

  /// A localized description of the error, used by `LocalizedError`. Surfaces
  /// the associated message so `localizedDescription` returns the registration
  /// reason instead of the default enum error string.
  public var errorDescription: String? {
    switch self {
    case .reservedProvider(let message):
      return message
    }
  }
}

/// Process-scoped registry of app-registered custom `IdpHandler` implementations.
///
/// App code implements the native SDK's `PingExternalIdP.IdpHandler` protocol and
/// registers it at startup (typically `AppDelegate.didFinishLaunchingWithOptions`,
/// before any React context exists) so the authorize path in
/// `RNPingExternalIdpCommon` can route providers beyond the native built-ins
/// (google, facebook, apple/siwa).
///
/// - Note: Marked `@unchecked Sendable` because all mutable state (the handler
///   dictionary) is guarded by a single `NSLock`. A lock-protected class is used
///   instead of an actor because registration runs synchronously from
///   `didFinishLaunchingWithOptions`, which is not an async context; an actor
///   would force that call into a fire-and-forget `Task` that could race the
///   first authorize lookup.
final class IdpHandlerRegistry: @unchecked Sendable {

  /// Built-in provider tokens reserved by the native SDKs' case-insensitive
  /// `contains` matching. Registration for any name containing one of these is
  /// rejected so a custom handler can never shadow a built-in route. The list is
  /// the union of both platforms' tokens; `fb-limited` is only matched by the iOS
  /// built-ins but is reserved here too so registrations stay symmetric across
  /// platforms.
  private static let reservedTokens = [
    "apple", "siwa", "google", "facebook", "fb-limited"
  ]

  /// Shared process-scoped registry instance. Intentionally standalone rather
  /// than owned by a bridge module: registration happens once at app startup,
  /// and must survive React context teardowns and dev reloads.
  static let shared = IdpHandlerRegistry()

  /// Guards all access to `handlers`.
  private let lock = NSLock()

  /// Custom handlers keyed by trimmed lowercase provider name.
  private var handlers: [String: any IdpHandler] = [:]

  /// Creates an empty registry. Use `shared`; competing instances would split
  /// resolution.
  private init() {}

  /// Registers a custom handler for a provider name.
  ///
  /// Names are normalized to trimmed lowercase before storing, so `"LINE"`,
  /// `" line "`, and `"line"` resolve identically. Re-registering an
  /// already-registered custom name replaces the previous handler.
  ///
  /// - Parameters:
  ///   - provider: Custom provider name as supplied by the app.
  ///   - handler: Handler invoked when the authorize path resolves this provider.
  /// - Throws: `IdpHandlerRegistrationError.reservedProvider` when the name is
  ///   blank or contains a reserved built-in token (matched case-insensitively
  ///   as a substring, mirroring how the native built-ins route provider names).
  func register(_ provider: String, handler: any IdpHandler) throws {
    let normalized = provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !normalized.isEmpty else {
      throw IdpHandlerRegistrationError.reservedProvider(
        "Provider name must not be blank for external IdP handler registration."
      )
    }
    if let reserved = Self.reservedTokens.first(where: { normalized.contains($0) }) {
      throw IdpHandlerRegistrationError.reservedProvider(
        "Provider name '\(provider)' conflicts with the built-in "
          + "'\(reserved)' provider and cannot be registered."
      )
    }
    lock.lock()
    defer { lock.unlock() }
    handlers[normalized] = handler
  }

  /// Resolves the registered handler for a provider name.
  ///
  /// Matching is exact on the trimmed lowercase name; unknown providers return
  /// nil so the authorize path falls through to the native built-in resolution.
  ///
  /// - Parameter provider: Provider name from the active Journey callback.
  /// - Returns: The registered handler, or nil when no custom handler is
  ///   registered for the provider.
  func handler(for provider: String) -> (any IdpHandler)? {
    let normalized = provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    lock.lock()
    defer { lock.unlock() }
    return handlers[normalized]
  }

  /// Removes all registered handlers. Test seam only, the registry is
  /// process-scoped by design, so production code never resets it.
  func removeAll() {
    lock.lock()
    defer { lock.unlock() }
    handlers.removeAll()
  }
}
