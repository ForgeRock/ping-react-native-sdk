/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnstorage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import io.mockk.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingStorageCommonTest {

    @Before
    fun setUp() {
        MockKAnnotations.init(this)
        // Mock Arguments.createMap() to return a proper WritableMap
        mockkStatic(Arguments::class)
        every { Arguments.createMap() } answers {
            val map = mockk<WritableMap>(relaxed = true)
            val storage = mutableMapOf<String, Any?>()
            
            every { map.putString(any(), any()) } answers {
                storage[firstArg()] = secondArg()
                Unit
            }
            every { map.putBoolean(any(), any()) } answers {
                storage[firstArg()] = secondArg()
                Unit
            }
            every { map.getString(any()) } answers {
                storage[firstArg()] as? String
            }
            every { map.getBoolean(any()) } answers {
                storage[firstArg()] as? Boolean ?: false
            }
            every { map.hasKey(any()) } answers {
                storage.containsKey(firstArg())
            }
            
            map
        }
    }

    @After
    fun tearDown() {
        unmockkStatic(Arguments::class)
        clearAllMocks()
        StorageConfigRegistry(com.pingidentity.rncore.CoreRuntime.sessionStorageConfigRegistry).clear()
        StorageConfigRegistry(com.pingidentity.rncore.CoreRuntime.oidcStorageConfigRegistry).clear()
        StorageConfigRegistry(com.pingidentity.rncore.CoreRuntime.bindingUserKeyStorageConfigRegistry).clear()
        StorageConfigRegistry(com.pingidentity.rncore.CoreRuntime.pushStorageConfigRegistry).clear()
        com.pingidentity.rncore.CoreRuntime.oathStorageConfigRegistry.removeAll()
    }

    @Test
    fun configureWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerSessionStorage(config)
        val configMap = RNPingStorageCommon.configureSessionStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("com.pingidentity.rnstorage.storage", configMap.getString("keyAlias"))
        assertEquals("secure_prefs", configMap.getString("fileName"))
        assertFalse(configMap.hasKey("strongBoxPreferred"))
        assertFalse(configMap.hasKey("cacheStrategy"))
    }

    @Test
    fun configureOidcWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerOidcStorage(config)
        val configMap = RNPingStorageCommon.configureOidcStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("com.pingidentity.rnstorage.storage", configMap.getString("keyAlias"))
        assertEquals("secure_prefs", configMap.getString("fileName"))
        assertFalse(configMap.hasKey("strongBoxPreferred"))
        assertFalse(configMap.hasKey("cacheStrategy"))
    }

    @Test
    fun configureMultipleTimesReturnsSameConfig() {
        val config1 = createMockReadableMap(emptyMap())
        val config2 = createMockReadableMap(emptyMap())

        val id1 = RNPingStorageCommon.registerSessionStorage(config1)
        val id2 = RNPingStorageCommon.registerSessionStorage(config2)
        val configMap1 = RNPingStorageCommon.configureSessionStorage(id1)
        val configMap2 = RNPingStorageCommon.configureSessionStorage(id2)

        assertEquals(configMap1.getString("keyAlias"), configMap2.getString("keyAlias"))
        assertEquals(configMap1.getString("fileName"), configMap2.getString("fileName"))
    }

    @Test
    fun configureDatastoreTypeReturnsConfig() {
        val config = createMockReadableMap(mapOf("fileName" to "test_store"))

        val id = RNPingStorageCommon.registerSessionStorage(config)
        val configMap = RNPingStorageCommon.configureSessionStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("test_store", configMap.getString("fileName"))
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
        val configMap = RNPingStorageCommon.configureSessionStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("secure_store", configMap.getString("fileName"))
        assertEquals("testKey", configMap.getString("keyAlias"))
        assertEquals(true, configMap.getBoolean("strongBoxPreferred"))
        assertEquals("cache_on_failure", configMap.getString("cacheStrategy"))
    }

    @Test
    fun registerBindingUserKeyStorageWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerBindingUserKeyStorage(config)
        val configMap = RNPingStorageCommon.configureBindingUserKeyStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("secure_prefs", configMap.getString("fileName"))
    }

    @Test
    fun registerBindingUserKeyStorageWithCustomValuesRoundTrips() {
        val config = createMockReadableMap(
            mapOf(
                "fileName" to "binding_store",
                "keyAlias" to "bindingKey",
                "strongBoxPreferred" to true,
            )
        )

        val id = RNPingStorageCommon.registerBindingUserKeyStorage(config)
        val configMap = RNPingStorageCommon.configureBindingUserKeyStorage(id)

        assertEquals("binding_store", configMap.getString("fileName"))
        assertEquals("bindingKey", configMap.getString("keyAlias"))
        assertEquals(true, configMap.getBoolean("strongBoxPreferred"))
    }

    @Test
    fun registerPushStorageWithDefaultsReturnsConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerPushStorage(config)
        val configMap = RNPingStorageCommon.configurePushStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("secure_prefs", configMap.getString("fileName"))
    }

    @Test
    fun registerPushStorageWithCustomValuesRoundTrips() {
        val config = createMockReadableMap(
            mapOf(
                "fileName" to "push_store",
                "keyAlias" to "pushKey",
                "cacheStrategy" to "cache_on_failure",
            )
        )

        val id = RNPingStorageCommon.registerPushStorage(config)
        val configMap = RNPingStorageCommon.configurePushStorage(id)

        assertEquals("push_store", configMap.getString("fileName"))
        assertEquals("pushKey", configMap.getString("keyAlias"))
        assertEquals("cache_on_failure", configMap.getString("cacheStrategy"))
    }

    @Test
    fun bindingUserKeyAndPushStorageRegistriesAreIndependent() {
        val bindingConfig = createMockReadableMap(mapOf("fileName" to "binding_store"))
        val pushConfig = createMockReadableMap(mapOf("fileName" to "push_store"))

        val bindingId = RNPingStorageCommon.registerBindingUserKeyStorage(bindingConfig)
        val pushId = RNPingStorageCommon.registerPushStorage(pushConfig)
        val bindingMap = RNPingStorageCommon.configureBindingUserKeyStorage(bindingId)
        val pushMap = RNPingStorageCommon.configurePushStorage(pushId)

        assertEquals("binding_store", bindingMap.getString("fileName"))
        assertEquals("push_store", pushMap.getString("fileName"))
        assertNotEquals(bindingId, pushId)
    }

    @Test
    fun registerOathStorageReturnsDatabaseNameFromDatabaseNameKey() {
        val config = createMockReadableMap(mapOf("databaseName" to "oath_tokens.db"))

        val id = RNPingStorageCommon.registerOathStorage(config)
        val configMap = RNPingStorageCommon.configureOathStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertNotNull(configMap)
        assertEquals("oath_tokens.db", configMap.getString("databaseName"))
    }

    @Test
    fun registerOathStorageWithNullDatabaseNameReturnsEmptyConfig() {
        val config = createMockReadableMap(emptyMap())

        val id = RNPingStorageCommon.registerOathStorage(config)
        val configMap = RNPingStorageCommon.configureOathStorage(id)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
        assertFalse(configMap.hasKey("databaseName"))
    }

    @Test
    fun oathHandleImplementsOathStorageConfigHandleContract() {
        val config = createMockReadableMap(mapOf("databaseName" to "my.db"))
        val id = RNPingStorageCommon.registerOathStorage(config)

        val handle = com.pingidentity.rncore.CoreRuntime.oathStorageConfigRegistry.resolve(id)
        assertTrue(
            "Handle must implement OathStorageConfigHandleContract",
            handle is com.pingidentity.rncore.storage.OathStorageConfigHandleContract
        )
        val contract = handle as com.pingidentity.rncore.storage.OathStorageConfigHandleContract
        assertEquals("my.db", contract.databaseName)
    }

    @Test
    fun oathStorageDoesNotInterfereWithSessionStorage() {
        val oathConfig = createMockReadableMap(mapOf("databaseName" to "oath.db"))
        val sessionConfig = createMockReadableMap(emptyMap())

        val oathId = RNPingStorageCommon.registerOathStorage(oathConfig)
        val sessionId = RNPingStorageCommon.registerSessionStorage(sessionConfig)

        val oathMap = RNPingStorageCommon.configureOathStorage(oathId)
        val sessionMap = RNPingStorageCommon.configureSessionStorage(sessionId)

        assertEquals("oath.db", oathMap.getString("databaseName"))
        assertEquals("secure_prefs", sessionMap.getString("fileName"))
    }

    private fun createMockReadableMap(data: Map<String, Any?>): ReadableMap {
        val map = mockk<ReadableMap>(relaxed = true)
        every { map.toHashMap() } returns HashMap(data)
        return map
    }

}
