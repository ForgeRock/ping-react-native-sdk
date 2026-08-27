/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// A closure that returns the callbacks for a running Journey instance.
public typealias JourneyCallbackResolver = @Sendable (String) async -> [Any]?

/// A closure that returns the collectors for a running DaVinci instance.
public typealias DaVinciCollectorResolver = @Sendable (String) async -> [Any]?

/// A closure invoked inside the DaVinci builder to register a plugin-provided native module.
public typealias DaVinciModuleHook = @Sendable (Any) -> Void

/// A closure that serializes a plugin collector (e.g. IdpCollector) to a bridge payload map.
/// Returns `nil` when the collector type is not handled.
public typealias DaVinciCollectorSerializer = @Sendable (Any) -> [String: Any]?

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

/// Thread-safe keyed store for DaVinci module hooks.
///
/// - Note: `@unchecked Sendable` — mutable dictionary guarded by `NSLock`.
private final class DaVinciModuleHookStore: @unchecked Sendable {
    private let lock = NSLock()
    private var hooks: [String: DaVinciModuleHook] = [:]

    func set(key: String, hook: @escaping DaVinciModuleHook) {
        lock.lock()
        hooks[key] = hook
        lock.unlock()
    }

    func all() -> [DaVinciModuleHook] {
        lock.lock()
        let current = Array(hooks.values)
        lock.unlock()
        return current
    }
}

/// Thread-safe list store for DaVinci collector serializers.
///
/// - Note: `@unchecked Sendable` — mutable array guarded by `NSLock`.
private final class DaVinciCollectorSerializerStore: @unchecked Sendable {
    private let lock = NSLock()
    private var serializers: [DaVinciCollectorSerializer] = []

    func add(_ serializer: @escaping DaVinciCollectorSerializer) {
        lock.lock()
        serializers.append(serializer)
        lock.unlock()
    }

    func all() -> [DaVinciCollectorSerializer] {
        lock.lock()
        let current = serializers
        lock.unlock()
        return current
    }
}

/// Thread-safe storage for the optional DaVinci collector resolver.
///
/// - Note: `@unchecked Sendable` is used because this class stores a mutable
///   closure reference that Swift cannot prove sendable. Access is serialized
///   with `NSLock`, so cross-thread mutation/read is synchronized.
private final class DaVinciCollectorResolverStore: @unchecked Sendable {
    private let lock = NSLock()
    private var resolver: DaVinciCollectorResolver?

    func set(_ resolver: DaVinciCollectorResolver?) {
        lock.lock()
        self.resolver = resolver
        lock.unlock()
    }

    func get() -> DaVinciCollectorResolver? {
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

    /// Registry for DaVinci client instances.
    public static let davinciRegistry: Registry = SimpleRegistry()

    /// Internal resolver store used to avoid shared mutable global state.
    private static let journeyCallbackResolverStore = JourneyCallbackResolverStore()

    /// Internal DaVinci collector resolver store.
    private static let davinciCollectorResolverStore = DaVinciCollectorResolverStore()

    /// Internal store for DaVinci module hooks.
    private static let davinciModuleHookStore = DaVinciModuleHookStore()

    /// Internal store for DaVinci collector serializers.
    private static let davinciCollectorSerializerStore = DaVinciCollectorSerializerStore()

    /// Registers or clears the resolver that exposes Journey callbacks to other packages.
    ///
    /// Packages that need Journey callbacks (binding, fido, device-profile) cannot depend
    /// on `rn-journey` directly — this indirection lets Journey inject its lookup at init
    /// time without creating a circular dependency.
    ///
    /// - Parameter resolver: Resolver closure to register, or `nil` to clear.
    public static func setJourneyCallbackResolver(_ resolver: JourneyCallbackResolver?) {
        journeyCallbackResolverStore.set(resolver)
    }

    /// Resolves Journey callbacks for the given journey instance via the registered resolver.
    public static func resolveJourneyCallbacks(
        _ journeyId: String
    ) async -> [Any]? {
        guard let resolver = journeyCallbackResolverStore.get() else {
            return nil
        }
        return await resolver(journeyId)
    }

    /// Registers or replaces a plugin module hook for the given key.
    ///
    /// Hooks are invoked by `invokeDaVinciModuleHooks` inside the DaVinci builder at
    /// `configureDaVinci` time. Using a keyed store prevents accumulation when the same
    /// plugin re-registers on each `createDaVinciClient` call.
    ///
    /// - Parameters:
    ///   - key: Stable hook identity.
    ///   - hook: Closure that receives the DaVinci builder instance.
    public static func registerDaVinciModuleHook(key: String, _ hook: @escaping DaVinciModuleHook) {
        davinciModuleHookStore.set(key: key, hook: hook)
    }

    /// Invokes all registered module hooks with the given DaVinci builder instance.
    ///
    /// - Parameter builder: Native DaVinci builder instance (type-erased).
    public static func invokeDaVinciModuleHooks(with builder: Any) {
        davinciModuleHookStore.all().forEach { $0(builder) }
    }

    /// Registers a collector serializer.
    ///
    /// Serializers are polled in registration order; the first non-`nil` result wins.
    /// Register at module init time — not per DaVinci instance.
    ///
    /// - Parameter serializer: Closure that serializes a collector, or returns `nil` when not handled.
    public static func registerDaVinciCollectorSerializer(_ serializer: @escaping DaVinciCollectorSerializer) {
        davinciCollectorSerializerStore.add(serializer)
    }

    /// Serializes a collector using the first registered serializer that handles it.
    ///
    /// - Parameter collector: Collector instance to serialize.
    /// - Returns: Bridge payload map, or `nil` when no serializer handles the type.
    public static func serializeDaVinciCollector(_ collector: Any) -> [String: Any]? {
        return davinciCollectorSerializerStore.all().lazy.compactMap { $0(collector) }.first
    }

    /// Registers or clears the resolver that exposes DaVinci collectors to other packages.
    ///
    /// Plugin packages (external-idp, protect) cannot depend on `rn-davinci` directly —
    /// this indirection lets DaVinci inject its collector lookup at init time without
    /// creating a circular dependency.
    ///
    /// - Parameter resolver: Resolver closure to register, or `nil` to clear.
    public static func setDaVinciCollectorResolver(_ resolver: DaVinciCollectorResolver?) {
        davinciCollectorResolverStore.set(resolver)
    }

    /// Resolves DaVinci collectors for the given DaVinci instance via the registered resolver.
    public static func resolveDaVinciCollectors(
        _ davinciId: String
    ) async -> [Any]? {
        guard let resolver = davinciCollectorResolverStore.get() else {
            return nil
        }
        return await resolver(davinciId)
    }
}
