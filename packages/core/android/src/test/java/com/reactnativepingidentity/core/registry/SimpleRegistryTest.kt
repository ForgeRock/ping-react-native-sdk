/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.registry

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotEquals
import org.junit.Test

private class FakeHandle : NativeHandle

class SimpleRegistryTest {

    @Test
    fun registerAndResolveReturnsSameInstance() = runTest {
        val registry: Registry = SimpleRegistry()
        val handle = FakeHandle()

        val id = registry.register(handle)
        val resolved = registry.resolve(id)

        assertEquals(handle, resolved)
    }

    @Test
    fun registerProducesDistinctIds() = runTest {
        val registry: Registry = SimpleRegistry()
        val id1 = registry.register(FakeHandle())
        val id2 = registry.register(FakeHandle())

        assertNotEquals("IDs should be unique", id1, id2)
    }

    @Test
    fun removeDropsHandle() = runTest {
        val registry: Registry = SimpleRegistry()
        val id = registry.register(FakeHandle())

        registry.remove(id)

        assertNull(registry.resolve(id))
    }

    @Test
    fun removeAllClearsRegistry() = runTest {
        val registry: Registry = SimpleRegistry()
        val first = registry.register(FakeHandle())
        val second = registry.register(FakeHandle())

        registry.removeAll()

        assertNull(registry.resolve(first))
        assertNull(registry.resolve(second))
    }
}
