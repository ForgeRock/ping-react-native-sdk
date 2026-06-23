/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.factory

import com.pingidentity.logger.Logger
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import com.pingidentity.rndavinci.config.DaVinciClientPayload
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for [DaVinciClientFactory].
 *
 * Mirrors the coverage shape of `JourneyClientFactoryTest`: validates payload-to-workflow
 * construction, registry resolution for storage and logger handles, and error surfaces
 * for unknown handle ids. Uses `Robolectric` so that the native DaVinci builder can
 * resolve Android classes during initialization.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class DaVinciClientFactoryTest {

    @Test
    fun build_returnsWorkflowForMinimalPayload() {
        val factory = DaVinciClientFactory(RecordingRegistry(), RecordingRegistry())

        val workflow = factory.build(minimalPayload())

        assertNotNull(workflow)
    }

    @Test
    fun build_resolvesOidcStorageFromCoreRegistry() {
        val oidcRegistry = RecordingRegistry().apply {
            addHandle("oidc-storage-1", TestStorageHandle(fileName = "oidc-file"))
        }
        val factory = DaVinciClientFactory(oidcRegistry, RecordingRegistry())

        factory.build(minimalPayload(storageId = "oidc-storage-1"))

        assertEquals("oidc-storage-1", oidcRegistry.lastResolvedId)
    }

    @Test
    fun build_skipsOidcStorageResolutionWhenStorageIdIsNull() {
        val oidcRegistry = RecordingRegistry()
        val factory = DaVinciClientFactory(oidcRegistry, RecordingRegistry())

        factory.build(minimalPayload(storageId = null))

        assertNull(oidcRegistry.lastResolvedId)
    }

    @Test
    fun build_skipsOidcStorageResolutionWhenStorageIdIsBlank() {
        val oidcRegistry = RecordingRegistry()
        val factory = DaVinciClientFactory(oidcRegistry, RecordingRegistry())

        factory.build(minimalPayload(storageId = "   "))

        assertNull(oidcRegistry.lastResolvedId)
    }

    @Test(expected = IllegalArgumentException::class)
    fun build_throwsWhenOidcStorageIdIsUnknown() {
        val factory = DaVinciClientFactory(RecordingRegistry(), RecordingRegistry())

        factory.build(minimalPayload(storageId = "missing-oidc"))
    }

    @Test
    fun build_resolvesLoggerFromCoreRegistry() {
        val loggerRegistry = RecordingRegistry().apply {
            addHandle("logger-1", TestLoggerHandle(nativeLogger = NoopLogger))
        }
        val factory = DaVinciClientFactory(RecordingRegistry(), loggerRegistry)

        factory.build(minimalPayload(loggerId = "logger-1"))

        assertEquals("logger-1", loggerRegistry.lastResolvedId)
    }

    @Test
    fun build_skipsLoggerResolutionWhenLoggerIdIsNull() {
        val loggerRegistry = RecordingRegistry()
        val factory = DaVinciClientFactory(RecordingRegistry(), loggerRegistry)

        factory.build(minimalPayload(loggerId = null))

        assertNull(loggerRegistry.lastResolvedId)
    }

    @Test
    fun build_skipsLoggerResolutionWhenLoggerIdIsBlank() {
        val loggerRegistry = RecordingRegistry()
        val factory = DaVinciClientFactory(RecordingRegistry(), loggerRegistry)

        factory.build(minimalPayload(loggerId = "   "))

        assertNull(loggerRegistry.lastResolvedId)
    }

    @Test
    fun build_silentlyIgnoresUnknownLoggerId() {
        val factory = DaVinciClientFactory(RecordingRegistry(), RecordingRegistry())

        val workflow = factory.build(minimalPayload(loggerId = "missing-logger"))

        assertNotNull(workflow)
    }

    @Test
    fun build_silentlyIgnoresLoggerHandleWithIncompatibleNativeType() {
        val loggerRegistry = RecordingRegistry().apply {
            addHandle("logger-1", TestLoggerHandle(nativeLogger = "not-a-logger"))
        }
        val factory = DaVinciClientFactory(RecordingRegistry(), loggerRegistry)

        val workflow = factory.build(minimalPayload(loggerId = "logger-1"))

        assertNotNull(workflow)
    }

    @Test
    fun build_acceptsOidcStorageWithCacheStrategy() {
        val oidcRegistry = RecordingRegistry().apply {
            addHandle(
                "oidc-storage-1",
                TestStorageHandle(cacheStrategy = "cache_on_failure")
            )
        }
        val factory = DaVinciClientFactory(oidcRegistry, RecordingRegistry())

        val workflow = factory.build(minimalPayload(storageId = "oidc-storage-1"))

        assertNotNull(workflow)
        assertEquals("oidc-storage-1", oidcRegistry.lastResolvedId)
    }

    @Test
    fun build_acceptsOidcStorageWithUnknownCacheStrategyValue() {
        val oidcRegistry = RecordingRegistry().apply {
            addHandle(
                "oidc-storage-1",
                TestStorageHandle(cacheStrategy = "definitely-not-a-strategy")
            )
        }
        val factory = DaVinciClientFactory(oidcRegistry, RecordingRegistry())

        val workflow = factory.build(minimalPayload(storageId = "oidc-storage-1"))

        assertNotNull(workflow)
    }

    @Test
    fun build_acceptsFullyPopulatedPayload() {
        val oidcRegistry = RecordingRegistry().apply {
            addHandle(
                "oidc-storage-1",
                TestStorageHandle(
                    fileName = "oidc-file",
                    keyAlias = "oidc-alias",
                    strongBoxPreferred = true,
                    cacheStrategy = "no_cache"
                )
            )
        }
        val loggerRegistry = RecordingRegistry().apply {
            addHandle("logger-1", TestLoggerHandle(nativeLogger = NoopLogger))
        }
        val factory = DaVinciClientFactory(oidcRegistry, loggerRegistry)

        val workflow = factory.build(
            DaVinciClientPayload(
                discoveryEndpoint = "https://example.com/.well-known/openid-configuration",
                clientId = "rn-client",
                redirectUri = "com.example.app://oauth2redirect",
                scopes = listOf("openid", "profile"),
                storageId = "oidc-storage-1",
                loggerId = "logger-1",
                timeout = 30_000L,
                signOutRedirectUri = "com.example.app://logout",
                loginHint = "user@example.com",
                nonce = "nonce-value",
                state = "state-value",
                prompt = "login",
                display = "page",
                uiLocales = "en",
                acrValues = "urn:mfa",
                refreshThreshold = 60L,
                additionalParameters = mapOf("custom" to "value")
            )
        )

        assertNotNull(workflow)
        assertEquals("oidc-storage-1", oidcRegistry.lastResolvedId)
        assertEquals("logger-1", loggerRegistry.lastResolvedId)
    }

    private fun minimalPayload(
        storageId: String? = null,
        loggerId: String? = null
    ): DaVinciClientPayload {
        return DaVinciClientPayload(
            discoveryEndpoint = "https://example.com/.well-known/openid-configuration",
            clientId = "rn-client",
            redirectUri = "com.example.app://oauth2redirect",
            scopes = listOf("openid"),
            storageId = storageId,
            loggerId = loggerId,
            timeout = null,
            signOutRedirectUri = null,
            loginHint = null,
            nonce = null,
            state = null,
            prompt = null,
            display = null,
            uiLocales = null,
            acrValues = null,
            refreshThreshold = null,
            additionalParameters = emptyMap()
        )
    }

    private class RecordingRegistry : Registry {
        private val handles = mutableMapOf<String, NativeHandle>()
        var lastResolvedId: String? = null
            private set

        fun addHandle(id: String, handle: NativeHandle) {
            handles[id] = handle
        }

        override fun register(instance: NativeHandle): String {
            val id = "id-${handles.size + 1}"
            handles[id] = instance
            return id
        }

        override fun resolve(id: String): NativeHandle? {
            lastResolvedId = id
            return handles[id]
        }

        override fun remove(id: String) {
            handles.remove(id)
        }

        override fun removeAll() {
            handles.clear()
        }
    }

    private data class TestStorageHandle(
        override val keyAlias: String? = null,
        override val fileName: String? = null,
        override val strongBoxPreferred: Boolean? = null,
        override val cacheStrategy: String? = null
    ) : StorageConfigHandleContract

    private data class TestLoggerHandle(
        override val loggerLevel: String = "STANDARD",
        override val nativeLogger: Any
    ) : LoggerHandleContract

    private object NoopLogger : Logger {
        override fun d(message: String) = Unit
        override fun i(message: String) = Unit
        override fun w(message: String, throwable: Throwable?) = Unit
        override fun e(message: String, throwable: Throwable?) = Unit
    }
}
