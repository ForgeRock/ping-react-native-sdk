/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReadableMap
import io.mockk.*
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
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
    fun configureWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerSessionStorage(config)
        val configJson = RNPingStorageCommon.configureSessionStorage(id)
        val storageConfig = JSONObject(configJson)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configJson)
        assertTrue(configJson.isNotEmpty())
        assertEquals("defaultKey", storageConfig.getString("keyAlias"))
        assertEquals("secure_prefs", storageConfig.getString("fileName"))
        assertFalse(storageConfig.has("strongBoxPreferred"))
        assertFalse(storageConfig.has("cacheStrategy"))
    }

    @Test
    fun configureOidcWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerOidcStorage(config)
        val configJson = RNPingStorageCommon.configureOidcStorage(id)
        val storageConfig = JSONObject(configJson)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configJson)
        assertTrue(configJson.isNotEmpty())
        assertEquals("defaultKey", storageConfig.getString("keyAlias"))
        assertEquals("secure_prefs", storageConfig.getString("fileName"))
        assertFalse(storageConfig.has("strongBoxPreferred"))
        assertFalse(storageConfig.has("cacheStrategy"))
    }

    @Test
    fun configureMultipleTimesReturnsSameConfig() {
        val config1 = createMockReadableMap(emptyMap())
        val config2 = createMockReadableMap(emptyMap())

        val id1 = RNPingStorageCommon.registerSessionStorage(config1)
        val id2 = RNPingStorageCommon.registerSessionStorage(config2)
        val configJson1 = RNPingStorageCommon.configureSessionStorage(id1)
        val configJson2 = RNPingStorageCommon.configureSessionStorage(id2)

        assertEquals(configJson1, configJson2)
    }

    @Test
    fun configureDatastoreTypeReturnsConfig() {
        val config = createMockReadableMap(mapOf("fileName" to "test_store"))

        val id = RNPingStorageCommon.registerSessionStorage(config)
        val configJson = RNPingStorageCommon.configureSessionStorage(id)
        val storageConfig = JSONObject(configJson)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configJson)
        assertTrue(configJson.isNotEmpty())
        assertEquals("test_store", storageConfig.getString("fileName"))
    }

    @Test
    fun configureEncryptedTypeReturnsConfig() {
        val config = createMockReadableMap(
            mapOf(
                "fileName" to "secure_store",
                "keyAlias" to "testKey",
                "strongBoxPreferred" to true,
                "cacheStrategy" to "cache_on_failure"
            )
        )

        val id = RNPingStorageCommon.registerSessionStorage(config)
        val configJson = RNPingStorageCommon.configureSessionStorage(id)
        val storageConfig = JSONObject(configJson)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configJson)
        assertTrue(configJson.isNotEmpty())
        assertEquals("secure_store", storageConfig.getString("fileName"))
        assertEquals("testKey", storageConfig.getString("keyAlias"))
        assertEquals(true, storageConfig.getBoolean("strongBoxPreferred"))
        assertEquals("cache_on_failure", storageConfig.getString("cacheStrategy"))
    }

    private fun createMockReadableMap(data: Map<String, Any?>): ReadableMap {
        val map = mockk<ReadableMap>(relaxed = true)
        every { map.toHashMap() } returns HashMap(data)
        return map
    }

}
