/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core

import com.reactnativepingidentity.core.registry.Registry
import com.reactnativepingidentity.core.registry.SimpleRegistry

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

    /** Registry for logger instances */
    val loggerRegistry: Registry = SimpleRegistry()

    /** Resolver that exposes Journey callbacks to other packages. */
    @Volatile
    var journeyCallbackResolver: JourneyCallbackResolver? = null

    /**
     * Resolves callbacks for the provided Journey id via the registered resolver.
     * TODO: Remove this function once types package is available.
     */
    suspend fun resolveJourneyCallbacks(journeyId: String): List<Any>? =
        journeyCallbackResolver?.invoke(journeyId)

    // val mfaRegistry: Registry = SimpleRegistry()
}
