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
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.util.Log
import com.pingidentity.android.ContextProvider
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.logger.Logger
import com.pingidentity.oidc.DeviceFlowStatus
import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcDeviceClient
import com.pingidentity.oidc.OidcError
import com.pingidentity.oidc.OidcWebClient
import com.pingidentity.oidc.OidcUser
import com.pingidentity.oidc.Token
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.oidc.OidcClientConfigHandle
import com.pingidentity.rncore.oidc.OidcOpenIdConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.utils.launchBridge
import com.pingidentity.utils.Result
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

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
  private data class OidcDeviceHandle(
    val payload: OidcClientPayload,
    val client: OidcDeviceClient,
    val user: OidcUser,
  ) : NativeHandle
  private val deviceRegistry = ConcurrentHashMap<String, OidcDeviceHandle>()
  private val deviceJobs = ConcurrentHashMap<String, Pair<String, Job>>()
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
   * @property web The native OidcWebClient instance
   */
  private data class OidcWebHandle(
    val clientId: String,
    val web: OidcWebClient
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
    deviceJobs.values.forEach { it.second.cancel() }
    deviceJobs.clear()
    deviceRegistry.clear()
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

  fun deviceAuthorize(deviceClientId: String, promise: Promise) {
    val handle = deviceRegistry[deviceClientId]
    if (handle == null) {
      promise.reject(GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_DEVICE_AUTHORIZE_ERROR,
        message = "No OIDC device client found for id $deviceClientId"
      ))
      return
    }
    val subscriptionId = UUID.randomUUID().toString()
    val context = appContext
    if (context == null) {
      promise.reject(GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_DEVICE_AUTHORIZE_ERROR,
        message = "React application context is unavailable"
      ))
      return
    }
    val job = scope.launch {
      try {
        handle.client.deviceAuthorization().collect { status ->
          val event = Arguments.createMap().apply {
            putString("deviceClientId", deviceClientId)
            putString("subscriptionId", subscriptionId)
            putMap("status", OidcResponseMapper.encodeDeviceStatus(status))
          }
          context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("RNPingOidc_DeviceFlowStatus", event)
        }
      } catch (e: CancellationException) {
        throw e
      } catch (e: Exception) {
        val event = Arguments.createMap().apply {
          putString("deviceClientId", deviceClientId)
          putString("subscriptionId", subscriptionId)
          putMap("status", Arguments.createMap().apply {
            putString("type", "failure")
            putMap("error", Arguments.createMap().apply {
              putString("message", e.message ?: "Device authorization failed")
            })
          })
        }
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("RNPingOidc_DeviceFlowStatus", event)
      } finally {
        deviceJobs.remove(subscriptionId)
      }
    }
    deviceJobs[subscriptionId] = deviceClientId to job
    val result = Arguments.createMap().apply { putString("subscriptionId", subscriptionId) }
    promise.resolve(result)
  }

  fun cancelDeviceAuthorization(deviceClientId: String, subscriptionId: String, promise: Promise) {
    deviceJobs.remove(subscriptionId)?.second?.cancel()
    promise.resolve(null)
  }

  /**
   * Open a device authorization verification URL in the on-device browser.
   *
   * Delegates to the native SDK's `OidcDeviceClient.authorize(verificationUri)`
   * which launches a Custom Tab / Auth Tab. Dismissing the browser resolves
   * with a `cancel` result; the authorization polling loop continues
   * independently of this call.
   *
   * @param deviceClientId Identifier returned by [createOidcDeviceClient]
   * @param verificationUri Verification URI (prefer `verification_uri_complete`)
   * @param promise Bridge promise resolved with success/cancel or rejected with GenericError
   * @return Unit
   */
  fun deviceOpenVerificationUrl(deviceClientId: String, verificationUri: String, promise: Promise) {
    val handle = deviceRegistry[deviceClientId]
    if (handle == null) {
      promise.reject(GenericError(
        type = ErrorType.STATE_ERROR,
        error = OidcErrorCodes.OIDC_DEVICE_AUTHORIZE_ERROR,
        message = "No OIDC device client found for id $deviceClientId"
      ))
      return
    }
    scope.launchBridge(promise, OidcErrorCodes.OIDC_DEVICE_AUTHORIZE_ERROR, Dispatchers.IO) {
      try {
        withContext(Dispatchers.Main) {
          handle.client.authorize(verificationUri)
        }
        val payload = Arguments.createMap()
        payload.putString("type", "success")
        promise.resolve(payload)
      } catch (e: CancellationException) {
        throw e
      } catch (e: BrowserCanceledException) {
        val canceled = Arguments.createMap()
        canceled.putString("type", "cancel")
        promise.resolve(canceled)
      } catch (e: Exception) {
        promise.reject(OidcErrorMapper.mapAuthorizeThrowable(e), e)
      }
    }
  }

  fun deviceHasUser(deviceClientId: String, promise: Promise) {
    val handle = deviceRegistry[deviceClientId]
    if (handle == null) {
      promise.reject(GenericError(ErrorType.STATE_ERROR, OidcErrorCodes.OIDC_DEVICE_USER_ERROR, "No OIDC device client found for id $deviceClientId"))
      return
    }
    scope.launchBridge(promise, OidcErrorCodes.OIDC_DEVICE_USER_ERROR, Dispatchers.IO) {
      promise.resolve(handle.client.user() != null)
    }
  }

  fun deviceToken(deviceClientId: String, promise: Promise) = deviceUserOperation(deviceClientId, promise, OidcErrorCodes.OIDC_DEVICE_TOKEN_ERROR) { it.token() }
  fun deviceRefresh(deviceClientId: String, promise: Promise) = deviceUserOperation(deviceClientId, promise, OidcErrorCodes.OIDC_DEVICE_REFRESH_ERROR) { it.refresh() }
  fun deviceUserinfo(deviceClientId: String, cache: Boolean, promise: Promise) = deviceUserOperation(deviceClientId, promise, OidcErrorCodes.OIDC_DEVICE_USERINFO_ERROR) { it.userinfo(cache) }

  private fun deviceUserOperation(
    deviceClientId: String,
    promise: Promise,
    errorCode: String,
    operation: suspend (OidcUser) -> Any?,
  ) {
    val handle = deviceRegistry[deviceClientId]
    if (handle == null) {
      promise.reject(GenericError(ErrorType.STATE_ERROR, errorCode, "No OIDC device client found for id $deviceClientId"))
      return
    }
    scope.launchBridge(promise, errorCode, Dispatchers.IO) {
      when (val result = operation(handle.user)) {
        is Result.Success<*> -> {
          val value = result.value
          promise.resolve(when (value) {
            is Token -> OidcResponseMapper.encodeTokens(value)
            is JsonObject -> OidcResponseMapper.encodeUserinfo(value)
            else -> value
          })
        }
        is Result.Failure<*> -> {
          val failure = result as Result.Failure<OidcError>
          promise.reject(OidcErrorMapper.mapOidcError(failure.value, errorCode))
        }
        else -> promise.resolve(result)
      }
    }
  }

  fun deviceRevoke(deviceClientId: String, promise: Promise) = deviceUnitOperation(deviceClientId, promise, OidcErrorCodes.OIDC_DEVICE_REVOKE_ERROR) { it.revoke() }
  fun deviceLogout(deviceClientId: String, promise: Promise) = deviceUnitOperation(deviceClientId, promise, OidcErrorCodes.OIDC_DEVICE_LOGOUT_ERROR) { it.logout() }

  private fun deviceUnitOperation(deviceClientId: String, promise: Promise, errorCode: String, operation: suspend (OidcUser) -> Unit) {
    val handle = deviceRegistry[deviceClientId]
    if (handle == null) {
      promise.reject(GenericError(ErrorType.STATE_ERROR, errorCode, "No OIDC device client found for id $deviceClientId"))
      return
    }
    scope.launchBridge(promise, errorCode, Dispatchers.IO) {
      operation(handle.user)
      promise.resolve(null)
    }
  }

  fun disposeOidcDeviceClient(deviceClientId: String, promise: Promise) {
    deviceJobs.entries.removeIf { entry ->
      if (entry.value.first == deviceClientId) {
        entry.value.second.cancel()
        true
      } else {
        false
      }
    }
    deviceRegistry.remove(deviceClientId)
    promise.resolve(null)
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   *
   * @param clientId Identifier returned by [createClient]
   * @return Stable identifier for the created web client
   * @throws IllegalArgumentException when the client id is unknown
   */
  fun createOidcDeviceClient(config: ReadableMap): String {
    val parsed = OidcConfigParser.parseClientConfig(config)
    val nativeConfig = clientFactory.buildOidcClientConfig(parsed)
    val client = OidcDeviceClient(nativeConfig)
    val user = OidcUser(nativeConfig)
    val id = UUID.randomUUID().toString()
    deviceRegistry[id] = OidcDeviceHandle(parsed, client, user)
    return id
  }

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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_TOKEN_ERROR, Dispatchers.IO) {
      when (val result = handle.user.token()) {
        is Result.Success<Token> ->
          promise.resolve(OidcResponseMapper.encodeTokens(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_TOKEN_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_REFRESH_ERROR, Dispatchers.IO) {
      when (val result = handle.user.refresh()) {
        is Result.Success<Token> ->
          promise.resolve(OidcResponseMapper.encodeTokens(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_REFRESH_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_USERINFO_ERROR, Dispatchers.IO) {
      when (val result = handle.user.userinfo(cache)) {
        is Result.Success<JsonObject> ->
          promise.resolve(OidcResponseMapper.encodeUserinfo(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_USERINFO_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_REVOKE_ERROR, Dispatchers.IO) {
      handle.user.revoke()
      promise.resolve(null)
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_LOGOUT_ERROR, Dispatchers.IO) {
      val result = handle.client.endSession()
      promise.resolve(result)
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
    scope.launchBridge(promise, OidcErrorCodes.OIDC_AUTHORIZE_ERROR, Dispatchers.IO) {
      val result = try {
        withContext(Dispatchers.Main) {
          handle.web.authorize {
            authorizeParams.forEach { (key, value) -> this[key] = value }
          }
        }
      } catch (e: CancellationException) {
        throw e
      } catch (e: Exception) {
        if (e is BrowserCanceledException) {
          val canceled = Arguments.createMap()
          canceled.putString("type", "cancel")
          promise.resolve(canceled)
          return@launchBridge
        }
        promise.reject(OidcErrorMapper.mapAuthorizeThrowable(e), e)
        return@launchBridge
      }

      if (result.isSuccess) {
        val payload = Arguments.createMap()
        payload.putString("type", "success")
        promise.resolve(payload)
        return@launchBridge
      }

      val error = result.exceptionOrNull()
      if (error is BrowserCanceledException) {
        val canceled = Arguments.createMap()
        canceled.putString("type", "cancel")
        promise.resolve(canceled)
        return@launchBridge
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_HAS_USER_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      promise.resolve(user != null)
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_TOKEN_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      if (user == null) {
        val error = GenericError(
          type = ErrorType.STATE_ERROR,
          error = OidcErrorCodes.OIDC_TOKEN_ERROR,
          message = "No authenticated user is available for this OIDC web client"
        )
        promise.reject(error)
        return@launchBridge
      }

      when (val result = user.token()) {
        is Result.Success<Token> ->
          promise.resolve(OidcResponseMapper.encodeTokens(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_TOKEN_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_REFRESH_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      if (user == null) {
        val error = GenericError(
          type = ErrorType.STATE_ERROR,
          error = OidcErrorCodes.OIDC_REFRESH_ERROR,
          message = "No authenticated user is available for this OIDC web client"
        )
        promise.reject(error)
        return@launchBridge
      }

      when (val result = user.refresh()) {
        is Result.Success<Token> ->
          promise.resolve(OidcResponseMapper.encodeTokens(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_REFRESH_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_USERINFO_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      if (user == null) {
        val error = GenericError(
          type = ErrorType.STATE_ERROR,
          error = OidcErrorCodes.OIDC_USERINFO_ERROR,
          message = "No authenticated user is available for this OIDC web client"
        )
        promise.reject(error)
        return@launchBridge
      }

      when (val result = user.userinfo(cache)) {
        is Result.Success<JsonObject> ->
          promise.resolve(OidcResponseMapper.encodeUserinfo(result.value))
        is Result.Failure<OidcError> -> {
          val error = OidcErrorMapper.mapOidcError(result.value, OidcErrorCodes.OIDC_USERINFO_ERROR)
          promise.reject(error)
        }
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_REVOKE_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      if (user == null) {
        val error = GenericError(
          type = ErrorType.STATE_ERROR,
          error = OidcErrorCodes.OIDC_REVOKE_ERROR,
          message = "No authenticated user is available for this OIDC web client"
        )
        promise.reject(error)
        return@launchBridge
      }
      user.revoke()
      promise.resolve(null)
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

    scope.launchBridge(promise, OidcErrorCodes.OIDC_LOGOUT_ERROR, Dispatchers.IO) {
      val user = handle.web.user()
      if (user == null) {
        val error = GenericError(
          type = ErrorType.STATE_ERROR,
          error = OidcErrorCodes.OIDC_LOGOUT_ERROR,
          message = "No authenticated user is available for this OIDC web client"
        )
        promise.reject(error)
        return@launchBridge
      }
      user.logout()
      promise.resolve(null)
    }
  }

  // Intentionally no Activity sync here; Ping SDK manages its own context.

  fun disposeClient(clientId: String, promise: Promise) {
    // SimpleRegistry uses ConcurrentHashMap — remove() is thread-safe without coroutine dispatch.
    clientRegistry.remove(clientId)
    promise.resolve(null)
  }

  fun disposeWebClient(webClientId: String, promise: Promise) {
    // SimpleRegistry uses ConcurrentHashMap — remove() is thread-safe without coroutine dispatch.
    webRegistry.remove(webClientId)
    promise.resolve(null)
  }
}
