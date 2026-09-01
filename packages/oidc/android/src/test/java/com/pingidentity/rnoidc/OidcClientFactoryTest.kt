/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcClientConfig
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class OidcClientFactoryTest {

  @Test
  fun buildWebClient_appliesLoggerId() {
    val loggerIds = mutableListOf<String?>()
    val storageRegistry = RecordingRegistry()
    val factory = OidcClientFactory(storageRegistry) {
      loggerIds.add(it)
      null
    }

    factory.buildWebClient(basePayload(loggerId = "logger-1"))

    assertEquals(listOf("logger-1"), loggerIds)
  }

  @Test
  fun buildWebClient_resolvesStorageConfigWhenIdProvided() {
    val registry = RecordingRegistry().apply {
      addHandle("storage-1", TestStorageConfigHandle(fileName = "oidc-store"))
    }
    val factory = OidcClientFactory(registry) { null }

    factory.buildWebClient(basePayload(storageId = "storage-1"))

    assertEquals("storage-1", registry.lastResolvedId)
  }

  @Test
  fun buildOidcClient_skipsStorageResolveWhenIdMissing() {
    val registry = RecordingRegistry()
    val factory = OidcClientFactory(registry) { null }

    factory.buildOidcClient(basePayload(storageId = null))

    assertNull(registry.lastResolvedId)
  }

  @Test
  fun buildOidcClient_appliesLoggerIdWhenNull() {
    val loggerIds = mutableListOf<String?>()
    val storageRegistry = RecordingRegistry()
    val factory = OidcClientFactory(storageRegistry) {
      loggerIds.add(it)
      null
    }

    factory.buildOidcClient(basePayload(loggerId = null))

    assertEquals(listOf(null), loggerIds)
  }

  @Test
  fun buildOidcClient_appliesOpenIdDirectlyWhenNoDiscoveryEndpoint() {
    // With no discoveryEndpoint, there is nothing for the openId payload to
    // merge onto: it becomes the complete configuration, and any endpoint
    // it leaves unset stays blank (OpenIdConfiguration's own default).
    val storageRegistry = RecordingRegistry()
    val factory = OidcClientFactory(storageRegistry) { null }
    val payload = basePayload().copy(
      discoveryEndpoint = null,
      openId = OpenIdPayload(
        authorizationEndpoint = "https://example.com/oauth2/authorize",
        tokenEndpoint = "https://example.com/oauth2/token",
        userinfoEndpoint = "https://example.com/oauth2/userinfo",
        endSessionEndpoint = null,
        pingEndIdpSessionEndpoint = null,
        revocationEndpoint = null,
        deviceAuthorizationEndpoint = null
      )
    )

    val client = factory.buildOidcClient(payload)
    val config = client.extractConfig()

    assertEquals("https://example.com/oauth2/authorize", config.openId.authorizationEndpoint)
    assertEquals("https://example.com/oauth2/token", config.openId.tokenEndpoint)
    assertEquals("https://example.com/oauth2/userinfo", config.openId.userinfoEndpoint)
    assertEquals("", config.openId.endSessionEndpoint)
    assertEquals("", config.openId.pingEndIdpSessionEndpoint)
    assertEquals("", config.openId.revocationEndpoint)
  }

  @Test
  fun buildOidcClient_mergesPartialOpenIdOverrideOntoDiscoveryWhenDiscoveryEndpointPresent() {
    // With a discoveryEndpoint present, a partial openId payload (here, only
    // deviceAuthorizationEndpoint -- the field Advanced Identity Cloud's own
    // discovery document omits) must be registered as an override applied
    // on top of discovery, not pre-empt discovery outright: only the fields
    // explicitly provided should replace their discovered value.
    val storageRegistry = RecordingRegistry()
    val factory = OidcClientFactory(storageRegistry) { null }
    val payload = basePayload().copy(
      openId = OpenIdPayload(
        authorizationEndpoint = null,
        tokenEndpoint = null,
        userinfoEndpoint = null,
        endSessionEndpoint = null,
        pingEndIdpSessionEndpoint = null,
        revocationEndpoint = null,
        deviceAuthorizationEndpoint = "https://example.com/device/code"
      )
    )

    val client = factory.buildOidcClient(payload)
    val config = client.extractConfig()

    val discovered = com.pingidentity.oidc.OpenIdConfiguration(
      authorizationEndpoint = "https://discovered.example.com/authorize",
      tokenEndpoint = "https://discovered.example.com/token",
      userinfoEndpoint = "https://discovered.example.com/userinfo"
    )
    assertNotNull(config.openIdOverride)
    config.openIdOverride?.invoke(discovered)

    assertEquals("https://discovered.example.com/authorize", discovered.authorizationEndpoint)
    assertEquals("https://discovered.example.com/token", discovered.tokenEndpoint)
    assertEquals("https://discovered.example.com/userinfo", discovered.userinfoEndpoint)
    assertEquals("https://example.com/device/code", discovered.deviceAuthorizationEndpoint)
  }

  @Test
  fun parseCacheStrategy_fallsBackToNoCache() {
    val factory = OidcClientFactory(RecordingRegistry()) { null }
    val parsed = factory.invokeParseCacheStrategy("unknown_value")

    assertEquals(com.pingidentity.storage.CacheStrategy.NO_CACHE, parsed)
  }

  @Test
  fun parseCacheStrategy_acceptsKnownValues() {
    val factory = OidcClientFactory(RecordingRegistry()) { null }
    val parsed = factory.invokeParseCacheStrategy("cache_on_failure")

    assertEquals(com.pingidentity.storage.CacheStrategy.CACHE_ON_FAILURE, parsed)
  }

  private fun basePayload(
    storageId: String? = null,
    loggerId: String? = null
  ): OidcClientPayload {
    return OidcClientPayload(
      clientId = "client-id",
      discoveryEndpoint = "https://example.com/.well-known/openid-configuration",
      openId = null,
      redirectUri = "com.example.app://callback",
      scopes = listOf("openid"),
      storageId = storageId,
      loggerId = loggerId,
      acrValues = null,
      signOutRedirectUri = null,
      state = null,
      nonce = null,
      uiLocales = null,
      refreshThreshold = null,
      loginHint = null,
      display = null,
      prompt = null,
      additionalParameters = emptyMap()
    )
  }

  private fun OidcClient.extractConfig(): OidcClientConfig {
    val field = OidcClient::class.java.getDeclaredField("config").apply {
      isAccessible = true
    }
    return field.get(this) as OidcClientConfig
  }

  private fun OidcClientFactory.invokeParseCacheStrategy(value: String): com.pingidentity.storage.CacheStrategy {
    val method = OidcClientFactory::class.java.getDeclaredMethod("parseCacheStrategy", String::class.java)
    method.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    return method.invoke(this, value) as com.pingidentity.storage.CacheStrategy
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

  private data class TestStorageConfigHandle(
    override val keyAlias: String? = null,
    override val fileName: String? = null,
    override val strongBoxPreferred: Boolean? = null,
    override val cacheStrategy: String? = null
  ) : StorageConfigHandleContract
}
