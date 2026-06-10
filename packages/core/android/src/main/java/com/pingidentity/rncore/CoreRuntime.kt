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

    /** Resolver that exposes Journey callbacks to other packages. */
    @Volatile
    var journeyCallbackResolver: JourneyCallbackResolver? = null

    /**
     * Resolves callbacks for the provided Journey id via the registered resolver.
     *
     * Packages that need Journey callbacks (binding, fido, device-profile) cannot depend
     * on rn-journey directly — this indirection lets Journey inject its lookup at init
     * time without creating a circular dependency.
     */
    suspend fun resolveJourneyCallbacks(journeyId: String): List<Any>? =
        journeyCallbackResolver?.invoke(journeyId)
}
