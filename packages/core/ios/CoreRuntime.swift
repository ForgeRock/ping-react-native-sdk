/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// A closure that returns the callbacks for a running Journey instance.
public typealias JourneyCallbackResolver = @Sendable (String) async -> [Any]?

/// Central place to hold process-wide registries used by the core module.
///
/// Keeps native handles alive across calls from the React Native bridge.
public enum CoreRuntime {
    /// Registry for session storage configuration (used by Journey for SSO tokens)
    public static let sessionStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for OIDC storage configuration (used for OAuth/OIDC tokens)
    public static let oidcStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for logger instances
    public static let loggerRegistry: Registry = SimpleRegistry()

    /// Resolver that exposes Journey callbacks so other packages can access them.
    /// TODO: Remove once journey module matures and types package is available.
    public static var journeyCallbackResolver: JourneyCallbackResolver?

    /// Convenience helper for resolving callbacks via the registered resolver.
    /// TODO: Remove once journey module matures and types package is available.
    public static func resolveJourneyCallbacks(
        _ journeyId: String
    ) async -> [Any]? {
        await journeyCallbackResolver?(journeyId)
    }
}
