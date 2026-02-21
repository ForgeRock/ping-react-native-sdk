/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.journey.plugin.callbacks
import com.pingidentity.journey.resume
import com.pingidentity.journey.session
import com.pingidentity.journey.start
import com.pingidentity.journey.user
import com.pingidentity.logger.Logger
import com.pingidentity.logger.NONE
import com.pingidentity.logger.STANDARD
import com.pingidentity.logger.WARN
import com.pingidentity.oidc.Token
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.utils.Result
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.error.GenericError
import com.reactnativepingidentity.core.error.reject
import com.reactnativepingidentity.core.logger.LoggerHandleContract
import com.reactnativepingidentity.core.registry.NativeHandle
import com.reactnativepingidentity.core.utils.JsonBridgeMapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Shared Android runtime orchestration for Turbo and classic Journey bridge modules.
 */
internal object RNPingJourneyCommon {

  /**
   * Creates an IO-backed coroutine scope used for native bridge operations.
   *
   * @return Fresh coroutine scope with supervisor semantics.
   */
  private fun createScope(): CoroutineScope {
    return CoroutineScope(SupervisorJob() + Dispatchers.IO)
  }

  /** Indicates whether shared runtime wiring has been initialized. */
  private var configured = false
  /** Factory used to create native Journey workflows from parsed payloads. */
  private lateinit var clientFactory: JourneyClientFactory

  /** Coroutine scope used for all async bridge work. */
  private var scope: CoroutineScope = createScope()
  /** Core registry storing Journey workflow handles. */
  private val journeyRegistry = CoreRuntime.journeyRegistry
  /** Last known node for each active journey id. */
  private val nodeMap = ConcurrentHashMap<String, Node>()
  /** Active continue-node cache used for callback mutation resolution. */
  private val continueNodeMap = ConcurrentHashMap<String, ContinueNode>()

  /**
   * Handle for a stored Journey workflow.
   *
   * @property workflow Native workflow instance.
   */
  private data class JourneyHandle(
    val workflow: Workflow
  ) : NativeHandle

  /**
   * Initialize common runtime wiring for Journey bridge calls.
   */
  @Synchronized
  fun configure() {
    if (configured) {
      return
    }
    val sessionStorageRegistry = CoreRuntime.sessionStorageConfigRegistry
    val oidcStorageRegistry = CoreRuntime.oidcStorageConfigRegistry
    clientFactory = JourneyClientFactory(sessionStorageRegistry, oidcStorageRegistry) { loggerId ->
      resolveLoggerFromCore(loggerId)
    }
    CoreRuntime.journeyCallbackResolver = { journeyId ->
      continueNodeMap[journeyId]?.callbacks?.map { it as Any }
    }
    configured = true
  }

  /**
   * Release shared runtime state.
   */
  @Synchronized
  fun cleanup() {
    if (!configured) {
      return
    }
    CoreRuntime.journeyCallbackResolver = null
    scope.cancel()
    scope = createScope()
    disposeAll()
    configured = false
  }

  /**
   * Stores current node state for a Journey instance.
   *
   * @param journeyId Native journey instance id.
   * @param node Latest node returned by the SDK.
   */
  private fun setNodeState(journeyId: String, node: Node) {
    nodeMap[journeyId] = node
    if (node is ContinueNode) {
      continueNodeMap[journeyId] = node
    } else {
      continueNodeMap.remove(journeyId)
    }
  }

  /**
   * Clears tracked node state for a Journey instance.
   *
   * @param journeyId Native journey instance id.
   */
  private fun clearNodeState(journeyId: String) {
    nodeMap.remove(journeyId)
    continueNodeMap.remove(journeyId)
  }

  /**
   * Disposes all tracked Journey clients and nodes.
   */
  private fun disposeAll() {
    continueNodeMap.values.forEach { node ->
      runCatching { node.close() }
    }
    continueNodeMap.clear()
    nodeMap.clear()
    journeyRegistry.removeAll()
  }

  /**
   * Removes one Journey runtime and associated state.
   *
   * @param journeyId Native journey instance id.
   */
  private fun removeJourney(journeyId: String) {
    continueNodeMap.remove(journeyId)?.let { node ->
      runCatching { node.close() }
    }
    nodeMap.remove(journeyId)
    journeyRegistry.remove(journeyId)
  }

  /**
   * Resolves a Journey workflow handle by id.
   *
   * @param journeyId Native journey instance id.
   * @return Workflow when the id is registered, otherwise null.
   */
  private fun resolveWorkflow(journeyId: String): Workflow? {
    return (journeyRegistry.resolve(journeyId) as? JourneyHandle)?.workflow
  }

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
    return when (handle.loggerLevel.uppercase()) {
      "STANDARD" -> Logger.STANDARD
      "WARN" -> Logger.WARN
      "NONE" -> Logger.NONE
      else -> Logger.NONE
    }
  }

  /**
   * Configure a native Journey workflow from JS configuration.
   *
   * @param config Bridge config payload.
   * @param promise Promise resolved with journey id.
   * @throws IllegalArgumentException when configuration payload is invalid.
   * @throws IllegalStateException when workflow creation fails.
   */
  fun configureJourney(config: ReadableMap, promise: Promise) {
    val payload = try {
      JourneyConfigParser.parse(config)
    } catch (error: Exception) {
      promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.CONFIG), error)
      return
    }

    try {
      val workflow = clientFactory.build(payload)
      val journeyId = journeyRegistry.register(JourneyHandle(workflow))
      promise.resolve(journeyId)
    } catch (error: Exception) {
      promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.INIT), error)
    }
  }

  /**
   * Start a configured Journey by name.
   *
   * @param journeyId Native journey instance id.
   * @param journeyName Journey/tree name to execute.
   * @param options Optional start flags (`forceAuth`, `noSession`).
   * @param promise Promise resolved with the first node payload.
   */
  fun start(journeyId: String, journeyName: String, options: ReadableMap?, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    if (journeyName.isBlank()) {
      promise.reject(
        JourneyErrorMapper.argument(
          JourneyErrorCodes.START,
          "Journey name must not be empty"
        )
      )
      return
    }

    val forceAuth = options?.getBoolean("forceAuth") ?: false
    val noSession = options?.getBoolean("noSession") ?: false

    scope.launch {
      try {
        val node = workflow.start(journeyName) {
          this.forceAuth = forceAuth
          this.noSession = noSession
        }
        setNodeState(journeyId, node)
        promise.resolve(JourneyNodeMapper.mapNode(node))
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.START), error)
      }
    }
  }

  /**
   * Apply callback input and progress to the next Journey node.
   *
   * @param journeyId Native journey instance id.
   * @param input Callback mutation payload for the active `ContinueNode`.
   * @param promise Promise resolved with the next node payload.
   */
  fun next(journeyId: String, input: ReadableMap, promise: Promise) {
    val currentNode = continueNodeMap[journeyId]
    if (currentNode == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "No active ContinueNode found for journey id=$journeyId"
        )
      )
      return
    }

    try {
      val mutations = JourneyCallbackValueApplier.parseInput(input)
      if (mutations.isNotEmpty()) {
        JourneyCallbackValueApplier.apply(currentNode, mutations)
      }
    } catch (error: IllegalStateException) {
      promise.reject(
        GenericError(
          type = ErrorType.STATE_ERROR,
          error = JourneyErrorCodes.MISSING_INTEGRATION,
          message = error.message
        ),
        error
      )
      return
    } catch (error: UnsupportedOperationException) {
      promise.reject(
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = JourneyErrorCodes.UNSUPPORTED_CALLBACK,
          message = error.message
        ),
        error
      )
      return
    } catch (error: IllegalArgumentException) {
      promise.reject(
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = JourneyErrorCodes.CALLBACK_APPLY,
          message = error.message
        ),
        error
      )
      return
    }

    scope.launch {
      try {
        val nextNode = currentNode.next()
        setNodeState(journeyId, nextNode)
        promise.resolve(JourneyNodeMapper.mapNode(nextNode))
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.NEXT), error)
      }
    }
  }

  /**
   * Resume a suspended Journey flow with a callback URI.
   *
   * @param journeyId Native journey instance id.
   * @param uri Resume URI received from external redirect/magic-link flow.
   * @param promise Promise resolved with the resumed node payload.
   */
  fun resume(journeyId: String, uri: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    if (uri.isBlank()) {
      promise.reject(
        JourneyErrorMapper.argument(
          JourneyErrorCodes.RESUME,
          "Resume URI must not be empty"
        )
      )
      return
    }

    scope.launch {
      try {
        val resumedNode = workflow.resume(Uri.parse(uri))
        setNodeState(journeyId, resumedNode)
        promise.resolve(JourneyNodeMapper.mapNode(resumedNode))
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.RESUME), error)
      }
    }
  }

  /**
   * Maps token and optional userinfo into a bridge-safe session payload.
   *
   * @param user Native user instance.
   * @param token OIDC token payload.
   * @return Bridge payload containing token/session fields.
   */
  private suspend fun mapSessionPayload(
    user: com.pingidentity.oidc.User,
    token: Token
  ): ReadableMap {
    val resultMap = Arguments.createMap()
    resultMap.putString("accessToken", token.accessToken)
    token.refreshToken?.let { resultMap.putString("refreshToken", it) }
    resultMap.putDouble("expiresIn", token.expiresIn.toDouble())

    when (val userInfoResult = user.userinfo(false)) {
      is Result.Success<*> -> {
        val userInfo = userInfoResult.value as? JsonObject
          ?: throw IllegalStateException("Invalid userinfo payload type")
        resultMap.putMap("userInfo", JsonBridgeMapper.encodeJsonObject(userInfo))
      }
      is Result.Failure<*> -> {
        // userinfo is optional for session resolution
      }
    }

    return resultMap
  }

  /**
   * Resolve active session data for a Journey user.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved with session payload or null.
   */
  fun getSession(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        if (user == null) {
          promise.resolve(null)
          return@launch
        }

        when (val tokenResult = user.token()) {
          is Result.Success<*> -> {
            val token = tokenResult.value as? Token
              ?: throw IllegalStateException("Invalid token payload type")
            promise.resolve(mapSessionPayload(user, token))
          }
          is Result.Failure<*> -> {
            promise.reject(
              GenericError(
                type = ErrorType.AUTH_ERROR,
                error = JourneyErrorCodes.USER,
                message = tokenResult.value.toString()
              )
            )
          }
        }
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.USER), error)
      }
    }
  }

  /**
   * Refresh active session token data for a Journey user.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved with refreshed session payload or null.
   */
  fun refresh(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        if (user == null) {
          promise.resolve(null)
          return@launch
        }

        when (val tokenResult = user.refresh()) {
          is Result.Success<*> -> {
            val token = tokenResult.value as? Token
              ?: throw IllegalStateException("Invalid token payload type")
            promise.resolve(mapSessionPayload(user, token))
          }
          is Result.Failure<*> -> {
            promise.reject(
              GenericError(
                type = ErrorType.AUTH_ERROR,
                error = JourneyErrorCodes.USER,
                message = tokenResult.value.toString()
              )
            )
          }
        }
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.USER), error)
      }
    }
  }

  /**
   * Revoke active Journey user token set.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved with `true` when revoke completes.
   */
  fun revoke(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        user?.revoke()
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.USER), error)
      }
    }
  }

  /**
   * Resolve active Journey userinfo payload.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved with userinfo payload or null.
   */
  fun userinfo(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        if (user == null) {
          promise.resolve(null)
          return@launch
        }

        when (val result = user.userinfo(false)) {
          is Result.Success<*> -> {
            val userInfo = result.value as? JsonObject
              ?: throw IllegalStateException("Invalid userinfo payload type")
            promise.resolve(JsonBridgeMapper.encodeJsonObject(userInfo))
          }
          is Result.Failure<*> -> {
            promise.reject(
              GenericError(
                type = ErrorType.AUTH_ERROR,
                error = JourneyErrorCodes.USER,
                message = result.value.toString()
              )
            )
          }
        }
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.USER), error)
      }
    }
  }

  /**
   * Resolve active Journey SSO token payload.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved with SSO token payload or null.
   */
  fun ssoToken(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        if (user == null) {
          promise.resolve(null)
          return@launch
        }

        val ssoToken = user.session()
        val resultMap = Arguments.createMap()
        resultMap.putString("value", ssoToken.value)
        resultMap.putString("successUrl", ssoToken.successUrl)
        resultMap.putString("realm", ssoToken.realm)
        promise.resolve(resultMap)
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.USER), error)
      }
    }
  }

  /**
   * Logout the active Journey user and clear in-memory node state.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved when logout completes.
   */
  fun logout(journeyId: String, promise: Promise) {
    val workflow = resolveWorkflow(journeyId)
    if (workflow == null) {
      promise.reject(
        JourneyErrorMapper.state(
          JourneyErrorCodes.STATE,
          "Journey instance not found for id=$journeyId"
        )
      )
      return
    }

    scope.launch {
      try {
        val user = workflow.user()
        user?.logout()
        clearNodeState(journeyId)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.LOGOUT), error)
      }
    }
  }

  /**
   * Dispose a Journey workflow and clear native state for that client.
   *
   * @param journeyId Native journey instance id.
   * @param promise Promise resolved when disposal completes.
   */
  fun dispose(journeyId: String, promise: Promise) {
    try {
      removeJourney(journeyId)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.DISPOSE), error)
    }
  }
}
