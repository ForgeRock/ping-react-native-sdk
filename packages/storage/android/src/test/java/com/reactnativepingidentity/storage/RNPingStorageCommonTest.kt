/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import io.mockk.*
import kotlinx.coroutines.test.runTest
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

    @Before
    fun setUp() {
        MockKAnnotations.init(this)
        
        mockContext = mockk(relaxed = true)
        
        // Mock context files directory
        val mockFilesDir = File.createTempFile("test", "dir").apply { 
            delete()
            mkdirs()
        }
        every { mockContext.filesDir } returns mockFilesDir
        
        // Mock Arguments.createMap() to return a mock WritableMap
        mockkStatic(Arguments::class)
        every { Arguments.createMap() } returns mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        unmockkStatic(Arguments::class)
        clearAllMocks()
    }

    @Test
    fun configureWithMemoryTypeReturnsId() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))

        val id = RNPingStorageCommon.configure(config, mockContext)

        assertNotNull(id)
        assertTrue(id.isNotEmpty())
    }

    @Test
    fun configureMultipleTimesReturnsDifferentIds() = runTest {
        val config1 = createMockReadableMap(mapOf("type" to "memory"))
        val config2 = createMockReadableMap(mapOf("type" to "memory"))

        val id1 = RNPingStorageCommon.configure(config1, mockContext)
        val id2 = RNPingStorageCommon.configure(config2, mockContext)

        assertNotEquals(id1, id2)
    }

    @Test
    fun saveWithInvalidIdRejectsPromise() = runTest {
        val mockPromise = mockk<Promise>(relaxed = true)
        val data = createMockReadableMap(mapOf("key" to "value"))

        RNPingStorageCommon.save("invalid-id", data, mockPromise)

        verify(timeout = 1_000) { mockPromise.reject("SAVE_ERROR", "Invalid storage id") }
    }

    @Test
    fun getItemWithInvalidIdRejectsPromise() = runTest {
        val mockPromise = mockk<Promise>(relaxed = true)

        RNPingStorageCommon.getItem("invalid-id", mockPromise)

        verify(timeout = 1_000) { mockPromise.reject("GET_ERROR", "Invalid storage id") }
    }

    @Test
    fun deleteItemWithInvalidIdRejectsPromise() = runTest {
        val mockPromise = mockk<Promise>(relaxed = true)

        RNPingStorageCommon.deleteItem("invalid-id", mockPromise)

        verify(timeout = 1_000) { mockPromise.reject("DELETE_ERROR", "Invalid storage id") }
    }

    @Test
    fun saveWithValidIdResolvesPromise() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))
        val id = RNPingStorageCommon.configure(config, mockContext)

        val mockPromise = mockk<Promise>(relaxed = true)
        val data = createMockReadableMap(mapOf("username" to "testUser"))

        RNPingStorageCommon.save(id, data, mockPromise)

        verify(timeout = 1_000) { mockPromise.resolve(true) }
        verify(exactly = 0) { mockPromise.reject(any(), any<String>()) }
    }

    @Test
    fun getItemAfterSaveReturnsData() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))
        val id = RNPingStorageCommon.configure(config, mockContext)

        val savePromise = mockk<Promise>(relaxed = true)
        val saveData = createMockReadableMap(mapOf("username" to "alice"))
        RNPingStorageCommon.save(id, saveData, savePromise)
        verify(timeout = 1_000) { savePromise.resolve(true) }

        val getPromise = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.getItem(id, getPromise)

        val slot = slot<WritableMap>()
        verify(timeout = 1_000) { getPromise.resolve(capture(slot)) }
        assertNotNull(slot.captured)
    }

    @Test
    fun getItemWithoutSaveReturnsNull() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))
        val id = RNPingStorageCommon.configure(config, mockContext)

        val mockPromise = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.getItem(id, mockPromise)

        verify(timeout = 1_000) { mockPromise.resolve(null) }
    }

    @Test
    fun deleteItemRemovesStorage() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))
        val id = RNPingStorageCommon.configure(config, mockContext)

        val deletePromise = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.deleteItem(id, deletePromise)

        verify(timeout = 1_000) { deletePromise.resolve(true) }

        // Verify getting from deleted storage fails
        val getPromise = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.getItem(id, getPromise)

        verify(timeout = 1_000) { getPromise.reject("GET_ERROR", "Invalid storage id") }
    }

    @Test
    fun multipleSavesOverwriteData() = runTest {
        val config = createMockReadableMap(mapOf("type" to "memory"))
        val id = RNPingStorageCommon.configure(config, mockContext)

        val promise1 = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.save(id, createMockReadableMap(mapOf("version" to "1")), promise1)

        val promise2 = mockk<Promise>(relaxed = true)
        RNPingStorageCommon.save(id, createMockReadableMap(mapOf("version" to "2")), promise2)

        verify(timeout = 1_000) { promise1.resolve(true) }
        verify(timeout = 1_000) { promise2.resolve(true) }
    }

    private fun createMockReadableMap(data: Map<String, Any?>): ReadableMap {
        val map = mockk<ReadableMap>(relaxed = true)
        val hashMap = HashMap<String, Any?>()
        
        data.forEach { (key, value) ->
            hashMap[key] = value
            when (value) {
                is String -> every { map.getString(key) } returns value
                is Boolean -> every { map.getBoolean(key) } returns value
                is Int -> every { map.getInt(key) } returns value
                is Double -> every { map.getDouble(key) } returns value
            }
        }
        
        every { map.toHashMap() } returns hashMap
        return map
    }
}
