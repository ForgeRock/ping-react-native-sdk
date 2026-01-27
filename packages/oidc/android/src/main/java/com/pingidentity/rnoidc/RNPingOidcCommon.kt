/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.pingidentity.android.ContextProvider
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.exception.ApiException
import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcClientConfig
import com.pingidentity.oidc.OidcError
import com.pingidentity.oidc.OidcWeb
import com.pingidentity.oidc.Token
import com.pingidentity.oidc.exception.AuthorizeException
import com.pingidentity.oidc.module.Oidc
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.error.GenericError
import com.reactnativepingidentity.core.error.mapThrowableToGenericError
import com.reactnativepingidentity.core.error.reject
import com.reactnativepingidentity.core.registry.NativeHandle
import com.reactnativepingidentity.core.utils.buildTokenMap
import com.reactnativepingidentity.core.utils.readStringMap
import com.reactnativepingidentity.core.utils.requireString
import com.reactnativepingidentity.core.utils.requireStringArray
import com.reactnativepingidentity.storage.StorageConfig
import com.reactnativepingidentity.storage.StorageConfigRegistry
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Shared Android implementation for the Ping OIDC React Native module.
 *
 * @remarks
 * This object manages lifecycle-safe, JS-facing handles for native OIDC clients
 * and web clients. It keeps native instances in-memory to preserve state across
 * bridge calls and ensures promise rejections map to the shared GenericError
 * contract.
 */
object RNPingOidcCommon {

  /** Scope for all async work dispatched by the bridge. */
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  /** Core registry storing OIDC client configurations. */
  private val clientRegistry = CoreRuntime.oidcClientRegistry
  /** Core registry storing OIDC web clients. */
  private val webRegistry = CoreRuntime.oidcWebClientRegistry
  /** Core registry storing OIDC storage configurations. */
  private val oidcStorageRegistry = StorageConfigRegistry(CoreRuntime.oidcStorageConfigRegistry)
  /** Cached React context for resolving activity when needed. */
  private var appContext: ReactApplicationContext? = null

  /**
   * Lightweight wrapper around parsed client configuration.
   *
   * @property clientId Native OIDC client identifier
   * @property discoveryEndpoint OpenID discovery endpoint
   * @property redirectUri Redirect URI for auth responses
   * @property scopes OIDC scopes requested
   * @property storageId Optional storage config id registered by the Storage module
   * @property acrValues Optional ACR values
   * @property loginHint Optional login hint
   * @property display Optional display parameter
   * @property prompt Optional prompt parameter
   * @property additionalParameters Provider-specific parameters
   */
  private data class OidcClientPayload(
    val clientId: String,
    val discoveryEndpoint: String,
    val redirectUri: String,
    val scopes: List<String>,
    val storageId: String?,
    val acrValues: String?,
    val loginHint: String?,
    val display: String?,
    val prompt: String?,
    val additionalParameters: Map<String, String>
  )

  /**
   * Handle for a stored OIDC client configuration.
   */
  private data class OidcClientHandle(
    val payload: OidcClientPayload,
    val client: OidcClient
  ) : NativeHandle

  /**
   * Handle for a configured web client.
   *
   * @property clientId The parent OIDC client id
   * @property web The native OidcWeb instance
   */
  private data class OidcWebHandle(
    val clientId: String,
    val web: OidcWeb
  ) : NativeHandle

  /**
   * Ensure the native Ping SDK is initialized with the app context.
   *
   * @param reactContext React application context from the module instance
   */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    appContext = reactContext
    ContextProvider.init(reactContext.applicationContext)
  }

  /**
   * Create a native-backed OIDC client and return its core identifier.
   *
   * @param config JS-provided config map
   * @return Stable identifier for the stored client config
   */
  fun createClient(config: ReadableMap): String {
    val parsed = parseClientConfig(config)
    val client = buildOidcClient(parsed)
    return clientRegistry.register(OidcClientHandle(parsed, client))
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   *
   * @param clientId Identifier returned by [createClient]
   * @return Stable identifier for the created web client
   */
  fun createWebClient(clientId: String): String {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
      ?: throw IllegalArgumentException("Unknown OIDC client id: $clientId")
    val webClientId = webRegistry.register(
      OidcWebHandle(clientId, buildWebClient(handle.payload))
    )
    return webClientId
  }

  /**
   * Launch an authorization flow in the system browser.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param options Optional per-request overrides
   * @param promise Bridge promise resolved with success/cancel or rejected with GenericError
   */
  fun authorize(webClientId: String, options: ReadableMap, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_AUTHORIZE_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    val authorizeParams = buildAuthorizeParams(options)
    scope.launch {
      updateCurrentActivity()
      val result = try {
        handle.web.authorize {
          authorizeParams.forEach { (key, value) -> this[key] = value }
        }
      } catch (e: Exception) {
        if (e is BrowserCanceledException || e is CancellationException) {
          val canceled = Arguments.createMap()
          canceled.putString("type", "cancel")
          promise.resolve(canceled)
          return@launch
        }
        promise.reject(mapAuthorizeThrowable(e), e)
        return@launch
      }

      if (result.isSuccess) {
        val payload = Arguments.createMap()
        payload.putString("type", "success")
        promise.resolve(payload)
        return@launch
      }

      val error = result.exceptionOrNull()
      if (error is BrowserCanceledException || error is CancellationException) {
        val canceled = Arguments.createMap()
        canceled.putString("type", "cancel")
        promise.resolve(canceled)
        return@launch
      }

      val mapped = mapAuthorizeThrowable(error)
      promise.reject(mapped, error)
    }
  }

  /**
   * Resolve whether a user is available for the given web client.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved with a boolean or rejected with GenericError
   */
  fun hasUser(webClientId: String, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_HAS_USER_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch {
      try {
        val user = handle.web.user()
        promise.resolve(user != null)
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_HAS_USER_ERROR), e)
      }
    }
  }

  /**
   * Resolve the current user's tokens.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved with token map or rejected with GenericError
   */
  fun token(webClientId: String, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_TOKEN_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch {
      try {
        val user = handle.web.user()
        if (user == null) {
          val error = GenericError(
            type = ErrorType.STATE_ERROR,
            error = OidcErrorCodes.OIDC_TOKEN_ERROR,
            message = "No authenticated user is available for this OIDC web client"
          )
          promise.reject(error)
          return@launch
        }

        when (val result = user.token()) {
          is com.pingidentity.utils.Result.Success -> promise.resolve(encodeTokens(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = mapOidcError(result.value, OidcErrorCodes.OIDC_TOKEN_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_TOKEN_ERROR), e)
      }
    }
  }

  /**
   * Revoke tokens for the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved on success or rejected with GenericError
   */
  fun revoke(webClientId: String, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_REVOKE_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch {
      try {
        val user = handle.web.user()
        if (user == null) {
          val error = GenericError(
            type = ErrorType.STATE_ERROR,
            error = OidcErrorCodes.OIDC_REVOKE_ERROR,
            message = "No authenticated user is available for this OIDC web client"
          )
          promise.reject(error)
          return@launch
        }
        user.revoke()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_REVOKE_ERROR), e)
      }
    }
  }

  /**
   * Logout the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved on success or rejected with GenericError
   */
  fun logout(webClientId: String, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_LOGOUT_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch {
      try {
        val user = handle.web.user()
        if (user == null) {
          val error = GenericError(
            type = ErrorType.STATE_ERROR,
            error = OidcErrorCodes.OIDC_LOGOUT_ERROR,
            message = "No authenticated user is available for this OIDC web client"
          )
          promise.reject(error)
          return@launch
        }
        user.logout()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_LOGOUT_ERROR), e)
      }
    }
  }

  /**
   * Parse and validate the JS configuration payload for an OIDC client.
   *
   * @throws IllegalArgumentException when required fields are missing
   */
  private fun parseClientConfig(config: ReadableMap): OidcClientPayload {
    val clientId = requireString(config, "clientId")
    val discoveryEndpoint = requireString(config, "discoveryEndpoint")
    val redirectUri = requireString(config, "redirectUri")
    val scopes = requireStringArray(config, "scopes")

    return OidcClientPayload(
      clientId = clientId,
      discoveryEndpoint = discoveryEndpoint,
      redirectUri = redirectUri,
      scopes = scopes,
      storageId = if (config.hasKey("storageId")) config.getString("storageId") else null,
      acrValues = if (config.hasKey("acrValues")) config.getString("acrValues") else null,
      loginHint = if (config.hasKey("loginHint")) config.getString("loginHint") else null,
      display = if (config.hasKey("display")) config.getString("display") else null,
      prompt = if (config.hasKey("prompt")) config.getString("prompt") else null,
      additionalParameters = if (config.hasKey("additionalParameters")) {
        readStringMap(config.getMap("additionalParameters"))
      } else {
        emptyMap()
      }
    )
  }

  /**
   * Build a configured OIDC web client from stored JS configuration.
   *
   * @param config Parsed OIDC configuration
   * @return Configured native OidcWeb instance
   */
  private fun buildWebClient(config: OidcClientPayload): OidcWeb {
    return OidcWeb {
      module(Oidc) {
        discoveryEndpoint = config.discoveryEndpoint
        clientId = config.clientId
        redirectUri = config.redirectUri
        scopes = config.scopes.toMutableSet()
        acrValues = config.acrValues
        loginHint = config.loginHint
        display = config.display
        prompt = config.prompt
        if (config.additionalParameters.isNotEmpty()) {
          additionalParameters = config.additionalParameters
        }
        applyStorageIfPresent(config.storageId)
      }
    }
  }

  /**
   * Build a native OIDC client instance for registration in core.
   *
   * @param config Parsed OIDC configuration
   * @return Configured native OidcClient instance
   */
  private fun buildOidcClient(config: OidcClientPayload): OidcClient {
    return OidcClient {
      discoveryEndpoint = config.discoveryEndpoint
      clientId = config.clientId
      redirectUri = config.redirectUri
      scopes = config.scopes.toMutableSet()
      acrValues = config.acrValues
      loginHint = config.loginHint
      display = config.display
      prompt = config.prompt
      if (config.additionalParameters.isNotEmpty()) {
        additionalParameters = config.additionalParameters
      }
      applyStorageIfPresent(config.storageId)
    }
  }

  /**
   * Apply storage configuration from Core registry if an id is provided.
   *
   * @param storageId Identifier registered by the storage module
   */
  private fun EncryptedDataStoreStorageConfig.applyStorageConfig(config: StorageConfig) {
    config.fileName?.let { fileName = it }
    config.keyAlias?.let { keyAlias = it }
    config.strongBoxPreferred?.let { strongBoxPreferred = it }
    config.cacheStrategy?.let { cacheStrategy = parseCacheStrategy(it) }
  }

  private fun OidcClientConfig.applyStorageIfPresent(storageId: String?) {
    if (storageId.isNullOrBlank()) {
      return
    }
    val storageConfig = oidcStorageRegistry.resolve(storageId)
    storage {
      applyStorageConfig(storageConfig)
    }
  }

  private fun parseCacheStrategy(rawValue: String): CacheStrategy {
    return when (rawValue.lowercase()) {
      "cache_on_failure" -> CacheStrategy.CACHE_ON_FAILURE
      "no_cache" -> CacheStrategy.NO_CACHE
      "cache" -> CacheStrategy.CACHE
      else -> runCatching { CacheStrategy.valueOf(rawValue) }.getOrDefault(CacheStrategy.NO_CACHE)
    }
  }

  /**
   * Convert native tokens into the JS-facing token payload.
   *
   * @param token Native token model
   * @return Writable map that matches JS Tokens shape
   */
  private fun encodeTokens(token: Token): ReadableMap {
    val expiresAt = (System.currentTimeMillis() / 1000) + token.expiresIn
    return buildTokenMap(
      accessToken = token.accessToken,
      idToken = token.idToken,
      refreshToken = token.refreshToken,
      tokenExpiry = expiresAt
    )
  }

  /**
   * Build per-request authorization parameters from optional overrides.
   *
   * @param options JS override map
   * @return Flat key/value map for the native OIDC flow
   */
  private fun buildAuthorizeParams(options: ReadableMap): Map<String, String> {
    val params = mutableMapOf<String, String>()
    if (options.hasKey("acrValues")) {
      options.getString("acrValues")?.takeIf { it.isNotBlank() }?.let { params["acrValues"] = it }
    }
    if (options.hasKey("loginHint")) {
      options.getString("loginHint")?.takeIf { it.isNotBlank() }?.let { params["loginHint"] = it }
    }
    if (options.hasKey("display")) {
      options.getString("display")?.takeIf { it.isNotBlank() }?.let { params["display"] = it }
    }
    if (options.hasKey("prompt")) {
      options.getString("prompt")?.takeIf { it.isNotBlank() }?.let { params["prompt"] = it }
    }
    val additional = if (options.hasKey("additionalParameters")) {
      readStringMap(options.getMap("additionalParameters"))
    } else {
      emptyMap()
    }
    params.putAll(additional)
    return params
  }

  /**
   * Map authorization failures into the shared error contract.
   */
  private fun mapAuthorizeThrowable(error: Throwable?): GenericError {
    return when (error) {
      is AuthorizeException -> GenericError(
        type = ErrorType.AUTH_ERROR,
        error = OidcErrorCodes.OIDC_AUTHORIZE_ERROR,
        message = error.message
      )
      is ApiException -> GenericError(
        type = ErrorType.EXCHANGE_ERROR,
        error = OidcErrorCodes.OIDC_AUTHORIZE_ERROR,
        message = error.message,
        status = error.status
      )
      else -> mapThrowableToGenericError(error, OidcErrorCodes.OIDC_AUTHORIZE_ERROR)
    }
  }

  /**
   * Map OIDC SDK error results into the shared error contract.
   */
  private fun mapOidcError(error: OidcError, code: String): GenericError {
    return when (error) {
      is OidcError.AuthorizeError -> GenericError(
        type = ErrorType.AUTH_ERROR,
        error = code,
        message = error.cause.message
      )
      is OidcError.NetworkError -> GenericError(
        type = ErrorType.NETWORK_ERROR,
        error = code,
        message = error.cause.message
      )
      is OidcError.ApiError -> GenericError(
        type = ErrorType.EXCHANGE_ERROR,
        error = code,
        message = error.message,
        status = error.code
      )
      is OidcError.Unknown -> GenericError(
        type = ErrorType.UNKNOWN_ERROR,
        error = code,
        message = error.cause.message
      )
    }
  }

  /**
   * Update any native activity context if needed.
   *
   * @remarks
   * The Ping SDK's ContextProvider exposes currentActivity internally, so we
   * cannot set it here. This hook exists for future SDK visibility changes.
   */
  private fun updateCurrentActivity() {
    // ContextProvider exposes currentActivity as internal; no-op for now.
  }
}
