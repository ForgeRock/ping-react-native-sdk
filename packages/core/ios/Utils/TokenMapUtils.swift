/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Build JS-facing token payload maps.
public enum TokenMapUtils {
  /// Build a JS-facing token payload dictionary.
  ///
  /// - Parameters:
  ///   - accessToken: Required access token string.
  ///   - idToken: Optional ID token string.
  ///   - refreshToken: Optional refresh token string.
  ///   - tokenExpiry: Optional UNIX timestamp in seconds.
  public static func buildTokenMap(
    accessToken: String,
    idToken: String? = nil,
    refreshToken: String? = nil,
    tokenExpiry: Int64? = nil
  ) -> NSDictionary {
    var dict: [String: Any] = ["accessToken": accessToken]
    if let idToken { dict["idToken"] = idToken }
    if let refreshToken { dict["refreshToken"] = refreshToken }
    if let tokenExpiry { dict["tokenExpiry"] = tokenExpiry }
    return dict as NSDictionary
  }
}
