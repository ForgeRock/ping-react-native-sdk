/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import PingExternalIdP

/// Stub external IdP handler proving that app code can implement the native
/// SDK's `PingExternalIdP.IdpHandler` protocol without a direct
/// `PingExternalIdP` Podfile entry (the module is available transitively
/// through the `RNPingExternalIdp` pod).
///
/// Returns a fixed token so nothing here is a real credential, and records
/// only the presence of the callback nonce in `additionalParameters` — never
/// the nonce value itself. The protocol requirement is nonisolated, so this
/// body runs off the main actor; the stub performs no UI or main-thread-bound
/// work.
///
/// `additionalParameters` entries are replayed as request parameters by the
/// native `IdpCallback` when the callback is submitted via `journey.next()`,
/// so anything placed there must be treated as server-visible.
///
/// - Note: `@unchecked Sendable` because the `IdpHandler` protocol requires a
///   settable `tokenType`; the stub never mutates it after init, making it
///   effectively immutable.
final class StubIdpHandler: IdpHandler, @unchecked Sendable {
  var tokenType: String = "id_token"

  /// Authorizes with a fixed token, recording only whether a nonce reached
  /// the handler.
  /// - Parameter idpClient: Native client payload created from the Journey callback.
  /// - Returns: Stubbed authorization result carrying the nonce-presence flag.
  func authorize(idpClient: IdpClient) async throws -> IdpResult {
    let noncePresent = !(idpClient.nonce?.isEmpty ?? true)
    return IdpResult(
      token: "stub-idp-token",
      additionalParameters: ["noncePresent": noncePresent ? "true" : "false"]
    )
  }
}
