/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import LineSDK
import PingExternalIdP

/// Custom external IdP handler that authenticates users through LINE Login.
///
/// Registered under the provider name `line` at app startup so the
/// `@ping-identity/rn-external-idp` registry routes that provider here. The
/// LINE channel ID comes from the Journey callback (`idpClient.clientId`),
/// never from a local constant, mirroring the native built-in handlers.
///
/// The handler submits the OIDC ID token to the Journey callback, so the
/// `openid` permission must be part of the authorization: when the server sends
/// no scopes, `openid` is requested by default. A login that completes without
/// an ID token fails with a clear error instead of substituting the access
/// token, whose token type would not match `id_token`.
///
/// The protocol requirement is nonisolated, so `authorize` runs off the main
/// actor and hops to the main actor only for the LINE login call, which
/// presents UI.
///
/// - Note: `@unchecked Sendable` because the `IdpHandler` protocol requires a
///   settable `tokenType` that is never mutated after init, and the only other
///   mutable state, `configuredChannelID`, is guarded by `lock`.
final class LineIdpHandler: IdpHandler, @unchecked Sendable {
  var tokenType: String = "id_token"

  private let lock = NSLock()
  private var configuredChannelID: String?

  /// Runs the LINE Login flow for the given Journey callback configuration.
  ///
  /// The flow is app-to-app when the LINE app is installed, otherwise it falls
  /// back to LINE's web login. User dismissal throws
  /// `IdpExceptions.idpCanceledException` per the SDK convention, but on iOS
  /// the native `IdpCallback` catch-all wraps handler-thrown errors as
  /// `illegalStateException`, so the bridge surfaces it as
  /// `EXTERNAL_IDP_AUTHORIZE_ERROR` rather than a cancelled code.
  /// - Parameter idpClient: Client configuration from the Journey callback;
  ///   `clientId` is the LINE channel ID, `scopes` the requested LINE
  ///   permissions (defaults to `openid` when empty), and `nonce` the
  ///   anti-replay value forwarded to the ID token when present.
  /// - Returns: Result carrying the ID token issued by LINE.
  /// - Throws: `IdpExceptions.illegalArgumentException` when the channel ID is
  ///   blank, `IdpExceptions.idpCanceledException` when the user cancels, and
  ///   `IdpExceptions.illegalStateException` when LINE reports an error or
  ///   completes without an ID token.
  func authorize(idpClient: IdpClient) async throws -> IdpResult {
    let channelID = idpClient.clientId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !channelID.isEmpty else {
      throw IdpExceptions.illegalArgumentException(message: "LINE channel ID is required")
    }

    let scopes = idpClient.scopes.isEmpty ? ["openid"] : idpClient.scopes
    let nonce = idpClient.nonce.flatMap { $0.isEmpty ? nil : $0 }
    let idToken = try await login(channelID: channelID, scopes: scopes, nonce: nonce)

    guard let idToken, !idToken.isEmpty else {
      throw IdpExceptions.illegalStateException(
        message: "LINE authorization completed but no ID token was returned; "
          + "the openid scope must be requested"
      )
    }
    return IdpResult(token: idToken, additionalParameters: [:])
  }

  @MainActor
  private func login(channelID: String, scopes: [String], nonce: String?) async throws -> String? {
    configure(channelID: channelID)

    var parameters = LoginManager.Parameters()
    parameters.IDTokenNonce = nonce
    parameters.allowRecreatingLoginProcess = true
    let permissions = Set(scopes.map { LoginPermission(rawValue: $0) })

    return try await withCheckedThrowingContinuation { continuation in
      let process = LoginManager.shared.login(
        permissions: permissions,
        parameters: parameters
      ) { result in
        switch result {
        case .success(let loginResult):
          continuation.resume(returning: loginResult.accessToken.IDTokenRaw)
        case .failure(let error):
          continuation.resume(throwing: Self.mapped(error))
        }
      }
      if process == nil {
        continuation.resume(
          throwing: IdpExceptions.illegalStateException(
            message: "LINE login could not be started"
          )
        )
      }
    }
  }

  /// The LINE SDK rejects a second `setup`, and the channel ID is only known
  /// once the Journey callback arrives, so setup runs once per channel ID.
  @MainActor
  private func configure(channelID: String) {
    lock.lock()
    defer { lock.unlock() }
    guard configuredChannelID != channelID else { return }
    if configuredChannelID != nil {
      LoginManager.shared.reset()
    }
    LoginManager.shared.setup(channelID: channelID, universalLinkURL: nil)
    configuredChannelID = channelID
  }

  private static func mapped(_ error: LineSDKError) -> IdpExceptions {
    if error.isUserCancelled {
      return .idpCanceledException(message: error.localizedDescription)
    }
    return .illegalStateException(message: "LINE authorization failed: \(error.localizedDescription)")
  }
}
