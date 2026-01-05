/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.registry

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

/**
 * In-memory, coroutine-safe [Registry] backed by a [LinkedHashMap].
 *
 * Entries are keyed by generated UUID strings and guarded with a [Mutex]
 * to avoid concurrent mutations.
 */
class SimpleRegistry : Registry {
    private val mutex = Mutex()
    private val map = LinkedHashMap<String, NativeHandle>()

    /** Store the handle and return a fresh UUID key. */
    override suspend fun register(instance: NativeHandle): String = mutex.withLock {
        val id = UUID.randomUUID().toString()
        map[id] = instance
        id
    }

    /** Retrieve a handle by id, or null when missing. */
    override suspend fun resolve(id: String): NativeHandle? = mutex.withLock { map[id] }

    /** Remove a handle by id; no-op when it does not exist. */
    override suspend fun remove(id: String) {
        mutex.withLock { map.remove(id) }
    }

    /** Clear all stored handles. */
    override suspend fun removeAll() {
        mutex.withLock { map.clear() }
    }
}
