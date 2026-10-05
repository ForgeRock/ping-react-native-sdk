/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation

/// Builds the JS-facing `clientError` payload carried by a DaVinci FIDO ceremony rejection.
///
/// The native DaVinci FIDO collectors record a WebAuthn DOMException name on `errorCode`
/// when a ceremony fails (`AbstractFidoCollector.handleError`). The bridge forwards that
/// name to JS as the `clientError` key of the rejection userInfo so apps can branch on
/// the client-side outcome without changing the existing rejection codes.
/// DaVinci-scoped only: standalone and Journey FIDO rejections carry no extras.
///
/// - Note: Stateless and pure; `errorCode` is read on the main actor where the ceremony
///   completes. The iOS collector's error name set is closed at five WebAuthn
///   DOMException names while Android's is open; both are forwarded verbatim.
enum FidoClientErrorMapper {

  /// Key under which the client error name is placed in the rejection userInfo.
  static let extraKey = "clientError"

  /// Builds the rejection extras from the collector's recorded error code.
  ///
  /// - Parameters:
  ///   - errorCode: WebAuthn DOMException name recorded by the native collector
  ///     (`AbstractFidoCollector.errorCode`), or `nil` when the ceremony failed
  ///     without recording one.
  ///   - warn: Called with a diagnostic message when the failure carries no client
  ///     error code, so the dropped extra is never silent.
  /// - Returns: A single-entry dictionary with `extraKey` when `errorCode` is
  ///   non-blank, otherwise `nil`.
  static func extras(errorCode: String?, warn: (String) -> Void) -> [String: String]? {
    guard let errorCode, !errorCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      warn("FIDO DaVinci ceremony failed but the collector recorded no client error code")
      return nil
    }
    return [extraKey: errorCode]
  }

  /// Merges the rejection extras into the underlying native error's userInfo.
  ///
  /// `PromiseBridge.reject` forwards the underlying NSError to JS in preference to the
  /// `GenericError` payload, so the extras must ride inside its userInfo to reach the
  /// rejection's userInfo map. The original domain and code are preserved unchanged.
  ///
  /// - Parameters:
  ///   - error: Native error thrown by the ceremony.
  ///   - extras: Rejection extras to merge; `nil` or empty leaves the error unchanged.
  /// - Returns: An `NSError` with the original domain and code and the extras merged
  ///   into its userInfo.
  static func underlying(_ error: Error, extras: [String: String]?) -> NSError {
    let nsError = error as NSError
    guard let extras, !extras.isEmpty else {
      return nsError
    }
    var userInfo = nsError.userInfo
    extras.forEach { userInfo[$0.key] = $0.value }
    return NSError(domain: nsError.domain, code: nsError.code, userInfo: userInfo)
  }
}
