/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// A closure that returns the callbacks for a running Journey instance.
public typealias JourneyCallbackResolver = @Sendable (String) async -> [Any]?

/// Thread-safe storage for the optional Journey callback resolver.
///
/// - Note: `@unchecked Sendable` is used because this class stores a mutable
///   closure reference that Swift cannot prove sendable. Access is serialized
///   with `NSLock`, so cross-thread mutation/read is synchronized.
private final class JourneyCallbackResolverStore: @unchecked Sendable {
    private let lock = NSLock()
    private var resolver: JourneyCallbackResolver?

    func set(_ resolver: JourneyCallbackResolver?) {
        lock.lock()
        self.resolver = resolver
        lock.unlock()
    }

    func get() -> JourneyCallbackResolver? {
        lock.lock()
        let current = resolver
        lock.unlock()
        return current
    }
}

/// Central place to hold process-wide registries used by the core module.
///
/// Keeps native handles alive across calls from the React Native bridge.
public enum CoreRuntime {
    /// Registry for session storage configuration (used by Journey for SSO tokens)
    public static let sessionStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for OIDC storage configuration (used for OAuth/OIDC tokens)
    public static let oidcStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for binding user-key storage configuration
    public static let bindingUserKeyStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for push MFA storage configuration
    public static let pushStorageConfigRegistry: Registry = SimpleRegistry()
    /// Registry for OATH storage configuration
    public static let oathStorageConfigRegistry: Registry = SimpleRegistry()

    /// Registry for OATH policy evaluator configuration
    public static let oathPolicyEvaluatorRegistry: Registry = SimpleRegistry()

    /// Registry for logger instances
    public static let loggerRegistry: Registry = SimpleRegistry()

    /// Registry for OIDC client configurations.
    ///
    /// Modules that compose with OIDC (for example Journey) resolve shared
    /// configuration handles from this registry.
    public static let oidcClientRegistry: Registry = SimpleRegistry()

    /// Registry for OIDC web clients.
    public static let oidcWebClientRegistry: Registry = SimpleRegistry()

    /// Registry for Journey client instances.
    public static let journeyRegistry: Registry = SimpleRegistry()

    /// Internal resolver store used to avoid shared mutable global state.
    private static let journeyCallbackResolverStore = JourneyCallbackResolverStore()

    /// Registers or clears the resolver that exposes Journey callbacks.
    /// TODO: Remove once journey module matures and types package is available.
    ///
    /// - Parameter resolver: Resolver closure to register, or `nil` to clear.
    public static func setJourneyCallbackResolver(_ resolver: JourneyCallbackResolver?) {
        journeyCallbackResolverStore.set(resolver)
    }

    /// Convenience helper for resolving callbacks via the registered resolver.
    /// TODO: Replace this global resolver with a synchronous Journey handle contract resolved
    /// through `journeyRegistry`; callback access is an in-memory ContinueNode lookup.
    /// Resolving the handle from the actor-isolated registry may still require `async`.
    public static func resolveJourneyCallbacks(
        _ journeyId: String
    ) async -> [Any]? {
        guard let resolver = journeyCallbackResolverStore.get() else {
            return nil
        }
        return await resolver(journeyId)
    }
}
