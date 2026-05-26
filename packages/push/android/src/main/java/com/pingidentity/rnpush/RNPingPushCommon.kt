/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessaging
import com.pingidentity.android.ContextProvider
import org.json.JSONObject
import com.pingidentity.mfa.push.NotificationCleanupConfig
import com.pingidentity.mfa.push.NotificationCleanupConfig.CleanupMode
import com.pingidentity.mfa.push.PushClient
import com.pingidentity.mfa.push.PushConfiguration
import com.pingidentity.mfa.push.storage.SQLPushStorage
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import com.pingidentity.storage.sqlite.passphrase.KeyStorePassphraseProvider
import com.pingidentity.logger.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.milliseconds

/**
 * Singleton that owns all push MFA business logic for the Android RN bridge.
 *
 * Maintains a handle-keyed registry of [PushClient] instances. `initialize` returns
 * an opaque UUID handle; every subsequent method takes that handle as its first argument.
 * This mirrors the device-client pattern used in other RN SDK packages.
 *
 * Both the new-arch [RNPingPushModule] and the old-arch [RNPingPushClassicModule]
 * delegate every bridge call to this object.
 *
 * Thread model: all operations run on [Dispatchers.IO] because push operations are
 * network and storage bound.
 */
object RNPingPushCommon {

    const val EVENT_FCM_TOKEN_RECEIVED = RNPingPushEvents.FCM_TOKEN_RECEIVED
    const val EVENT_PUSH_MESSAGE_RECEIVED = RNPingPushEvents.PUSH_MESSAGE_RECEIVED

    private var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val registry = ConcurrentHashMap<String, PushClient>()

    @Volatile private var reactContextRef: WeakReference<ReactApplicationContext>? = null

    // Non-PushMessage events (e.g. token) queued before configure() — flushed via DeviceEventEmitter on configure().
    private val pendingEvents = mutableListOf<Pair<String, Any?>>()

    // PushMessageReceived payloads stored natively — drained by JS via consumePendingMessages().
    // Never emitted via DeviceEventEmitter from the flush path to avoid the lazy-import race.
    private val pendingMessages = mutableListOf<Map<String, String>>()

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Wires the singleton to the active React Native context.
     *
     * Must be called once before any bridge method is invoked, typically from the
     * module constructor. Stores a [WeakReference] to [reactContext], replays any
     * events that were queued before the bridge was ready, and eagerly fetches the
     * current FCM registration token so JS receives it as soon as the module loads.
     *
     * @param reactContext The React Native application context provided by the module.
     */
    @JvmStatic
    fun configure(reactContext: ReactApplicationContext) {
        ContextProvider.init(reactContext.applicationContext)
        reactContextRef = WeakReference(reactContext)
        flushPendingEvents(reactContext)
        fetchAndEmitFcmToken(reactContext)
    }

    /**
     * Drains [pendingEvents] that were queued before [configure] was called and emits them
     * via [DeviceEventManagerModule.RCTDeviceEventEmitter] on the main thread.
     *
     * Events are queued when [emitEvent] is called before the React context is available
     * (e.g. an FCM token arrives during app cold-start before the JS bridge is ready).
     * This method is called once from [configure] to replay those events in order.
     *
     * Note: [pendingMessages] (push payloads) are intentionally excluded here — they are
     * drained by JS via [consumePendingMessages] inside [createPushClient] to avoid the
     * lazy-module-import race where [push.ts] may not yet be evaluated.
     *
     * @param ctx The active [ReactApplicationContext] used to obtain the JS event emitter.
     */
    private fun flushPendingEvents(ctx: ReactApplicationContext) {
        synchronized(pendingEvents) {
            if (pendingEvents.isEmpty()) return
            val copy = pendingEvents.toList()
            pendingEvents.clear()
            val emitter = ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            scope.launch(Dispatchers.Main) {
                copy.forEach { (name, payload) -> emitter?.emit(name, payload) }
            }
        }
    }

    /**
     * Emits a DeviceEventEmitter event to JS. Safe to call from any thread.
     * No-op when the React context is unavailable or not yet active.
     *
     * @param eventName The JS event name — use [EVENT_FCM_TOKEN_RECEIVED] or [EVENT_PUSH_MESSAGE_RECEIVED].
     * @param payload   The event payload — a String, WritableMap, or null.
     */
    @JvmStatic
    fun emitEvent(eventName: String, payload: Any?) {
        val emitter = reactContextRef?.get()
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)

        if (emitter == null) {
            if (eventName == EVENT_PUSH_MESSAGE_RECEIVED) {
                // Store natively — JS drains via consumePendingMessages() inside createPushClient().
                // This avoids the lazy-import race where push.ts isn't evaluated yet.
                val data = (payload as? ReadableMap)?.toHashMap()
                    ?.mapValues { it.value?.toString() ?: "" } ?: emptyMap()
                synchronized(pendingMessages) { pendingMessages.add(data) }
            } else {
                synchronized(pendingEvents) { pendingEvents.add(eventName to payload) }
            }
            return
        }
        emitter.emit(eventName, payload)
    }

    /**
     * Drains and returns all [pendingMessages] that arrived before [createPushClient] was called.
     *
     * Push payloads received during cold-start are stored natively rather than emitted via
     * [DeviceEventManagerModule.RCTDeviceEventEmitter] to avoid a race where [push.ts] has
     * not yet been evaluated and the JS listener is not yet registered. JS calls this once
     * inside [createPushClient] to process any messages that arrived before the client was ready.
     *
     * The list is cleared atomically after being read — subsequent calls return an empty array.
     *
     * @param promise Resolved with a [com.facebook.react.bridge.ReadableArray] of pending
     *   message maps, each containing the FCM [remoteMessage.data] key-value pairs as strings.
     */
    @JvmStatic
    fun consumePendingMessages(promise: Promise) {
        // Cold-start path: payload was embedded in the tray-notification Intent by the app's
        // FirebaseMessagingService. Android delivers it OS-side when the user taps — nothing
        // is written to disk. Read once and clear the flag so it isn't replayed.
        val intentMessages = mutableListOf<Map<String, String>>()
        reactContextRef?.get()?.currentActivity?.intent?.let { intent ->
            if (intent.getBooleanExtra(RNPingPushBridge.EXTRA_PUSH_COLD_START, false)) {
                intent.getStringExtra(RNPingPushBridge.EXTRA_PUSH_PAYLOAD)?.let { json ->
                    runCatching {
                        val obj = JSONObject(json)
                        obj.keys().asSequence().associateWith { obj.getString(it) }
                    }.getOrNull()?.let { intentMessages.add(it) }
                }
                // Clear so consumePendingMessages is idempotent on repeated calls.
                intent.removeExtra(RNPingPushBridge.EXTRA_PUSH_COLD_START)
                intent.removeExtra(RNPingPushBridge.EXTRA_PUSH_PAYLOAD)
            }
        }

        val inMemory = synchronized(pendingMessages) {
            val copy = pendingMessages.toList()
            pendingMessages.clear()
            copy
        }

        val array = Arguments.createArray()
        (intentMessages + inMemory).forEach { map ->
            val rMap = Arguments.createMap()
            map.forEach { (k, v) -> rMap.putString(k, v) }
            array.pushMap(rMap)
        }
        promise.resolve(array)
    }

    /**
     * Eagerly fetches the current FCM registration token and emits it as an
     * [EVENT_FCM_TOKEN_RECEIVED] event so JS can register it with the push service
     * without waiting for the next [onNewToken] callback.
     *
     * Non-cancellation failures are silently swallowed — [RNPingPushBridge.forwardToken]
     * (called from the app's FCM service) is the authoritative delivery path; this is a
     * best-effort optimisation for first launch.
     * [kotlinx.coroutines.CancellationException] is rethrown so scope cancellation propagates correctly.
     *
     * @param ctx The active [ReactApplicationContext] — passed through to [emitEvent].
     */
    private fun fetchAndEmitFcmToken(ctx: ReactApplicationContext) {
        scope.launch(Dispatchers.IO) {
            try {
                val token = FirebaseMessaging.getInstance().token.await()
                scope.launch(Dispatchers.Main) { emitEvent(EVENT_FCM_TOKEN_RECEIVED, token) }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                // Firebase may not be present (BYO push library path) or the token
                // may not be available yet — the app will supply the token via setDeviceToken.
            }

        }
    }

    /**
     * Cancels the coroutine scope and clears all registered [PushClient] instances.
     *
     * Called when the React Native module is invalidated. A fresh scope is created
     * so the singleton can be re-used if the module is later re-initialised.
     */
    @JvmStatic
    fun cleanup() {
        scope.cancel()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        registry.clear()
        reactContextRef = null
        synchronized(pendingEvents) { pendingEvents.clear() }
        synchronized(pendingMessages) { pendingMessages.clear() }
    }

    // ─── Bridge methods ──────────────────────────────────────────────────────

    /**
     * Creates a [PushClient] from [config], stores it in the registry, and resolves the
     * promise with an opaque UUID client handle.
     *
     * @param config Bridge map containing push configuration keys (storageId, loggerId,
     *   enableCredentialCache, timeoutMs, cleanupMode, etc.).
     * @param promise Resolved with the opaque client handle string, or rejected on failure.
     */
    @JvmStatic
    fun initialize(config: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val loggerId = if (config.hasKey("loggerId") && !config.isNull("loggerId")) {
                    config.getString("loggerId")?.trim()?.takeIf { it.isNotEmpty() }
                } else null
                val logger = resolveLogger(loggerId)
                val client = buildPushClient(config, logger)
                val clientId = UUID.randomUUID().toString()
                registry[clientId] = client
                promise.resolve(clientId)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Enrolls a new push credential by parsing the given `pushauth://` URI.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param uri The `pushauth://` URI received from the server during enrollment.
     * @param promise Resolved with the serialized [PushCredential] map, or rejected on failure.
     */
    @JvmStatic
    fun addCredentialFromUri(clientId: String, uri: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val credential = client.addCredentialFromUri(uri).getOrThrow()
                promise.resolve(serializeCredential(credential))
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Saves an updated push credential back to native storage.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param credentialMap Bridge map representing the credential to persist.
     * @param promise Resolved with the serialized updated [PushCredential] map, or rejected on failure.
     */
    @JvmStatic
    fun saveCredential(clientId: String, credentialMap: ReadableMap, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val credential = deserializeCredential(credentialMap)
                val saved = client.saveCredential(credential).getOrThrow()
                promise.resolve(serializeCredential(saved))
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns all stored push credentials as a map containing a `credentials` array.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with `{ credentials: [...] }`, or rejected on failure.
     */
    @JvmStatic
    fun getCredentials(clientId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val credentials = client.getCredentials().getOrThrow()
                val array = Arguments.createArray()
                credentials.forEach { array.pushMap(serializeCredential(it)) }
                val result = Arguments.createMap()
                result.putArray("credentials", array)
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns a single push credential by its identifier.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param credentialId The identifier of the credential to retrieve.
     * @param promise Resolved with `{ credential: PushCredential | null }`, or rejected on failure.
     */
    @JvmStatic
    fun getCredential(clientId: String, credentialId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val credential = client.getCredential(credentialId).getOrThrow()
                val result = Arguments.createMap()
                if (credential != null) {
                    result.putMap("credential", serializeCredential(credential))
                } else {
                    result.putNull("credential")
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Deletes a push credential from native storage by its identifier.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param credentialId The identifier of the credential to delete.
     * @param promise Resolved with a boolean indicating whether the credential was deleted,
     *   or rejected on failure.
     */
    @JvmStatic
    fun deleteCredential(clientId: String, credentialId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.deleteCredential(credentialId).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Updates the FCM device token, optionally scoped to a specific credential.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param token The new FCM registration token.
     * @param credentialId When non-null, limits the token update to this credential only.
     * @param promise Resolved with the operation result, or rejected on failure.
     */
    @JvmStatic
    fun setDeviceToken(clientId: String, token: String, credentialId: String?, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.setDeviceToken(token, credentialId).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns the stored FCM device token.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with `{ token: string | null }`, or rejected on failure.
     */
    @JvmStatic
    fun getDeviceToken(clientId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val token = client.getDeviceToken().getOrThrow()
                val result = Arguments.createMap()
                if (token != null) {
                    result.putString("token", token)
                } else {
                    result.putNull("token")
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Parses a push notification from an FCM data payload delivered as a key-value map.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param messageData The FCM `data` payload map from the received remote message.
     * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
     */
    @JvmStatic
    fun processNotification(clientId: String, messageData: ReadableMap, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val dataMap: Map<String, String> = messageData.toHashMap()
                    .mapValues { it.value?.toString() ?: "" }
                val notification = client.processNotification(dataMap).getOrThrow()
                val result = Arguments.createMap()
                if (notification != null) {
                    result.putMap("notification", serializeNotification(notification))
                } else {
                    result.putNull("notification")
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Parses a push notification from a raw message string or JWT payload.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param message The raw string or JWT received as the push message body.
     * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
     */
    @JvmStatic
    fun processNotificationFromMessage(clientId: String, message: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val notification = client.processNotification(message).getOrThrow()
                val result = Arguments.createMap()
                if (notification != null) {
                    result.putMap("notification", serializeNotification(notification))
                } else {
                    result.putNull("notification")
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Approves a pending push notification.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param notificationId The identifier of the notification to approve.
     * @param promise Resolved with the operation result, or rejected on failure.
     */
    @JvmStatic
    fun approveNotification(clientId: String, notificationId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.approveNotification(notificationId).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Approves a challenge-type push notification with the user-supplied response.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param notificationId The identifier of the challenge notification to approve.
     * @param challengeResponse The user's response to the challenge presented in the notification.
     * @param promise Resolved with the operation result, or rejected on failure.
     */
    @JvmStatic
    fun approveChallengeNotification(clientId: String, notificationId: String, challengeResponse: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.approveChallengeNotification(notificationId, challengeResponse).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Approves a biometric push notification using the given authentication method.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param notificationId The identifier of the biometric notification to approve.
     * @param authenticationMethod The biometric method used (e.g. `"BIOMETRIC"`, `"DEVICE_CREDENTIALS"`).
     * @param promise Resolved with the operation result, or rejected on failure.
     */
    @JvmStatic
    fun approveBiometricNotification(clientId: String, notificationId: String, authenticationMethod: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.approveBiometricNotification(notificationId, authenticationMethod).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Denies a pending push notification.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param notificationId The identifier of the notification to deny.
     * @param promise Resolved with the operation result, or rejected on failure.
     */
    @JvmStatic
    fun denyNotification(clientId: String, notificationId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val result = client.denyNotification(notificationId).getOrThrow()
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns all notifications that are currently awaiting a user response.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with `{ notifications: [...] }`, or rejected on failure.
     */
    @JvmStatic
    fun getPendingNotifications(clientId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val notifications = client.getPendingNotifications().getOrThrow()
                promise.resolve(buildNotificationsResult(notifications))
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns all stored push notifications regardless of their response state.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with `{ notifications: [...] }`, or rejected on failure.
     */
    @JvmStatic
    fun getAllNotifications(clientId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val notifications = client.getAllNotifications().getOrThrow()
                promise.resolve(buildNotificationsResult(notifications))
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Returns a single push notification by its identifier.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param notificationId The identifier of the notification to retrieve.
     * @param promise Resolved with `{ notification: PushNotification | null }`, or rejected on failure.
     */
    @JvmStatic
    fun getNotification(clientId: String, notificationId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val notification = client.getNotification(notificationId).getOrThrow()
                val result = Arguments.createMap()
                if (notification != null) {
                    result.putMap("notification", serializeNotification(notification))
                } else {
                    result.putNull("notification")
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Runs the configured notification cleanup strategy and removes expired or excess notifications.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param credentialId When non-null, limits cleanup to notifications belonging to this credential.
     * @param promise Resolved with the number of notifications removed, or rejected on failure.
     */
    @JvmStatic
    fun cleanupNotifications(clientId: String, credentialId: String?, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val count = client.cleanupNotifications(credentialId).getOrThrow()
                promise.resolve(count)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Fetches the current FCM registration token, registers it with the [PushClient] for
     * [clientId] via [PushClient.setDeviceToken], and resolves with `{ token: string }`.
     *
     * Emits an [EVENT_FCM_TOKEN_RECEIVED] event after successfully registering the token
     * so JS token listeners are notified in the same way as an organic `onNewToken` callback.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with `{ token: string }` on success, or rejected on failure.
     */
    @JvmStatic
    fun refreshToken(clientId: String, promise: Promise) {
        val client = registry[clientId] ?: run {
            promise.reject(GenericError(type = ErrorType.STATE_ERROR, error = PushErrorCode.NOT_INITIALIZED, message = "Push client not found for id: $clientId"))
            return
        }
        scope.launch {
            try {
                val token = FirebaseMessaging.getInstance().token.await()
                client.setDeviceToken(token, null).getOrThrow()
                scope.launch(Dispatchers.Main) { emitEvent(EVENT_FCM_TOKEN_RECEIVED, token) }
                val result = Arguments.createMap()
                result.putString("token", token)
                promise.resolve(result)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    /**
     * Removes the [PushClient] identified by [clientId] from the registry and releases its resources.
     *
     * If [clientId] is not found in the registry the promise resolves immediately with null.
     *
     * @param clientId Opaque handle returned by [initialize].
     * @param promise Resolved with null when the client is closed, or rejected on failure.
     */
    @JvmStatic
    fun close(clientId: String, promise: Promise) {
        val client = registry.remove(clientId) ?: run {
            promise.resolve(null)
            return
        }
        scope.launch {
            try {
                client.close()
                promise.resolve(null)
            } catch (e: Throwable) {
                reject(e, promise)
            }
        }
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Resolves an optional [Logger] from the CoreRuntime logger registry.
     *
     * @param loggerId The opaque logger handle identifier, or null/blank to skip lookup.
     * @return The resolved [Logger], or null if [loggerId] is absent or
     *   the handle cannot be resolved to a compatible logger type.
     */
    private fun resolveLogger(loggerId: String?): Logger? {
        if (loggerId.isNullOrBlank()) return null
        return runCatching {
            val handle = CoreRuntime.loggerRegistry.resolve(loggerId)
            (handle as? com.pingidentity.rncore.logger.LoggerHandleContract)?.nativeLogger as? Logger
        }.getOrNull()
    }

    /**
     * Creates a [PushClient] from the bridge [config] map and optional [logger].
     *
     * Reads optional keys `storageId`, `enableCredentialCache`, `timeoutMs`, `cleanupMode`,
     * `maxStoredNotifications`, and `maxNotificationAgeDays` from [config].
     */
    private suspend fun buildPushClient(config: ReadableMap, logger: Logger?): PushClient {
        return PushClient {
            val storageId = if (config.hasKey("storageId") && !config.isNull("storageId")) {
                config.getString("storageId")?.trim()?.takeIf { it.isNotEmpty() }
            } else null

            if (storageId != null) {
                val handle = CoreRuntime.pushStorageConfigRegistry.resolve(storageId)
                val storageHandle = handle as? StorageConfigHandleContract
                if (storageHandle != null) {
                    storage = SQLPushStorage {
                        context = ContextProvider.context
                        storageHandle.fileName?.let { databaseName = it }
                        passphraseProvider = KeyStorePassphraseProvider(
                            ContextProvider.context,
                            storageHandle.keyAlias ?: "com.pingidentity.rnpush.storage",
                            logger ?: Logger.logger
                        )
                    }
                }
            }

            if (config.hasKey("enableCredentialCache") && !config.isNull("enableCredentialCache")) {
                enableCredentialCache = config.getBoolean("enableCredentialCache")
            }

            if (config.hasKey("timeoutMs") && !config.isNull("timeoutMs")) {
                timeout = config.getDouble("timeoutMs").toLong().milliseconds
            }

            val cleanupModeStr = if (config.hasKey("cleanupMode") && !config.isNull("cleanupMode")) {
                config.getString("cleanupMode")
            } else null

            if (cleanupModeStr != null) {
                val mode = runCatching { CleanupMode.valueOf(cleanupModeStr) }.getOrNull()
                if (mode != null && mode != CleanupMode.NONE) {
                    val cleanupCfg = NotificationCleanupConfig()
                    cleanupCfg.cleanupMode = mode
                    if (config.hasKey("maxStoredNotifications") && !config.isNull("maxStoredNotifications")) {
                        cleanupCfg.maxStoredNotifications = config.getDouble("maxStoredNotifications").toInt()
                    }
                    if (config.hasKey("maxNotificationAgeDays") && !config.isNull("maxNotificationAgeDays")) {
                        cleanupCfg.maxNotificationAgeDays = config.getDouble("maxNotificationAgeDays").toInt()
                    }
                    notificationCleanupConfig = cleanupCfg
                }
            }

            if (logger != null) {
                this.logger = logger
            }
        }
    }

    /**
     * Wraps a list of serialized [com.pingidentity.mfa.push.PushNotification] objects into a
     * bridge result map of the form `{ notifications: [...] }`.
     *
     * @param notifications The list of native push notifications to serialize and wrap.
     * @return A [com.facebook.react.bridge.ReadableMap] with a `"notifications"` array key.
     */
    private fun buildNotificationsResult(
        notifications: List<com.pingidentity.mfa.push.PushNotification>,
    ): com.facebook.react.bridge.ReadableMap {
        val array = Arguments.createArray()
        notifications.forEach { array.pushMap(serializeNotification(it)) }
        val result = Arguments.createMap()
        result.putArray("notifications", array)
        return result
    }
}
