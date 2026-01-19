/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.storage.StorageConfig
import io.mockk.*
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class RNPingStorageCommonTest {

    @Before
    fun setUp() {
        MockKAnnotations.init(this)
    }

    @After
    fun tearDown() {
        clearAllMocks()
        runBlocking {
            StorageConfigRegistry(com.reactnativepingidentity.core.CoreRuntime.sessionStorageConfigRegistry).clear()
            StorageConfigRegistry(com.reactnativepingidentity.core.CoreRuntime.oidcStorageConfigRegistry).clear()
        }
    }

    @Test
    fun configureWithMemoryTypeReturnsId() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.configureSessionStorage(config)
        val storageConfig = resolveSessionConfig(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storageConfig)
        assertEquals("defaultKey", storageConfig.keyAlias)
        assertEquals("secure_prefs", storageConfig.fileName)
        assertNull(storageConfig.strongBoxPreferred)
        assertNull(storageConfig.cacheStrategy)
    }

    @Test
    fun configureOidcWithMemoryTypeReturnsId() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.configureOidcStorage(config)
        val storageConfig = resolveOidcConfig(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storageConfig)
        assertEquals("defaultKey", storageConfig.keyAlias)
        assertEquals("secure_prefs", storageConfig.fileName)
        assertNull(storageConfig.strongBoxPreferred)
        assertNull(storageConfig.cacheStrategy)
    }

    @Test
    fun configureMultipleTimesReturnsDifferentIds() {
        val config1 = createMockReadableMap(emptyMap())
        val config2 = createMockReadableMap(emptyMap())

        val id1 = RNPingStorageCommon.configureSessionStorage(config1)
        val id2 = RNPingStorageCommon.configureSessionStorage(config2)

        assertNotEquals(id1, id2)
    }

    @Test
    fun configureDatastoreTypeReturnsId() {
        val config = createMockReadableMap(mapOf("fileName" to "test_store"))

        val id = RNPingStorageCommon.configureSessionStorage(config)
        val storageConfig = resolveSessionConfig(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storageConfig)
        assertEquals("test_store", storageConfig.fileName)
    }

    @Test
    fun configureEncryptedTypeReturnsId() {
        val config = createMockReadableMap(
            mapOf(
                "fileName" to "secure_store",
                "keyAlias" to "testKey",
                "strongBoxPreferred" to true,
                "cacheStrategy" to "cache_on_failure"
            )
        )

        val id = RNPingStorageCommon.configureSessionStorage(config)
        val storageConfig = resolveSessionConfig(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(storageConfig)
        assertEquals("secure_store", storageConfig.fileName)
        assertEquals("testKey", storageConfig.keyAlias)
        assertEquals(true, storageConfig.strongBoxPreferred)
        assertEquals("cache_on_failure", storageConfig.cacheStrategy)
    }

    @Test
    fun configureOidcStorageRegistersOnlyInOidcRegistry() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.configureOidcStorage(config)

        val oidcStorage = resolveOidcConfig(id)

        assertNotNull(oidcStorage)
        assertThrows(IllegalStateException::class.java) {
            runBlocking {
                StorageConfigRegistry(com.reactnativepingidentity.core.CoreRuntime.sessionStorageConfigRegistry).resolve(id)
            }
        }
    }

    private fun createMockReadableMap(data: Map<String, Any?>): ReadableMap {
        val map = mockk<ReadableMap>(relaxed = true)
        every { map.toHashMap() } returns HashMap(data)
        return map
    }

    private fun resolveSessionConfig(id: String): StorageConfig {
        return runBlocking {
            StorageConfigRegistry(com.reactnativepingidentity.core.CoreRuntime.sessionStorageConfigRegistry).resolve(id)
        }
    }

    private fun resolveOidcConfig(id: String): StorageConfig {
        return runBlocking {
            StorageConfigRegistry(com.reactnativepingidentity.core.CoreRuntime.oidcStorageConfigRegistry).resolve(id)
        }
    }
}
