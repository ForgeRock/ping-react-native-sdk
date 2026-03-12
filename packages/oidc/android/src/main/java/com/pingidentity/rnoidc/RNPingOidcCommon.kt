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
import android.util.Log
import com.pingidentity.android.ContextProvider
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.logger.Logger
import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcWeb
import com.pingidentity.oidc.OidcUser
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.oidc.OidcClientConfigHandle
import com.pingidentity.rncore.oidc.OidcOpenIdConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.registry.NativeHandle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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

  private const val TAG = "RNPingOidcCommon"

  /** Scope for all async work dispatched by the bridge. */
  private var scopeJob = SupervisorJob()
  private var scope = CoroutineScope(scopeJob + Dispatchers.Default)
  /** Core registry storing OIDC client configurations. */
  private val clientRegistry = CoreRuntime.oidcClientRegistry
  /** Core registry storing OIDC web clients. */
  private val webRegistry = CoreRuntime.oidcWebClientRegistry
  /** Core registry storing OIDC storage configurations. */
  private val oidcStorageRegistry = CoreRuntime.oidcStorageConfigRegistry
  /** Factory for building native OIDC clients/web clients. */
  private val clientFactory = OidcClientFactory(oidcStorageRegistry) { id ->
    resolveLoggerFromCore(id)
  }
  /** Cached React context for resolving activity when needed. */
  private var appContext: ReactApplicationContext? = null

  /**
   * Resolve a native logger from the shared Core logger registry.
   *
   * @param id Logger handle identifier from JS.
   * @return Native logger instance, or null when missing/invalid.
   */
  private fun resolveLoggerFromCore(id: String?): Logger? {
    if (id.isNullOrBlank()) {
      return null
    }

    val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }


  /**
   * Handle for a stored OIDC client configuration.
   */
  private data class OidcClientHandle(
    val payload: OidcClientPayload,
    val client: OidcClient,
    val user: OidcUser
  ) : NativeHandle, OidcClientConfigHandle {
    override val clientId: String
      get() = payload.clientId

    override val discoveryEndpoint: String?
      get() = payload.discoveryEndpoint

    override val redirectUri: String
      get() = payload.redirectUri

    override val scopes: List<String>
      get() = payload.scopes

    override val openId: OidcOpenIdConfig?
      get() = payload.openId?.let {
        OidcOpenIdConfig(
          authorizationEndpoint = it.authorizationEndpoint,
          tokenEndpoint = it.tokenEndpoint,
          userinfoEndpoint = it.userinfoEndpoint,
          endSessionEndpoint = it.endSessionEndpoint,
          pingEndIdpSessionEndpoint = it.pingEndIdpSessionEndpoint,
          revocationEndpoint = it.revocationEndpoint
        )
      }

    override val acrValues: String?
      get() = payload.acrValues

    override val signOutRedirectUri: String?
      get() = payload.signOutRedirectUri

    override val state: String?
      get() = payload.state

    override val nonce: String?
      get() = payload.nonce

    override val uiLocales: String?
      get() = payload.uiLocales

    override val refreshThreshold: Long?
      get() = payload.refreshThreshold

    override val loginHint: String?
      get() = payload.loginHint

    override val display: String?
      get() = payload.display

    override val prompt: String?
      get() = payload.prompt

    override val additionalParameters: Map<String, String>
      get() = payload.additionalParameters
  }

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
   * @return Unit
   */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    appContext = reactContext
    ContextProvider.init(reactContext.applicationContext)
  }

  /**
   * Clear all stored native OIDC clients and web clients.
   *
   * @remarks
   * Invoked when the React Native bridge is invalidated to prevent
   * leaking native instances across reloads.
   */
  @JvmStatic
  fun cleanup() {
    clientRegistry.removeAll()
    webRegistry.removeAll()
    scopeJob.cancel()
    scopeJob = SupervisorJob()
    scope = CoroutineScope(scopeJob + Dispatchers.Default)
  }

  /**
   * Create a native-backed OIDC client and return its core identifier.
   *
   * @param config JS-provided config map
   * @return Stable identifier for the stored client config
   * @throws IllegalArgumentException when required configuration is missing or invalid
   */
  fun createClient(config: ReadableMap): String {
    val parsed = OidcConfigParser.parseClientConfig(config)
    val client = clientFactory.buildOidcClient(parsed)
    val user = OidcUser(client)
    return clientRegistry.register(OidcClientHandle(parsed, client, user))
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   *
   * @param clientId Identifier returned by [createClient]
   * @return Stable identifier for the created web client
   * @throws IllegalArgumentException when the client id is unknown
   */
  fun createWebClient(clientId: String): String {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
      ?: throw IllegalArgumentException("Unknown OIDC client id: $clientId")
    val webClientId = webRegistry.register(
      OidcWebHandle(clientId, clientFactory.buildWebClient(handle.payload))
    )
    return webClientId
  }

  /**
   * Resolve the current client's tokens.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Bridge promise resolved with token map or rejected with GenericError
   * @return Unit
   */
  fun clientToken(clientId: String, promise: Promise) {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_TOKEN_ERROR,
        message = "No OIDC client found for id $clientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        when (val result = handle.user.token()) {
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeTokens(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_TOKEN_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_TOKEN_ERROR), e)
      }
    }
  }

  /**
   * Force-refresh tokens for the current client.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Bridge promise resolved with token map or rejected with GenericError
   * @return Unit
   */
  fun clientRefresh(clientId: String, promise: Promise) {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_REFRESH_ERROR,
        message = "No OIDC client found for id $clientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        when (val result = handle.user.refresh()) {
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeTokens(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_REFRESH_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_REFRESH_ERROR), e)
      }
    }
  }

  /**
   * Fetch user profile data from the userinfo endpoint for the client.
   *
   * @param clientId Identifier returned by [createClient]
   * @param cache When true, return cached userinfo if available
   * @param promise Bridge promise resolved with userinfo map or rejected with GenericError
   * @return Unit
   */
  fun clientUserinfo(clientId: String, cache: Boolean, promise: Promise) {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_USERINFO_ERROR,
        message = "No OIDC client found for id $clientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        when (val result = handle.user.userinfo(cache)) {
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeUserinfo(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_USERINFO_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_USERINFO_ERROR), e)
      }
    }
  }

  /**
   * Revoke tokens for the current client.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Bridge promise resolved on success or rejected with GenericError
   * @return Unit
   */
  fun clientRevoke(clientId: String, promise: Promise) {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_REVOKE_ERROR,
        message = "No OIDC client found for id $clientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        handle.user.revoke()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_REVOKE_ERROR), e)
      }
    }
  }

  /**
   * Logout the current client session.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Bridge promise resolved with end-session status or rejected with GenericError
   * @return Unit
   */
  fun clientEndSession(clientId: String, promise: Promise) {
    val handle = clientRegistry.resolve(clientId) as? OidcClientHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_LOGOUT_ERROR,
        message = "No OIDC client found for id $clientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        val result = handle.client.endSession()
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_LOGOUT_ERROR), e)
      }
    }
  }

  /**
   * Launch an authorization flow in the system browser.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param options Optional per-request overrides
   * @param promise Bridge promise resolved with success/cancel or rejected with GenericError
   * @return Unit
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

    val authorizeParams = OidcConfigParser.buildAuthorizeParams(options)
    scope.launch(Dispatchers.IO) {
      val result = try {
        withContext(Dispatchers.Main) {
          handle.web.authorize {
            authorizeParams.forEach { (key, value) -> this[key] = value }
          }
        }
      } catch (e: Exception) {
        if (e is BrowserCanceledException || e is CancellationException) {
          val canceled = Arguments.createMap()
          canceled.putString("type", "cancel")
          promise.resolve(canceled)
          return@launch
        }
        promise.reject(OidcErrorMapper.mapAuthorizeThrowable(e), e)
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

      val mapped = OidcErrorMapper.mapAuthorizeThrowable(error)
      promise.reject(mapped, error)
    }
  }

  /**
   * Resolve whether a user is available for the given web client.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved with a boolean or rejected with GenericError
   * @return Unit
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

    scope.launch(Dispatchers.IO) {
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
   * @return Unit
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

    scope.launch(Dispatchers.IO) {
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
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeTokens(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_TOKEN_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_TOKEN_ERROR), e)
      }
    }
  }

  /**
   * Force-refresh tokens for the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved with token map or rejected with GenericError
   * @return Unit
   */
  fun refresh(webClientId: String, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_REFRESH_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        val user = handle.web.user()
        if (user == null) {
          val error = GenericError(
            type = ErrorType.STATE_ERROR,
            error = OidcErrorCodes.OIDC_REFRESH_ERROR,
            message = "No authenticated user is available for this OIDC web client"
          )
          promise.reject(error)
          return@launch
        }

        when (val result = user.refresh()) {
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeTokens(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_REFRESH_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_REFRESH_ERROR), e)
      }
    }
  }

  /**
   * Fetch user profile data from the userinfo endpoint.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param cache When true, return cached userinfo if available
   * @param promise Bridge promise resolved with userinfo map or rejected with GenericError
   * @return Unit
   */
  fun userinfo(webClientId: String, cache: Boolean, promise: Promise) {
    val handle = webRegistry.resolve(webClientId) as? OidcWebHandle
    if (handle == null) {
      val error = GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_USERINFO_ERROR,
        message = "No OIDC web client found for id $webClientId"
      )
      promise.reject(error)
      return
    }

    scope.launch(Dispatchers.IO) {
      try {
        val user = handle.web.user()
        if (user == null) {
          val error = GenericError(
            type = ErrorType.STATE_ERROR,
            error = OidcErrorCodes.OIDC_USERINFO_ERROR,
            message = "No authenticated user is available for this OIDC web client"
          )
          promise.reject(error)
          return@launch
        }

        when (val result = user.userinfo(cache)) {
          is com.pingidentity.utils.Result.Success ->
            promise.resolve(OidcResponseMapper.encodeUserinfo(result.value))
          is com.pingidentity.utils.Result.Failure -> {
            val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_USERINFO_ERROR)
            promise.reject(error)
          }
        }
      } catch (e: Exception) {
        promise.reject(mapThrowableToGenericError(e, OidcErrorCodes.OIDC_USERINFO_ERROR), e)
      }
    }
  }

  /**
   * Revoke tokens for the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Bridge promise resolved on success or rejected with GenericError
   * @return Unit
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

    scope.launch(Dispatchers.IO) {
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
   * @return Unit
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

    scope.launch(Dispatchers.IO) {
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

  // Intentionally no Activity sync here; Ping SDK manages its own context.
}
