/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.oidc.OidcClientConfigHandle
import com.pingidentity.rncore.oidc.OidcOpenIdConfig
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class JourneyClientFactoryTest {

  @After
  fun tearDown() {
    CoreRuntime.oidcClientRegistry.removeAll()
  }

  @Test
  fun build_allowsJourneyOnlyConfigurationWithoutOidc() {
    val factory = JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null }

    val payload = JourneyClientPayload(
      serverUrl = "https://example.com/am",
      timeout = null,
      realm = "alpha",
      cookie = "iPlanetDirectoryPro",
      oidc = null,
      sessionStorageId = null,
      loggerId = null
    )

    val workflow = factory.build(payload)
    assertNotNull(workflow)
  }

  @Test
  fun resolveOidcConfigFromHandle_copiesPar() {
    val handleId = CoreRuntime.oidcClientRegistry.register(TestOidcHandle(par = true))

    val method = JourneyClientFactory::class.java.getDeclaredMethod(
      "resolveOidcConfigFromHandle",
      String::class.java
    )
    method.isAccessible = true
    val resolved = method.invoke(
      JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null },
      handleId
    )
    val par = resolved.javaClass.getDeclaredField("par").apply {
      isAccessible = true
    }.get(resolved)

    assertTrue(par == true)
  }

  @Test
  fun resolveOidcConfigFromHandle_copiesPushedAuthorizationRequestEndpoint() {
    val handleId = CoreRuntime.oidcClientRegistry.register(
      TestOidcHandle(
        openId = OidcOpenIdConfig(
          authorizationEndpoint = "https://example.com/am/oauth2/authorize",
          tokenEndpoint = "https://example.com/am/oauth2/token",
          userinfoEndpoint = "https://example.com/am/oauth2/userinfo",
          endSessionEndpoint = null,
          pingEndIdpSessionEndpoint = null,
          revocationEndpoint = null,
          pushedAuthorizationRequestEndpoint = "https://example.com/am/oauth2/par"
        )
      )
    )

    val method = JourneyClientFactory::class.java.getDeclaredMethod(
      "resolveOidcConfigFromHandle",
      String::class.java
    )
    method.isAccessible = true
    val resolved = method.invoke(
      JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null },
      handleId
    )
    val resolvedOpenId = resolved.javaClass.getDeclaredField("openId").apply {
      isAccessible = true
    }.get(resolved) as OidcOpenIdConfig

    assertEquals("https://example.com/am/oauth2/par", resolvedOpenId.pushedAuthorizationRequestEndpoint)
  }

  @Test
  fun build_withParEnabled_succeeds() {
    val factory = JourneyClientFactory(RecordingRegistry(), RecordingRegistry()) { null }

    val workflow = factory.build(
      basePayload(sessionStorageId = null, oidcStorageId = null, par = true)
    )

    assertNotNull(workflow)
  }

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
    loggerId: String? = null,
    par: Boolean? = null
  ): JourneyClientPayload {
    return JourneyClientPayload(
      serverUrl = "https://example.com/am",
      timeout = null,
      realm = "alpha",
      cookie = "iPlanetDirectoryPro",
      oidc = JourneyOidcPayload(
        clientId = "client-id",
        discoveryEndpoint = "https://example.com/am/oauth2/alpha/.well-known/openid-configuration",
        redirectUri = "com.example.app://callback",
        scopes = listOf("openid"),
        par = par,
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
        storageId = oidcStorageId,
        clientHandleId = null
      ),
      sessionStorageId = sessionStorageId,
      loggerId = loggerId
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

  private data class TestOidcHandle(
    override val clientId: String = "client-id",
    override val discoveryEndpoint: String? = "https://example.com/.well-known/openid-configuration",
    override val redirectUri: String = "com.example.app://callback",
    override val scopes: List<String> = listOf("openid"),
    override val openId: OidcOpenIdConfig? = null,
    override val par: Boolean? = null,
    override val acrValues: String? = null,
    override val signOutRedirectUri: String? = null,
    override val state: String? = null,
    override val nonce: String? = null,
    override val uiLocales: String? = null,
    override val refreshThreshold: Long? = null,
    override val loginHint: String? = null,
    override val display: String? = null,
    override val prompt: String? = null,
    override val additionalParameters: Map<String, String> = emptyMap()
  ) : OidcClientConfigHandle, NativeHandle
}
