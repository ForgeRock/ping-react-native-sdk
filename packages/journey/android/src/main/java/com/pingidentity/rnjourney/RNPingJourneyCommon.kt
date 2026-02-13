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
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.journey.plugin.callbacks
import com.pingidentity.journey.resume
import com.pingidentity.journey.start
import com.pingidentity.journey.user
import com.pingidentity.oidc.Token
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.utils.Result
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.error.GenericError
import com.reactnativepingidentity.core.error.reject
import com.reactnativepingidentity.core.utils.JsonBridgeMapper
import com.reactnativepingidentity.logger.RNPingLoggerCommon
import com.reactnativepingidentity.storage.StorageConfigRegistry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Shared Android runtime orchestration for Turbo and classic Journey bridge modules.
 */
internal object RNPingJourneyCommon {

  private fun createScope(): CoroutineScope {
    return CoroutineScope(SupervisorJob() + Dispatchers.IO)
  }

  private var configured = false
  private lateinit var clientFactory: JourneyClientFactory

  private var scope: CoroutineScope = createScope()
  private val journeyMap = ConcurrentHashMap<String, Workflow>()
  private val nodeMap = ConcurrentHashMap<String, Node>()
  private val continueNodeMap = ConcurrentHashMap<String, ContinueNode>()

  /**
   * Initialize common runtime wiring for Journey bridge calls.
   *
   * @param reactContext React context used to bootstrap shared registries.
   */
  @Suppress("UNUSED_PARAMETER")
  @Synchronized
  fun configure(reactContext: ReactApplicationContext) {
    if (configured) {
      return
    }
    val storageRegistry = StorageConfigRegistry(CoreRuntime.sessionStorageConfigRegistry)
    clientFactory = JourneyClientFactory(storageRegistry) { loggerId ->
      RNPingLoggerCommon.applyLogger(loggerId)
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
    scope.cancel()
    scope = createScope()
    disposeAll()
    configured = false
  }

  private fun setNodeState(journeyId: String, node: Node) {
    nodeMap[journeyId] = node
    if (node is ContinueNode) {
      continueNodeMap[journeyId] = node
    } else {
      continueNodeMap.remove(journeyId)
    }
  }

  private fun clearNodeState(journeyId: String) {
    nodeMap.remove(journeyId)
    continueNodeMap.remove(journeyId)
  }

  private fun disposeAll() {
    continueNodeMap.values.forEach { node ->
      runCatching { node.close() }
    }
    continueNodeMap.clear()
    nodeMap.clear()
    journeyMap.clear()
  }

  private fun removeJourney(journeyId: String) {
    continueNodeMap.remove(journeyId)?.let { node ->
      runCatching { node.close() }
    }
    nodeMap.remove(journeyId)
    journeyMap.remove(journeyId)
  }

  /**
   * Configure a native Journey workflow from JS configuration.
   *
   * @param config Bridge config payload.
   * @param promise Promise resolved with journey id.
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
      val journeyId = UUID.randomUUID().toString()
      journeyMap[journeyId] = workflow
      promise.resolve(journeyId)
    } catch (error: Exception) {
      promise.reject(JourneyErrorMapper.map(error, JourneyErrorCodes.INIT), error)
    }
  }

  /**
   * Start a configured Journey by name.
   */
  fun start(journeyId: String, journeyName: String, options: ReadableMap?, promise: Promise) {
    val workflow = journeyMap[journeyId]
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
   */
  fun resume(journeyId: String, uri: String, promise: Promise) {
    val workflow = journeyMap[journeyId]
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
   * Resolve active session data for a Journey user.
   */
  fun getSession(journeyId: String, promise: Promise) {
    val workflow = journeyMap[journeyId]
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

            promise.resolve(resultMap)
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
   * Logout the active Journey user and clear in-memory node state.
   */
  fun logout(journeyId: String, promise: Promise) {
    val workflow = journeyMap[journeyId]
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
