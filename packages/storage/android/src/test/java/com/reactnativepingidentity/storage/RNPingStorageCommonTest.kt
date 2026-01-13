/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.storage.Storage
import io.mockk.*
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class RNPingStorageCommonTest {

    private lateinit var mockContext: ReactApplicationContext
    private lateinit var filesDir: File

    @Before
    fun setUp() {
        MockKAnnotations.init(this)

        mockContext = mockk(relaxed = true)

        // Mock context files directory
        filesDir = File.createTempFile("test", "dir").apply {
            delete()
            mkdirs()
        }
        every { mockContext.filesDir } returns filesDir
    }

    @After
    fun tearDown() {
        clearAllMocks()
        runBlocking {
            com.reactnativepingidentity.core.CoreRuntime.sessionStorageRegistry.removeAll()
            com.reactnativepingidentity.core.CoreRuntime.oidcStorageRegistry.removeAll()
        }
        filesDir.deleteRecursively()
    }

    @Test
    fun configureWithMemoryTypeReturnsId() {
        val config = createMockReadableMap(mapOf("type" to "memory"))

        val id = RNPingStorageCommon.configureSessionStorage(config, mockContext)
        val storage = resolveSessionStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storage)
    }

    @Test
    fun configureOidcWithMemoryTypeReturnsId() {
        val config = createMockReadableMap(mapOf("type" to "memory"))

        val id = RNPingStorageCommon.configureOidcStorage(config, mockContext)
        val storage = resolveOidcStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storage)
    }

    @Test
    fun configureMultipleTimesReturnsDifferentIds() {
        val config1 = createMockReadableMap(mapOf("type" to "memory"))
        val config2 = createMockReadableMap(mapOf("type" to "memory"))

        val id1 = RNPingStorageCommon.configureSessionStorage(config1, mockContext)
        val id2 = RNPingStorageCommon.configureSessionStorage(config2, mockContext)

        assertNotEquals(id1, id2)
    }

    @Test
    fun configureDatastoreTypeReturnsId() {
        val config = createMockReadableMap(mapOf("type" to "datastore", "fileName" to "test_store"))

        val id = RNPingStorageCommon.configureSessionStorage(config, mockContext)
        val storage = resolveSessionStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storage)
    }

    @Test
    fun configureEncryptedTypeReturnsId() {
        val config = createMockReadableMap(
            mapOf(
                "type" to "encrypted",
                "fileName" to "secure_store",
                "keyAlias" to "testKey",
                "strongBoxPreferred" to true
            )
        )

        assertThrows(UninitializedPropertyAccessException::class.java) {
            RNPingStorageCommon.configureSessionStorage(config, mockContext)
        }
    }

    @Test
    fun configureOidcStorageRegistersOnlyInOidcRegistry() {
        val config = createMockReadableMap(mapOf("type" to "memory"))

        val id = RNPingStorageCommon.configureOidcStorage(config, mockContext)

        val oidcStorage = resolveOidcStorage(id)
        val sessionStorage = runBlocking {
            com.reactnativepingidentity.core.CoreRuntime.sessionStorageRegistry.resolve(id)
        }

        assertNotNull(oidcStorage)
        assertNull(sessionStorage)
    }

    @Test
    fun configureMissingTypeThrows() {
        val config = createMockReadableMap(emptyMap())

        val exception = assertThrows(IllegalArgumentException::class.java) {
            RNPingStorageCommon.configureSessionStorage(config, mockContext)
        }

        assertEquals(
            "Missing required 'type' parameter in storage configuration",
            exception.message
        )
    }

    @Test
    fun configureInvalidTypeThrows() {
        val config = createMockReadableMap(mapOf("type" to "invalid"))

        val exception = assertThrows(IllegalArgumentException::class.java) {
            RNPingStorageCommon.configureSessionStorage(config, mockContext)
        }

        assertEquals(
            "Invalid storage type 'invalid'. Must be 'memory', 'encrypted', or 'datastore'",
            exception.message
        )
    }

    private fun createMockReadableMap(data: Map<String, Any?>): ReadableMap {
        val map = mockk<ReadableMap>(relaxed = true)
        every { map.toHashMap() } returns HashMap(data)
        return map
    }

    private fun resolveSessionStorage(id: String): Storage<String> {
        val handle = runBlocking {
            com.reactnativepingidentity.core.CoreRuntime.sessionStorageRegistry.resolve(id)
        }
        assertNotNull(handle)
        return extractStorage(handle!!)
    }

    private fun resolveOidcStorage(id: String): Storage<String> {
        val handle = runBlocking {
            com.reactnativepingidentity.core.CoreRuntime.oidcStorageRegistry.resolve(id)
        }
        assertNotNull(handle)
        return extractStorage(handle!!)
    }

    private fun extractStorage(handle: Any): Storage<String> {
        val storageField = handle.javaClass.getDeclaredField("storage")
        storageField.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        return storageField.get(handle) as Storage<String>
    }
}
