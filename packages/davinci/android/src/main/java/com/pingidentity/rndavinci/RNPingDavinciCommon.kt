/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.davinci.user
import com.pingidentity.logger.Logger
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.oidc.Token
import com.pingidentity.utils.Result
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.utils.JsonBridgeMapper
import com.pingidentity.rncore.utils.launchBridge
import com.pingidentity.rndavinci.collector.DaVinciCollectorValueApplier
import com.pingidentity.rndavinci.config.DaVinciConfigParser
import com.pingidentity.rndavinci.error.DaVinciErrorCodes
import com.pingidentity.rndavinci.error.DaVinciErrorMapper
import com.pingidentity.rndavinci.factory.DaVinciClientFactory
import com.pingidentity.rndavinci.mapper.DaVinciNodeMapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Shared Android runtime for Turbo and classic DaVinci bridge modules.
 *
 * Uses `Dispatchers.Default` because the DaVinci SDK uses Ktor CIO (non-blocking,
 * coroutine-based HTTP) and calls `withContext(Dispatchers.IO)` nowhere internally.
 */
internal object RNPingDavinciCommon {

    private fun createScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var configured = false
    private lateinit var clientFactory: DaVinciClientFactory

    private var scope: CoroutineScope = createScope()
    private val davinciRegistry = CoreRuntime.davinciRegistry
    private val nodeMap = ConcurrentHashMap<String, Node>()
    private val continueNodeMap = ConcurrentHashMap<String, ContinueNode>()

    /**
     * Handle storing a native DaVinci workflow instance.
     *
     * @property workflow Native DaVinci workflow.
     * @property loggerId Optional logger handle id from JS.
     */
    private data class DaVinciHandle(
        val workflow: Workflow,
        val loggerId: String?
    ) : NativeHandle

    /**
     * Initialise shared runtime wiring for DaVinci bridge calls.
     *
     * TODO-SDK-FUTURE-SUPPORT: Both `CollectorFactory.collector()` implementations
     * (Android and iOS) resolve a server field by looking up `inputType` first and
     * falling back to `type`. Real DaVinci payloads always carry `inputType`, so the
     * iOS-only registrations for FLOW_BUTTON / FLOW_LINK / DROPDOWN / RADIO /
     * COMBOBOX / CHECKBOX act as redundant aliases — those payloads still resolve
     * via their `inputType` (ACTION / SINGLE_SELECT / MULTI_SELECT) on Android.
     * The genuine gap is for field types where neither `inputType` nor `type`
     * matches a registered entry (e.g. SINGLE_CHECKBOX, AGREEMENT, future
     * server-introduced types). These are dropped by the native SDK and surfaced
     * to JS through `ContinueNode.unsupportedFields` (see
     * `DaVinciNodeMapper.unsupportedFieldsPayload`) so consumers can react. Re-
     * evaluate once the SDKs register any new server-introduced field types.
     */
    @Synchronized
    fun configure() {
        if (configured) return

        val oidcStorageRegistry = CoreRuntime.oidcStorageConfigRegistry
        val loggerRegistry = CoreRuntime.loggerRegistry
        clientFactory = DaVinciClientFactory(oidcStorageRegistry, loggerRegistry)

        CoreRuntime.davinciCollectorResolver = { davinciId ->
            continueNodeMap[davinciId]?.actions
                ?.filterIsInstance<com.pingidentity.davinci.plugin.Collector<*>>()
                ?.map { it as Any }
        }

        configured = true
    }

    /**
     * Release shared runtime state when the module is invalidated.
     */
    @Synchronized
    fun cleanup() {
        if (!configured) return

        CoreRuntime.davinciCollectorResolver = null
        scope.cancel()
        scope = createScope()
        disposeAll()
        configured = false
    }

    private fun setNodeState(davinciId: String, node: Node) {
        nodeMap[davinciId] = node
        val previousContinueNode = if (node is ContinueNode) {
            continueNodeMap.put(davinciId, node)
        } else {
            continueNodeMap.remove(davinciId)
        }
        previousContinueNode?.let { runCatching { it.close() } }
    }

    private fun clearNodeState(davinciId: String) {
        nodeMap.remove(davinciId)
        continueNodeMap.remove(davinciId)
    }

    private fun disposeAll() {
        continueNodeMap.values.forEach { node -> runCatching { node.close() } }
        continueNodeMap.clear()
        nodeMap.clear()
        davinciRegistry.removeAll()
    }

    private fun removeDaVinci(davinciId: String) {
        continueNodeMap.remove(davinciId)?.let { node -> runCatching { node.close() } }
        nodeMap.remove(davinciId)
        davinciRegistry.remove(davinciId)
    }

    private fun resolveWorkflow(davinciId: String): Workflow? =
        (davinciRegistry.resolve(davinciId) as? DaVinciHandle)?.workflow

    /**
     * Resolves the logger configured for a DaVinci instance.
     *
     * @param davinciId Native DaVinci instance id.
     * @return Native logger instance, or null when unset/unresolvable.
     */
    private fun resolveDaVinciLogger(davinciId: String): Logger? {
        val loggerId = (davinciRegistry.resolve(davinciId) as? DaVinciHandle)?.loggerId
        return resolveLoggerFromCore(loggerId)
    }

    /**
     * Resolve a native logger from the shared Core logger registry.
     *
     * @param id Logger handle identifier from JS.
     * @return Native logger instance, or null when missing/invalid.
     */
    private fun resolveLoggerFromCore(id: String?): Logger? {
        if (id.isNullOrBlank()) return null
        val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
        return handle.nativeLogger as? Logger
    }

    /**
     * Configure a native DaVinci workflow from JS configuration.
     *
     * @param config Bridge config payload.
     * @param promise Promise resolved with davinciId handle.
     */
    fun configureDaVinci(config: ReadableMap, promise: Promise) {
        val payload = try {
            DaVinciConfigParser.parse(config)
        } catch (error: Exception) {
            promise.reject(DaVinciErrorMapper.map(error, DaVinciErrorCodes.CONFIG), error)
            return
        }

        try {
            val workflow = clientFactory.build(payload)
            val davinciId = davinciRegistry.register(DaVinciHandle(workflow, payload.loggerId))
            promise.resolve(davinciId)
        } catch (error: Exception) {
            promise.reject(DaVinciErrorMapper.map(error, DaVinciErrorCodes.INIT), error)
        }
    }

    /**
     * Start the DaVinci flow.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved with the first node payload.
     */
    fun start(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.START) {
            val node = workflow.start()
            setNodeState(davinciId, node)
            promise.resolve(DaVinciNodeMapper.mapNode(node, resolveDaVinciLogger(davinciId)))
        }
    }

    /**
     * Advance the active DaVinci flow node by applying collector values and calling next().
     *
     * @param davinciId Native DaVinci instance id.
     * @param input Key-indexed collector values.
     * @param promise Promise resolved with the next node payload.
     */
    fun next(davinciId: String, input: ReadableMap, promise: Promise) {
        val currentNode = continueNodeMap[davinciId]
        if (currentNode == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "No active ContinueNode found for davinci id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.NEXT) {
            try {
                DaVinciCollectorValueApplier.apply(currentNode, input)
            } catch (error: UnsupportedOperationException) {
                promise.reject(
                    GenericError(
                        type = ErrorType.ARGUMENT_ERROR,
                        error = DaVinciErrorCodes.UNSUPPORTED_COLLECTOR,
                        message = error.message
                    ),
                    error
                )
                return@launchBridge
            } catch (error: IllegalArgumentException) {
                promise.reject(
                    GenericError(
                        type = ErrorType.ARGUMENT_ERROR,
                        error = DaVinciErrorCodes.COLLECTOR_APPLY,
                        message = error.message
                    ),
                    error
                )
                return@launchBridge
            }

            val nextNode = currentNode.next()
            setNodeState(davinciId, nextNode)
            promise.resolve(DaVinciNodeMapper.mapNode(nextNode, resolveDaVinciLogger(davinciId)))
        }
    }

    /**
     * Resolve active session data for a DaVinci user.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved with session payload or null.
     */
    fun getSession(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.SESSION) {
            val user = workflow.user()
            if (user == null) {
                promise.resolve(null)
                return@launchBridge
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
                            error = DaVinciErrorCodes.SESSION,
                            message = tokenResult.value.toString()
                        )
                    )
                }
            }
        }
    }

    /**
     * Refresh the active DaVinci user session tokens.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved with refreshed session payload or null.
     */
    fun refresh(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.SESSION) {
            val user = workflow.user()
            if (user == null) {
                promise.resolve(null)
                return@launchBridge
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
                            error = DaVinciErrorCodes.SESSION,
                            message = tokenResult.value.toString()
                        )
                    )
                }
            }
        }
    }

    /**
     * Revoke active DaVinci user tokens.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved with `true` when revoke completes.
     */
    fun revoke(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.SESSION) {
            val user = workflow.user()
            user?.revoke()
            promise.resolve(true)
        }
    }

    /**
     * Resolve userinfo claims for the active DaVinci session.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved with userinfo payload or null.
     */
    fun userinfo(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.SESSION) {
            val user = workflow.user()
            if (user == null) {
                promise.resolve(null)
                return@launchBridge
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
                            error = DaVinciErrorCodes.SESSION,
                            message = result.value.toString()
                        )
                    )
                }
            }
        }
    }

    /**
     * Log out the active DaVinci user using `workflow.signOff()` which clears cookies and
     * the OIDC session, then clears in-memory node state.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved when logout completes.
     */
    fun logout(davinciId: String, promise: Promise) {
        val workflow = resolveWorkflow(davinciId)
        if (workflow == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.STATE,
                    "DaVinci instance not found for id=$davinciId"
                )
            )
            return
        }

        scope.launchBridge(promise, DaVinciErrorCodes.LOGOUT) {
            val result = workflow.signOff()
            clearNodeState(davinciId)
            result.fold(
                onSuccess = { promise.resolve(null) },
                onFailure = { error ->
                    promise.reject(
                        mapThrowableToGenericError(error, DaVinciErrorCodes.LOGOUT),
                        error
                    )
                }
            )
        }
    }

    /**
     * Dispose a DaVinci workflow and clear native state for that client.
     *
     * @param davinciId Native DaVinci instance id.
     * @param promise Promise resolved when disposal completes.
     */
    fun dispose(davinciId: String, promise: Promise) {
        try {
            removeDaVinci(davinciId)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject(DaVinciErrorMapper.map(error, DaVinciErrorCodes.DISPOSE), error)
        }
    }

    // ---- Private helpers ----

    private suspend fun mapSessionPayload(
        user: com.pingidentity.oidc.User,
        token: Token
    ): com.facebook.react.bridge.ReadableMap {
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
}
