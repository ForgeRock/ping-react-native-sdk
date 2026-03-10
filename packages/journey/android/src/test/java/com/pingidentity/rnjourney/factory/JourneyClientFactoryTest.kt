/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class JourneyClientFactoryTest {

  @Test
  fun build_resolvesSessionAndOidcStorageFromCoreRegistries() {
    val sessionRegistry = RecordingRegistry().apply {
      addHandle("session-storage-1", TestStorageHandle(fileName = "session-file"))
    }
    val oidcRegistry = RecordingRegistry().apply {
      addHandle("oidc-storage-1", TestStorageHandle(fileName = "oidc-file"))
    }
    val factory = JourneyClientFactory(sessionRegistry, oidcRegistry) { null }

    factory.build(basePayload(sessionStorageId = "session-storage-1", oidcStorageId = "oidc-storage-1"))

    assertEquals("session-storage-1", sessionRegistry.lastResolvedId)
    assertEquals("oidc-storage-1", oidcRegistry.lastResolvedId)
  }

  @Test
  fun build_appliesLoggerIdToResolver() {
    val resolvedLoggerIds = mutableListOf<String?>()
    val factory = JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) {
      resolvedLoggerIds.add(it)
      null
    }

    factory.build(basePayload(sessionStorageId = null, oidcStorageId = null, loggerId = "logger-1"))

    assertEquals(listOf("logger-1"), resolvedLoggerIds)
  }

  @Test(expected = IllegalArgumentException::class)
  fun build_throwsWhenSessionStorageIdIsUnknown() {
    val factory = JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null }

    factory.build(basePayload(sessionStorageId = "missing-session", oidcStorageId = null))
  }

  @Test(expected = IllegalArgumentException::class)
  fun build_throwsWhenOidcStorageIdIsUnknown() {
    val factory = JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null }

    factory.build(basePayload(sessionStorageId = null, oidcStorageId = "missing-oidc"))
  }

  private fun basePayload(
    sessionStorageId: String?,
    oidcStorageId: String?,
    loggerId: String? = null
  ): JourneyClientPayload {
    return JourneyClientPayload(
      serverUrl = "https://example.com/am",
      timeout = null,
      realm = "alpha",
      cookie = "iPlanetDirectoryPro",
      clientId = "client-id",
      discoveryEndpoint = "https://example.com/am/oauth2/alpha/.well-known/openid-configuration",
      redirectUri = "com.example.app://callback",
      scopes = listOf("openid"),
      openId = null,
      acrValues = null,
      signOutRedirectUri = null,
      state = null,
      nonce = null,
      uiLocales = null,
      refreshThreshold = null,
      loginHint = null,
      display = null,
      prompt = null,
      additionalParameters = emptyMap(),
      sessionStorageId = sessionStorageId,
      oidcStorageId = oidcStorageId,
      loggerId = loggerId,
      oidcClientId = null
    )
  }

  private class RecordingRegistry : Registry {
    private val handles = mutableMapOf<String, NativeHandle>()
    var lastResolvedId: String? = null

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
}
