/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore

import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.registry.SimpleRegistry

/**
 * Central place to hold process-wide registries and shared helpers used by the core module.
 *
 * Keeps native handles alive across calls from the React Native bridge.
 */
public typealias JourneyCallbackResolver = suspend (String) -> List<Any>?
public typealias DaVinciCollectorResolver = suspend (String) -> List<Any>?

/** Closure invoked inside the DaVinci builder to register a plugin-provided native module. */
public typealias DaVinciModuleHook = (Any) -> Unit

/** Closure that serializes a plugin collector (e.g. IdpCollector) to a bridge payload map. Returns null when the collector type is not handled. */
public typealias DaVinciCollectorSerializer = (Any) -> Map<String, Any?>?

object CoreRuntime {
    /** Registry for session storage configuration */
    val sessionStorageConfigRegistry: Registry = SimpleRegistry()

    /** Registry for OIDC storage configuration */
    val oidcStorageConfigRegistry: Registry = SimpleRegistry()
    /** Registry for binding user-key storage configuration */
    val bindingUserKeyStorageConfigRegistry: Registry = SimpleRegistry()
    /** Registry for OATH storage configuration */
    val oathStorageConfigRegistry: Registry = SimpleRegistry()
    /** Registry for OATH policy evaluator configuration */
    val oathPolicyEvaluatorRegistry: Registry = SimpleRegistry()

    /** Registry for push MFA storage configuration */
    val pushStorageConfigRegistry: Registry = SimpleRegistry()

    /** Registry for logger instances */
    val loggerRegistry: Registry = SimpleRegistry()
    /** Registry for OIDC client configurations */
    val oidcClientRegistry: Registry = SimpleRegistry()
    /** Registry for OIDC web clients */
    val oidcWebClientRegistry: Registry = SimpleRegistry()
    /** Registry for Journey client instances */
    val journeyRegistry: Registry = SimpleRegistry()
    /** Registry for DaVinci client instances */
    val davinciRegistry: Registry = SimpleRegistry()

    /** Resolver that exposes Journey callbacks to other packages. */
    @Volatile
    var journeyCallbackResolver: JourneyCallbackResolver? = null

    /** Resolver that exposes DaVinci collectors to other packages. */
    @Volatile
    var davinciCollectorResolver: DaVinciCollectorResolver? = null

    /** Module hooks keyed by module name; registered by plugin packages at module init. */
    private val davinciModuleHooks = mutableMapOf<String, DaVinciModuleHook>()

    /** Collector serializers registered by plugin packages at module init. */
    private val davinciCollectorSerializers = mutableListOf<DaVinciCollectorSerializer>()

    /**
     * Registers or replaces a plugin module hook for the given key.
     *
     * Hooks are invoked by `invokeDaVinciModuleHooks` inside the DaVinci builder at
     * `configureDaVinci` time. Using a keyed map prevents accumulation when the same
     * plugin registers a fresh hook on each `createDaVinciClient` call.
     *
     * @param key Stable hook identity.
     * @param hook Closure that receives the DaVinci builder instance.
     */
    fun registerDaVinciModuleHook(key: String, hook: DaVinciModuleHook) {
        synchronized(davinciModuleHooks) { davinciModuleHooks[key] = hook }
    }

    /**
     * Invokes all registered module hooks with the given DaVinci builder instance.
     *
     * @param builder Native DaVinci builder instance (type-erased to avoid coupling).
     */
    fun invokeDaVinciModuleHooks(builder: Any) {
        val hooks = synchronized(davinciModuleHooks) { davinciModuleHooks.values.toList() }
        hooks.forEach { it(builder) }
    }

    /**
     * Registers a collector serializer.
     *
     * Serializers are polled in registration order; the first non-null result wins.
     * Register at module init time — not per DaVinci instance.
     *
     * @param serializer Closure that serializes a collector to a bridge payload map,
     *   or returns `null` when the collector type is not handled.
     */
    fun registerDaVinciCollectorSerializer(serializer: DaVinciCollectorSerializer) {
        synchronized(davinciCollectorSerializers) { davinciCollectorSerializers.add(serializer) }
    }

    /**
     * Serializes a collector using the first registered serializer that handles it.
     *
     * @param collector Collector instance to serialize.
     * @return Bridge payload map, or `null` when no serializer handles the type.
     */
    fun serializeDaVinciCollector(collector: Any): Map<String, Any?>? {
        val serializers = synchronized(davinciCollectorSerializers) { davinciCollectorSerializers.toList() }
        return serializers.firstNotNullOfOrNull { it(collector) }
    }

    /**
     * Resolves callbacks for the provided Journey id via the registered resolver.
     *
     * Packages that need Journey callbacks (binding, fido, device-profile) cannot depend
     * on rn-journey directly — this indirection lets Journey inject its lookup at init
     * time without creating a circular dependency.
     */
    suspend fun resolveJourneyCallbacks(journeyId: String): List<Any>? =
        journeyCallbackResolver?.invoke(journeyId)

    /**
     * Resolves collectors for the provided DaVinci id via the registered resolver.
     *
     * Plugin packages (external-idp, protect) cannot depend on rn-davinci directly —
     * this indirection lets DaVinci inject its collector lookup at init time without
     * creating a circular dependency.
     *
     * @param davinciId registered daVinciId whose collectors should be resolved
     */
    suspend fun resolveDaVinciCollectors(davinciId: String): List<Any>? =
        davinciCollectorResolver?.invoke(davinciId)
}
