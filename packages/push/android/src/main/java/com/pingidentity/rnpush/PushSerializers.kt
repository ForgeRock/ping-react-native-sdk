/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.pingidentity.mfa.push.PushCredential
import com.pingidentity.mfa.push.PushNotification
import com.pingidentity.rncore.utils.requireString
import java.util.Date

// ---------------------------------------------------------------------------
// PushCredential serialization
// ---------------------------------------------------------------------------

/**
 * Converts a native [PushCredential] to a React Native [WritableMap] for bridge transport.
 *
 * The bridge representation uses keys that match the TypeScript `PushCredential` type
 * defined in `@ping-identity/rn-push`. Android SDK field names are mapped to their
 * corresponding bridge keys where they differ (e.g. `timeAdded` → `"createdAt"`).
 *
 * The `sharedSecret` field is deliberately excluded — it is a security-sensitive value
 * kept native-side only and must never cross the bridge.
 *
 * @param credential The native push credential to serialize.
 * @return A [WritableMap] with all bridgeable credential fields using bridge-standard keys.
 */
internal fun serializeCredential(credential: PushCredential): WritableMap {
    val map = Arguments.createMap()
    map.putString("id", credential.id)
    map.putString("issuer", credential.issuer)
    map.putString("accountName", credential.accountName)
    // TODO-PUSH-PARITY: displayIssuer and displayAccountName are non-nullable on Android but
    // nullable on iOS — Android SDK should align to nullable to match the bridge contract.
    map.putString("displayIssuer", credential.displayIssuer)
    map.putString("displayAccountName", credential.displayAccountName)
    // createdAt is a Date on the published AAR
    map.putDouble("createdAt", credential.createdAt.time.toDouble())
    // policies is a nullable JSON string
    if (credential.policies != null) {
        map.putString("policies", credential.policies)
    } else {
        map.putNull("policies")
    }
    // lockingPolicy is a nullable JSON string (null when not set on the SDK)
    if (credential.lockingPolicy != null) {
        map.putString("lockingPolicy", credential.lockingPolicy)
    } else {
        map.putNull("lockingPolicy")
    }
    map.putBoolean("isLocked", credential.isLocked)
    // imageURL is a nullable display hint
    if (credential.imageURL != null) {
        map.putString("imageURL", credential.imageURL)
    } else {
        map.putNull("imageURL")
    }
    // backgroundColor is a nullable display hint
    if (credential.backgroundColor != null) {
        map.putString("backgroundColor", credential.backgroundColor)
    } else {
        map.putNull("backgroundColor")
    }
    // TODO-PUSH-PARITY: platform is a raw String on Android but a typed PushPlatform enum on iOS
    // — Android SDK should expose a typed enum to match.
    map.putString("platform", credential.platform)
    // TODO-PUSH-PARITY: userId, resourceId, serverEndpoint are present on the iOS PushCredential
    // but missing from the Android PushCredential SDK class — emit null as a placeholder.
    map.putNull("userId")
    map.putNull("resourceId")
    map.putNull("serverEndpoint")
    // sharedSecret is intentionally NOT included — never crosses the bridge
    return map
}

/**
 * Reconstructs a native [PushCredential] from a React Native [ReadableMap].
 *
 * The `sharedSecret` field is not present in the bridge map since it is never
 * serialized to JS. A placeholder empty string is used to satisfy the non-optional
 * constructor requirement of the native Android SDK.
 *
 * @param map The bridge map containing credential fields.
 * @return A native [PushCredential] reconstructed from the bridge fields.
 * @throws IllegalArgumentException when required string fields are missing or blank.
 */
internal fun deserializeCredential(map: ReadableMap): PushCredential {
    val id = requireString(map, "id")
    val issuer = requireString(map, "issuer")
    val accountName = requireString(map, "accountName")
    val displayIssuer = optionalStringField(map, "displayIssuer")
    val displayAccountName = optionalStringField(map, "displayAccountName")
    // "createdAt" (bridge key) → timeAdded (Android SDK field)
    val timeAdded = if (map.hasKey("createdAt") && !map.isNull("createdAt")) {
        map.getDouble("createdAt").toLong()
    } else {
        0L
    }
    val policies = optionalStringField(map, "policies")
    val lockingPolicy = optionalStringField(map, "lockingPolicy")
    val isLocked = if (map.hasKey("isLocked")) map.getBoolean("isLocked") else false
    val imageURL = optionalStringField(map, "imageURL")
    val backgroundColor = optionalStringField(map, "backgroundColor")
    val platformStr = if (map.hasKey("platform") && !map.isNull("platform")) {
        map.getString("platform") ?: "PING_AM"
    } else {
        "PING_AM"
    }

    // TODO-PUSH-PARITY: sharedSecret is non-optional on Android but optional on iOS — Android SDK
    // should make it optional so saveCredential round-trips work without a placeholder empty string.
    return PushCredential(
        id = id,
        issuer = issuer,
        accountName = accountName,
        displayIssuer = displayIssuer ?: issuer,
        displayAccountName = displayAccountName ?: accountName,
        createdAt = Date(timeAdded),
        sharedSecret = "",
        serverEndpoint = "",
        policies = policies,
        lockingPolicy = lockingPolicy,
        isLocked = isLocked,
        imageURL = imageURL,
        backgroundColor = backgroundColor,
        platform = platformStr,
    )
}

// ---------------------------------------------------------------------------
// PushNotification serialization
// ---------------------------------------------------------------------------

/**
 * Converts a native [PushNotification] to a React Native [WritableMap] for bridge transport.
 *
 * Notification objects travel native → JS only; there is no deserialization path.
 *
 * The bridge representation uses keys that match the TypeScript `PushNotification` type.
 * Android SDK field names are mapped to their bridge keys where they differ
 * (e.g. `type` → `"pushType"`, `message` → `"messageText"`, `timeAdded` → `"createdAt"`).
 *
 * @param notification The native push notification to serialize.
 * @return A [WritableMap] with all bridgeable notification fields using bridge-standard keys.
 */
internal fun serializeNotification(notification: PushNotification): WritableMap {
    val map = Arguments.createMap()
    map.putString("id", notification.id)
    map.putString("credentialId", notification.credentialId)
    map.putDouble("ttl", notification.ttl.toDouble())
    // createdAt is a Date on the published AAR
    map.putDouble("createdAt", notification.createdAt.time.toDouble())
    notification.sentAt?.let { map.putDouble("sentAt", it.time.toDouble()) } ?: map.putNull("sentAt")
    notification.respondedAt?.let { map.putDouble("respondedAt", it.time.toDouble()) } ?: map.putNull("respondedAt")
    // messageText (published AAR field name)
    if (notification.messageText != null) {
        map.putString("messageText", notification.messageText)
    } else {
        map.putNull("messageText")
    }
    if (notification.customPayload != null) {
        map.putString("customPayload", notification.customPayload)
    } else {
        map.putNull("customPayload")
    }
    // TODO-PUSH-PARITY: challenge field is present on iOS PushNotification but missing from
    // Android PushNotification SDK class — emit null as a placeholder.
    map.putNull("challenge")
    if (notification.numbersChallenge != null) {
        map.putString("numbersChallenge", notification.numbersChallenge)
    } else {
        map.putNull("numbersChallenge")
    }
    map.putString("loadBalancer", notification.loadBalancer)
    map.putString("contextInfo", notification.contextInfo)
    map.putString("messageId", notification.messageId)
    map.putString("pushType", notification.pushType.name.lowercase())
    map.putBoolean("approved", notification.approved)
    map.putBoolean("pending", notification.pending)
    return map
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Reads an optional nullable string value from a React Native [ReadableMap].
 *
 * @param map The map to read from.
 * @param key The key to look up.
 * @return The string value, or `null` when the key is absent or null.
 */
private fun optionalStringField(map: ReadableMap, key: String): String? {
    return if (map.hasKey(key) && !map.isNull(key)) map.getString(key) else null
}
