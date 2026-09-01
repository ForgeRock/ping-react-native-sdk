/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.pingidentity.davinci.collector.PollingCollector
import com.pingidentity.davinci.collector.PollingStatus
import com.pingidentity.davinci.user
import com.pingidentity.logger.Logger
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.oidc.Token
import com.pingidentity.oidc.module.VERIFICATION_URI_COMPLETE
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.lang.ref.WeakReference
import java.util.UUID
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

    private var reactContextRef: WeakReference<ReactApplicationContext>? = null

    /**
     * In-flight poll [Job]s grouped by `davinciId`, so [dispose]/[cleanup] can cancel every
     * outstanding poll for a given DaVinci instance as a teardown safety net. Native polling
     * has no cancellation primitive, so this is the only way an in-flight poll is ever stopped
     * early — it is not exposed to JS.
     */
    private val pollJobsByDaVinciId = ConcurrentHashMap<String, MutableSet<Job>>()

    /**
     * Handle storing a native DaVinci workflow instance.
     *
     * @property workflow Native DaVinci workflow.
     * @property loggerId Optional logger handle id from JS (DaVinci-level).
     * @property protectLoggerId Optional logger handle id scoped to Protect operations.
     */
    private data class DaVinciHandle(
        val workflow: Workflow,
        val loggerId: String?,
        val protectLoggerId: String? = null,
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
     *
     * `reactContext` is captured (weakly, mirroring `RNPingBindingCommon`/
     * `RNPingPushCommon`) so [pollDaVinci] can resolve the JS
     * `RCTDeviceEventEmitter` to stream `PollingStatus` ticks. It is optional
     * and re-applied on every call (even when [configured] is already `true`)
     * because both `RNPingDavinciModule` and `RNPingDavinciClassicModule` call
     * `configure()` from their constructors — the reference must stay current
     * across module re-creation, not just the first init. Existing call sites
     * that don't need event emission (e.g. tests) can omit it.
     */
    @Synchronized
    fun configure(reactContext: ReactApplicationContext? = null) {
        reactContext?.let { reactContextRef = WeakReference(it) }
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
        pollJobsByDaVinciId.values.forEach { jobs -> jobs.forEach { it.cancel() } }
        pollJobsByDaVinciId.clear()
        scope.cancel()
        scope = createScope()
        disposeAll()
        reactContextRef = null
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
        cancelPollsFor(davinciId)
    }

    /**
     * Cancels every in-flight poll [Job] tracked for [davinciId] — a dispose()/cleanup()
     * safety net so a disposed instance never leaves an orphaned coroutine running after
     * the caller stops listening for its events.
     */
    private fun cancelPollsFor(davinciId: String) {
        val jobs = pollJobsByDaVinciId.remove(davinciId) ?: return
        jobs.forEach { it.cancel() }
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
            val davinciId = davinciRegistry.register(
                DaVinciHandle(workflow, payload.loggerId, payload.protect?.loggerId)
            )
            promise.resolve(davinciId)
        } catch (error: Exception) {
            promise.reject(DaVinciErrorMapper.map(error, DaVinciErrorCodes.INIT), error)
        }
    }

    /**
     * Start the DaVinci flow.
     *
     * @param davinciId Native DaVinci instance id.
     * @param options Optional start options; supports `verificationUri` (RFC 8628
     *   `verification_uri_complete`) when this device approves a device flow.
     * @param promise Promise resolved with the first node payload.
     */
    fun start(davinciId: String, options: ReadableMap?, promise: Promise) {
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

        val verificationUri = options?.takeIf { it.hasKey("verificationUri") && !it.isNull("verificationUri") }
            ?.getString("verificationUri")
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        scope.launchBridge(promise, DaVinciErrorCodes.START) {
            val node = if (verificationUri != null) {
                workflow.start {
                    VERIFICATION_URI_COMPLETE to Uri.parse(verificationUri)
                }
            } else {
                workflow.start()
            }
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

    /**
     * Start streaming polling status updates for the active [PollingCollector].
     *
     * The poll [Job] is created with [CoroutineStart.LAZY] and registered into
     * [pollJobsByDaVinciId] before the promise resolves. The promise is then resolved with a
     * native-generated `subscriptionId`, and only after that does the job actually
     * [Job.start], beginning to collect [PollingCollector.pollStatus] and emit
     * [RNPingDavinciEvents.POLLING_STATUS] events tagged with that `subscriptionId`. Because
     * the RN bridge delivers native→JS messages in FIFO order per channel, this ordering
     * guarantees JS always has the id to filter on before the first event can arrive.
     *
     * Native polling has no cancellation primitive — once started, this [Job] runs to
     * completion (bounded by the collector's `pollRetries`/`pollInterval`) unless [dispose]
     * or [cleanup] cancels it as a teardown safety net.
     *
     * @param davinciId Native DaVinci instance id.
     * @param options Bridge map with an optional `key` selecting which `PollingCollector`
     *   to poll when more than one is present on the active node; the first one is used
     *   when `key` is absent.
     * @param promise Promise resolved with `{ subscriptionId }`.
     */
    fun pollDaVinci(davinciId: String, options: ReadableMap, promise: Promise) {
        val node = continueNodeMap[davinciId]
        if (node == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.POLL,
                    "No active ContinueNode found for davinci id=$davinciId"
                )
            )
            return
        }

        val requestedKey = if (options.hasKey("key") && !options.isNull("key")) {
            options.getString("key")
        } else {
            null
        }
        val collectors = node.actions.filterIsInstance<PollingCollector>()
        val collector = (if (requestedKey != null) {
            collectors.firstOrNull { it.id() == requestedKey }
        } else {
            collectors.firstOrNull()
        })
        if (collector == null) {
            promise.reject(
                DaVinciErrorMapper.state(
                    DaVinciErrorCodes.POLL,
                    "No active PollingCollector found for davinci id=$davinciId" +
                        (requestedKey?.let { " with key=$it" } ?: "")
                )
            )
            return
        }

        val subscriptionId = UUID.randomUUID().toString()
        lateinit var job: Job
        job = scope.launch(start = CoroutineStart.LAZY) {
            try {
                collector.pollStatus().collect { status ->
                    emitPollingStatus(davinciId, subscriptionId, status)
                }
            } catch (e: CancellationException) {
                throw e
            } finally {
                pollJobsByDaVinciId[davinciId]?.remove(job)
            }
        }
        pollJobsByDaVinciId.computeIfAbsent(davinciId) { ConcurrentHashMap.newKeySet() }.add(job)

        val result = Arguments.createMap()
        result.putString("subscriptionId", subscriptionId)
        promise.resolve(result)

        job.start()
    }

    /**
     * Emits one [PollingStatus] tick to JS via [DeviceEventManagerModule.RCTDeviceEventEmitter].
     * No-op when the React context is unavailable (e.g. the module was invalidated mid-poll).
     *
     * Hops to [Dispatchers.Main] via [withContext] before emitting, staying on the calling
     * poll [Job] so cancellation (unsubscribe/dispose) also cancels any in-flight emit instead
     * of leaking a detached [Dispatchers.Main] coroutine.
     */
    private suspend fun emitPollingStatus(davinciId: String, subscriptionId: String, status: PollingStatus) {
        val emitter = reactContextRef?.get()
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?: return

        val params = Arguments.createMap()
        params.putString("subscriptionId", subscriptionId)
        params.putString("daVinciId", davinciId)
        when (status) {
            is PollingStatus.Continue -> {
                params.putString("status", "continue")
                params.putInt("retryCount", status.retryCount)
                params.putInt("maxRetries", status.maxRetries)
            }
            is PollingStatus.Complete -> {
                params.putString("status", "complete")
                params.putString("value", status.status)
            }
            is PollingStatus.TimedOut -> params.putString("status", "timedOut")
            is PollingStatus.Expired -> params.putString("status", "expired")
            is PollingStatus.Error -> {
                params.putString("status", "error")
                val errorMap = Arguments.createMap()
                errorMap.putString("message", status.exception.message ?: status.exception.toString())
                params.putMap("error", errorMap)
            }
        }
        withContext(Dispatchers.Main) { emitter.emit(RNPingDavinciEvents.POLLING_STATUS, params) }
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
