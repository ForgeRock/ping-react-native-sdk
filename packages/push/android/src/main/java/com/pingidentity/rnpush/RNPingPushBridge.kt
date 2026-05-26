/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import android.util.Base64
import com.facebook.react.bridge.Arguments
import org.json.JSONObject

/**
 * Public API for wiring an existing FCM service or JS push library into the Ping Push SDK.
 *
 * **Scenario A** (JS push library): call [forwardToken] and [forwardNotification] from your
 * library's native token/message callbacks.
 *
 * **Scenario B** (existing native [com.google.firebase.messaging.FirebaseMessagingService]):
 * call [forwardToken] from `onNewToken` and [forwardNotification] from `onMessageReceived`.
 * Use [extractNotificationText] to decode the server's message body from the JWT payload
 * when posting your own tray notification while the app is backgrounded.
 */
object RNPingPushBridge {

    /**
     * Intent extra key that flags a cold-start tap originating from the tray notification.
     * Set by the app's [com.google.firebase.messaging.FirebaseMessagingService] when it posts
     * the system notification; read by [RNPingPushCommon.consumePendingMessages] to drain the
     * payload on first launch.
     */
    const val EXTRA_PUSH_COLD_START = "com.pingidentity.rnpush.cold_start"

    /**
     * Intent extra key that carries the encoded FCM data payload attached to the tray
     * notification Intent. Paired with [EXTRA_PUSH_COLD_START].
     */
    const val EXTRA_PUSH_PAYLOAD = "com.pingidentity.rnpush.payload"

    /**
     * Forwards a new FCM token to the Ping Push SDK bridge.
     *
     * Call from your [com.google.firebase.messaging.FirebaseMessagingService.onNewToken]:
     * ```kotlin
     * override fun onNewToken(token: String) {
     *     existingSdk.updateToken(token)
     *     RNPingPushBridge.forwardToken(token) // ← add
     * }
     * ```
     */
    @JvmStatic
    fun forwardToken(token: String) {
        RNPingPushCommon.emitEvent(RNPingPushEvents.FCM_TOKEN_RECEIVED, token)
    }

    /**
     * Forwards an incoming FCM message to the Ping Push SDK bridge.
     *
     * Call from your [com.google.firebase.messaging.FirebaseMessagingService.onMessageReceived]:
     * ```kotlin
     * override fun onMessageReceived(remoteMessage: RemoteMessage) {
     *     existingSdk.handleMessage(remoteMessage)
     *     RNPingPushBridge.forwardNotification(remoteMessage.data) // ← add
     * }
     * ```
     */
    @JvmStatic
    fun forwardNotification(data: Map<String, String>) {
        val params = Arguments.createMap()
        data.forEach { (k, v) -> params.putString(k, v) }
        RNPingPushCommon.emitEvent(RNPingPushEvents.PUSH_MESSAGE_RECEIVED, params)
    }

    /**
     * Decodes the server-supplied message text from the Ping JWT payload for use in a tray
     * notification body. No crypto or signature verification — display text only.
     *
     * Requires both `"message"` (the JWT) and `"messageId"` to be present, matching
     * `PingAMPushHandler.canHandle` in the native SDK. Falls back to [defaultTitle]/[defaultBody]
     * for any non-Ping or unparseable payload.
     *
     * ```kotlin
     * val (title, body) = RNPingPushBridge.extractNotificationText(
     *     remoteMessage.data,
     *     getString(R.string.my_notification_title),
     *     getString(R.string.my_notification_body),
     * )
     * ```
     */
    // Base64-decodes the JWT payload segment to extract display text only — not encryption.
    @Suppress("WeakCrypto")
    @JvmStatic
    fun extractNotificationText(
        data: Map<String, String>,
        defaultTitle: String,
        defaultBody: String,
    ): Pair<String, String> {
        if (!data.containsKey("message") || !data.containsKey("messageId")) {
            return defaultTitle to defaultBody
        }
        val body = runCatching {
            val jwt = data["message"] ?: return@runCatching defaultBody
            val payloadSegment = jwt.split(".").getOrNull(1) ?: return@runCatching defaultBody
            val json = String(Base64.decode(payloadSegment, Base64.URL_SAFE or Base64.NO_PADDING))
            // JWT claim "m" maps to messageText in the Ping Android SDK (PushConstants.KEY_MESSAGE_TEXT)
            JSONObject(json).optString("m").takeIf { it.isNotEmpty() } ?: defaultBody
        }.getOrDefault(defaultBody)
        return defaultTitle to body
    }
}
