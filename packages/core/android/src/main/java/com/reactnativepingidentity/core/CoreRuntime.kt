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
 * Central place to hold process-wide registries used by the core module.
 *
 * Keeps native handles alive across calls from the React Native bridge.
 */
object CoreRuntime {
    /** Registry for session storage configuration */
    val sessionStorageConfigRegistry: Registry = SimpleRegistry()

    /** Registry for OIDC storage configuration */
    val oidcStorageConfigRegistry: Registry = SimpleRegistry()
    /** Registry for logger instances */
    val loggerRegistry: Registry = SimpleRegistry()
    /** Registry for OIDC client configurations */
    val oidcClientRegistry: Registry = SimpleRegistry()
    /** Registry for OIDC web clients */
    val oidcWebClientRegistry: Registry = SimpleRegistry()
    // val mfaRegistry: Registry = SimpleRegistry()
}
