/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.registries

import com.pingidentity.journey.*
import java.util.UUID

object JourneyRegistry {
    // TODO Guard with Mutex
    private val instances = mutableMapOf<String, Journey>()

    fun create(config: Journey): String {
        val id = java.util.UUID.randomUUID().toString()
        instances[id] = config
        return id
    }

    fun get(id: String): Journey? = instances[id]

    fun remove(id: String) {
        instances.remove(id)
    }

    fun listIds(): Set<String> = instances.keys
}
