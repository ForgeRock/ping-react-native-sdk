/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Optional drop-in FirebaseMessagingService for apps with no existing FCM service.
 *
 * Declare in your AndroidManifest.xml:
 * ```xml
 * <service android:name="com.pingidentity.rnpush.RNPingPushMessagingService"
 *          android:exported="false">
 *   <intent-filter>
 *     <action android:name="com.google.firebase.MESSAGING_EVENT" />
 *   </intent-filter>
 * </service>
 * ```
 *
 * If you already have a FirebaseMessagingService, use [RNPingPushCommon.emitEvent] instead.
 */
class RNPingPushMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel(this)
    }

    override fun onNewToken(token: String) {
        scope.launch(Dispatchers.Main) {
            RNPingPushCommon.emitEvent(RNPingPushEvents.FCM_TOKEN_RECEIVED, token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        if (remoteMessage.data.isEmpty()) return
        val params = Arguments.createMap()
        remoteMessage.data.forEach { (k, v) -> params.putString(k, v) }
        scope.launch(Dispatchers.Main) {
            RNPingPushCommon.emitEvent(RNPingPushEvents.PUSH_MESSAGE_RECEIVED, params)
        }
        if (!isAppInForeground()) {
            postSystemNotification(remoteMessage.data)
        }
    }

    private fun isAppInForeground(): Boolean {
        val am = getSystemService(ACTIVITY_SERVICE) as ActivityManager
        return am.runningAppProcesses?.any {
            it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
                it.processName == packageName
        } ?: false
    }

    private fun postSystemNotification(data: Map<String, String>) {
        val payload = buildPayloadString(data)
        val notificationId = payload.hashCode()

        val launcherIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_PUSH_COLD_START, true)
            putExtra(EXTRA_PUSH_PAYLOAD, payload)
        } ?: return

        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, launcherIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val (title, body) = extractNotificationText(
            data,
            getString(R.string.ping_push_notification_title),
            getString(R.string.ping_push_notification_body),
        )

        val iconRes = resources.getIdentifier("ping_push_notification_icon", "drawable", packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setColor(getColor(R.color.ping_push_notification_color))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setGroup(NOTIFICATION_GROUP)
            .build()

        if (NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            NotificationManagerCompat.from(this).notify(notificationId, notification)
        }
    }

    private fun buildPayloadString(data: Map<String, String>): String {
        return data.entries.joinToString(",") { (k, v) -> "$k=$v" }
    }

    companion object {
        const val CHANNEL_ID = "com.pingidentity.rnpush.channel"
        const val NOTIFICATION_GROUP = "com.pingidentity.rnpush.group"
        const val EXTRA_PUSH_COLD_START = "com.pingidentity.rnpush.cold_start"
        const val EXTRA_PUSH_PAYLOAD = "com.pingidentity.rnpush.payload"

        /**
         * Pure JWT extraction logic — testable without Android context.
         *
         * Requires both `"message"` (the JWT) and `"messageId"` to be present —
         * matching [PingAMPushHandler.canHandle] in the native SDK. Returns
         * [defaultTitle] / [defaultBody] for any non-Ping or unparseable payload.
         */
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

        fun ensureNotificationChannel(context: Context) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.ping_push_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.ping_push_channel_description)
                enableVibration(true)
                enableLights(true)
            }
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
}
