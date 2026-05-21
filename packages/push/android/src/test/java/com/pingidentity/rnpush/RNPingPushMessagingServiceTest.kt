/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import android.util.Base64
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for [RNPingPushMessagingService.extractNotificationText].
 *
 * The companion function is pure (no Android context) so these run without
 * a real device or emulator.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingPushMessagingServiceTest {

    private val defaultTitle = "Authentication Request"
    private val defaultBody = "You have a new authentication request"

    private fun makeJwt(claims: Map<String, String>): String {
        val header = Base64.encodeToString("""{"alg":"HS256"}""".toByteArray(), Base64.URL_SAFE or Base64.NO_PADDING)
        val payload = Base64.encodeToString(JSONObject(claims).toString().toByteArray(), Base64.URL_SAFE or Base64.NO_PADDING)
        return "$header.$payload.signature"
    }

    private fun extract(data: Map<String, String>) =
        RNPingPushMessagingService.extractNotificationText(data, defaultTitle, defaultBody)

    // ── Guard checks ──────────────────────────────────────────────────────────

    @Test
    fun missingMessageKeyReturnsFallback() {
        val result = extract(mapOf("messageId" to "id-1"))
        assertEquals(defaultTitle to defaultBody, result)
    }

    @Test
    fun missingMessageIdKeyReturnsFallback() {
        val result = extract(mapOf("message" to makeJwt(mapOf("m" to "Approve?"))))
        assertEquals(defaultTitle to defaultBody, result)
    }

    @Test
    fun emptyDataReturnsFallback() {
        val result = extract(emptyMap())
        assertEquals(defaultTitle to defaultBody, result)
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    @Test
    fun extractsMessageTextFromMClaim() {
        val data = mapOf(
            "message" to makeJwt(mapOf("m" to "Did you try to login?")),
            "messageId" to "msg-1",
        )
        val (title, body) = extract(data)
        assertEquals(defaultTitle, title)
        assertEquals("Did you try to login?", body)
    }

    @Test
    fun titleIsAlwaysDefaultTitle() {
        val data = mapOf(
            "message" to makeJwt(mapOf("m" to "Some message")),
            "messageId" to "msg-1",
        )
        val (title, _) = extract(data)
        assertEquals(defaultTitle, title)
    }

    // ── Fallback cases ────────────────────────────────────────────────────────

    @Test
    fun missingMClaimFallsBackToDefaultBody() {
        val data = mapOf(
            "message" to makeJwt(mapOf("u" to "credential-id")),
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals(defaultBody, body)
    }

    @Test
    fun emptyMClaimFallsBackToDefaultBody() {
        val data = mapOf(
            "message" to makeJwt(mapOf("m" to "")),
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals(defaultBody, body)
    }

    @Test
    fun malformedJwtFallsBackToDefaultBody() {
        val data = mapOf(
            "message" to "not.a.valid.jwt.at.all",
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals(defaultBody, body)
    }

    @Test
    fun jwtWithOnlyOneSegmentFallsBackToDefaultBody() {
        val data = mapOf(
            "message" to "onlyone",
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals(defaultBody, body)
    }

    @Test
    fun nonJsonPayloadSegmentFallsBackToDefaultBody() {
        val badPayload = Base64.encodeToString("not json at all".toByteArray(), Base64.URL_SAFE or Base64.NO_PADDING)
        val data = mapOf(
            "message" to "header.$badPayload.sig",
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals(defaultBody, body)
    }

    @Test
    fun additionalJwtClaimsIgnored() {
        val data = mapOf(
            "message" to makeJwt(mapOf("m" to "Login attempt", "u" to "cred-123", "t" to "120")),
            "messageId" to "msg-1",
        )
        val (_, body) = extract(data)
        assertEquals("Login attempt", body)
    }
}
