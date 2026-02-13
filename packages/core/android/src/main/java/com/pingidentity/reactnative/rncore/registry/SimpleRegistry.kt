/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rncore.registry

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory, thread-safe [Registry] backed by a [ConcurrentHashMap].
 *
 * Entries are keyed by generated UUID strings.
 */
class SimpleRegistry : Registry {
    private val map = ConcurrentHashMap<String, NativeHandle>()

    /** Store the handle and return a fresh UUID key. */
    override fun register(instance: NativeHandle): String {
        val id = UUID.randomUUID().toString()
        map[id] = instance
        return id
    }

    /** Retrieve a handle by id, or null when missing. */
    override fun resolve(id: String): NativeHandle? = map[id]

    /** Remove a handle by id; no-op when it does not exist. */
    override fun remove(id: String) {
        map.remove(id)
    }

    /** Clear all stored handles. */
    override fun removeAll() {
        map.clear()
    }
}
