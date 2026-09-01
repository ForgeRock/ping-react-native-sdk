/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcClientConfig
import com.pingidentity.oidc.OidcWebClient
import com.pingidentity.oidc.OpenIdConfiguration
import com.pingidentity.oidc.module.Oidc
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract

/**
 * Builds native OIDC client instances from JS payloads.
 */
internal class OidcClientFactory(
  private val storageRegistry: Registry,
  /** Resolver that maps logger ids to native logger instances. */
  private val loggerResolver: (String?) -> com.pingidentity.logger.Logger?
) {

  /**
   * Build a native OIDC config for a device client.
   *
   * @param config Parsed JS client payload
   * @return Configured native OIDC config
   */
  fun buildOidcClientConfig(config: OidcClientPayload): OidcClientConfig {
    val resolvedLogger = loggerResolver(config.loggerId)
    return OidcClientConfig().apply {
      resolvedLogger?.let { logger = it }
      config.discoveryEndpoint?.let { discoveryEndpoint = it }
      clientId = config.clientId
      redirectUri = config.redirectUri
      scopes = config.scopes.toMutableSet()
      acrValues = config.acrValues
      signOutRedirectUri = config.signOutRedirectUri
      state = config.state
      nonce = config.nonce
      uiLocales = config.uiLocales
      config.refreshThreshold?.let { refreshThreshold = it }
      loginHint = config.loginHint
      display = config.display
      prompt = config.prompt
      if (config.additionalParameters.isNotEmpty()) {
        additionalParameters = config.additionalParameters
      }
      applyOpenIdIfPresent(config.openId, config.discoveryEndpoint)
      applyStorageIfPresent(config.storageId)
    }
  }

  /**
   * Build a native OIDC web client from stored JS configuration.
   *
   * @param config Parsed JS client payload
   * @return Configured native OIDC web client
   */
  fun buildWebClient(config: OidcClientPayload): OidcWebClient {
    val resolvedLogger = loggerResolver(config.loggerId)
    return OidcWebClient {
      module(Oidc) {
        resolvedLogger?.let { logger = it }
        config.discoveryEndpoint?.let { discoveryEndpoint = it }
        clientId = config.clientId
        redirectUri = config.redirectUri
        scopes = config.scopes.toMutableSet()
        acrValues = config.acrValues
        signOutRedirectUri = config.signOutRedirectUri
        state = config.state
        nonce = config.nonce
        uiLocales = config.uiLocales
        config.refreshThreshold?.let { refreshThreshold = it }
        loginHint = config.loginHint
        display = config.display
        prompt = config.prompt
        if (config.additionalParameters.isNotEmpty()) {
          additionalParameters = config.additionalParameters
        }
        applyOpenIdIfPresent(config.openId, config.discoveryEndpoint)
        applyStorageIfPresent(config.storageId)
      }
    }
  }

  /**
   * Build a native OIDC client instance.
   *
   * @param config Parsed JS client payload
   * @return Configured native OIDC client
   */
  fun buildOidcClient(config: OidcClientPayload): OidcClient {
    val resolvedLogger = loggerResolver(config.loggerId)
    return OidcClient {
      resolvedLogger?.let { logger = it }
      config.discoveryEndpoint?.let { discoveryEndpoint = it }
      clientId = config.clientId
      redirectUri = config.redirectUri
      scopes = config.scopes.toMutableSet()
      acrValues = config.acrValues
      signOutRedirectUri = config.signOutRedirectUri
      state = config.state
      nonce = config.nonce
      uiLocales = config.uiLocales
      config.refreshThreshold?.let { refreshThreshold = it }
      loginHint = config.loginHint
      display = config.display
      prompt = config.prompt
      if (config.additionalParameters.isNotEmpty()) {
        additionalParameters = config.additionalParameters
      }
      applyOpenIdIfPresent(config.openId, config.discoveryEndpoint)
      applyStorageIfPresent(config.storageId)
    }
  }

  /**
   * Apply storage configuration from Core registry if an id is provided.
   *
   * @param storageId Storage configuration identifier
   */
  private fun OidcClientConfig.applyStorageIfPresent(storageId: String?) {
    if (storageId.isNullOrBlank()) {
      return
    }
    val storageConfig =
      storageRegistry.resolve(storageId) as? StorageConfigHandleContract
        ?: throw IllegalArgumentException("No storage config registered for id=$storageId")
    storage {
      applyStorageConfig(storageConfig)
    }
  }

  /**
   * Apply OpenID configuration fields if an explicit payload is provided.
   *
   * When a discovery endpoint is also configured, the payload is applied as
   * an override on top of the discovered configuration via
   * [OidcClientConfig.openIdOverride] -- only the fields present in the
   * payload replace their discovered value, so an override that supplies
   * only [OpenIdPayload.deviceAuthorizationEndpoint] (for a provider whose
   * discovery document omits it) does not blank out the other endpoints
   * discovery would otherwise resolve.
   *
   * When no discovery endpoint is configured, there is nothing to merge
   * onto: the payload is applied directly as the complete configuration,
   * matching [OpenIdConfiguration]'s own blank-string defaults for any
   * field the payload leaves unset.
   *
   * @param openId Optional OpenID configuration payload
   * @param discoveryEndpoint Discovery endpoint from the same JS payload, if any
   */
  private fun OidcClientConfig.applyOpenIdIfPresent(
    openId: OpenIdPayload?,
    discoveryEndpoint: String?
  ) {
    if (openId == null) {
      return
    }
    if (discoveryEndpoint.isNullOrBlank()) {
      this.openId = OpenIdConfiguration(
        authorizationEndpoint = openId.authorizationEndpoint ?: "",
        tokenEndpoint = openId.tokenEndpoint ?: "",
        userinfoEndpoint = openId.userinfoEndpoint ?: "",
        endSessionEndpoint = openId.endSessionEndpoint ?: "",
        pingEndIdpSessionEndpoint = openId.pingEndIdpSessionEndpoint ?: "",
        revocationEndpoint = openId.revocationEndpoint ?: "",
        deviceAuthorizationEndpoint = openId.deviceAuthorizationEndpoint ?: ""
      )
      return
    }
    openIdOverride = {
      openId.authorizationEndpoint?.let { authorizationEndpoint = it }
      openId.tokenEndpoint?.let { tokenEndpoint = it }
      openId.userinfoEndpoint?.let { userinfoEndpoint = it }
      openId.endSessionEndpoint?.let { endSessionEndpoint = it }
      openId.pingEndIdpSessionEndpoint?.let { pingEndIdpSessionEndpoint = it }
      openId.revocationEndpoint?.let { revocationEndpoint = it }
      openId.deviceAuthorizationEndpoint?.let { deviceAuthorizationEndpoint = it }
    }
  }

  /**
   * Apply storage configuration overrides to the encrypted data store.
   *
   * @param config Parsed JS storage configuration
   */
  private fun EncryptedDataStoreStorageConfig.applyStorageConfig(config: StorageConfigHandleContract) {
    config.fileName?.let { fileName = it }
    config.keyAlias?.let { keyAlias = it }
    config.strongBoxPreferred?.let { strongBoxPreferred = it }
    config.cacheStrategy?.let { cacheStrategy = parseCacheStrategy(it) }
  }

  /**
   * Parse cache strategy strings into native CacheStrategy values.
   *
   * @param rawValue Raw strategy name from JS
   * @return Parsed cache strategy, defaulting to NO_CACHE on unknown values
   */
  private fun parseCacheStrategy(rawValue: String): CacheStrategy {
    return when (rawValue.lowercase()) {
      "cache_on_failure" -> CacheStrategy.CACHE_ON_FAILURE
      "no_cache" -> CacheStrategy.NO_CACHE
      "cache" -> CacheStrategy.CACHE
      else -> runCatching { CacheStrategy.valueOf(rawValue) }.getOrDefault(CacheStrategy.NO_CACHE)
    }
  }
}
