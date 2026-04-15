/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import AuthenticationServices
import UIKit

/// Shared resolver for locating an active presentation anchor window.
public enum PresentationAnchorResolver {
  /// Resolves an active foreground window suitable for AuthenticationServices UI.
  ///
  /// - Returns: Active `ASPresentationAnchor` when available, otherwise `nil`.
  @MainActor
  public static func resolveForegroundWindowAnchor() -> ASPresentationAnchor? {
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene,
            scene.activationState == .foregroundActive else {
        continue
      }
      if let keyWindow = windowScene.windows.first(where: { $0.isKeyWindow }) {
        return keyWindow
      }
      if let firstWindow = windowScene.windows.first {
        return firstWindow
      }
    }
    return nil
  }
}
