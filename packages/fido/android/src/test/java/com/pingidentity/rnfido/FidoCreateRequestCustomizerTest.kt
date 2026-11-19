/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.CreatePublicKeyCredentialRequest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for applying a [FidoCreateRequestSpec] to a create request.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoCreateRequestCustomizerTest {

  private val warnings = mutableListOf<String>()

  private val originalJson =
    """{"challenge":"abc","rp":{"id":"example.com","name":"Example"},"user":{"id":"dXNlcg","name":"user","displayName":"User"}}"""
  private val originalHash = byteArrayOf(1, 2, 3)

  private data class Snapshot(
    val requestJson: JsonObject,
    val clientDataHash: List<Byte>?,
    val preferImmediatelyAvailableCredentials: Boolean,
    val origin: String?,
    val isAutoSelectAllowed: Boolean,
    val isConditional: Boolean,
    val preferDefaultProvider: String?
  )

  private fun snapshot(request: CreatePublicKeyCredentialRequest) = Snapshot(
    requestJson = Json.parseToJsonElement(request.requestJson) as JsonObject,
    clientDataHash = request.clientDataHash?.toList(),
    preferImmediatelyAvailableCredentials = request.preferImmediatelyAvailableCredentials,
    origin = request.origin,
    isAutoSelectAllowed = request.isAutoSelectAllowed,
    isConditional = request.isConditional,
    preferDefaultProvider = request.displayInfo.preferDefaultProvider
  )

  private fun original(isConditional: Boolean = false) = CreatePublicKeyCredentialRequest(
    requestJson = originalJson,
    clientDataHash = originalHash,
    preferImmediatelyAvailableCredentials = false,
    origin = "https://original.example",
    isAutoSelectAllowed = false,
    isConditional = isConditional
  )

  private fun apply(
    spec: FidoCreateRequestSpec,
    request: CreatePublicKeyCredentialRequest = original()
  ): CreatePublicKeyCredentialRequest {
    return FidoCreateRequestCustomizer(spec) { warnings.add(it) }.customize(request)
  }

  /**
   * Ensures an empty spec reproduces the original request field by field.
   */
  @Test
  fun emptySpecKeepsEveryField() {
    val request = original()

    assertEquals(snapshot(request), snapshot(apply(FidoCreateRequestSpec(), request)))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures each field set alone changes only that field.
   */
  @Test
  fun eachFieldAloneChangesOnlyThatField() {
    val base = snapshot(original())
    val cases = listOf(
      FidoCreateRequestSpec(requestJsonPatch = Json.parseToJsonElement("""{"rp":{"name":"Patched"}}""") as JsonObject) to
        base.copy(
          requestJson = Json.parseToJsonElement(
            """{"challenge":"abc","rp":{"id":"example.com","name":"Patched"},"user":{"id":"dXNlcg","name":"user","displayName":"User"}}"""
          ) as JsonObject
        ),
      FidoCreateRequestSpec(clientDataHash = "BAUG") to base.copy(clientDataHash = listOf<Byte>(4, 5, 6)),
      FidoCreateRequestSpec(preferImmediatelyAvailableCredentials = true) to
        base.copy(preferImmediatelyAvailableCredentials = true),
      FidoCreateRequestSpec(origin = "https://new.example") to base.copy(origin = "https://new.example"),
      FidoCreateRequestSpec(isAutoSelectAllowed = true) to base.copy(isAutoSelectAllowed = true),
      FidoCreateRequestSpec(isConditional = true) to base.copy(isConditional = true),
      FidoCreateRequestSpec(preferDefaultProvider = "com.example/.Provider") to
        base.copy(preferDefaultProvider = "com.example/.Provider")
    )

    cases.forEach { (spec, expected) ->
      assertEquals(spec.toString(), expected, snapshot(apply(spec)))
    }
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the constructor without a default provider keeps conditional and auto-select state.
   */
  @Test
  fun constructorWithoutProviderCarriesConditionalState() {
    val request = original(isConditional = true)

    val result = apply(FidoCreateRequestSpec(isAutoSelectAllowed = true), request)

    assertTrue(result.isConditional)
    assertTrue(result.isAutoSelectAllowed)
    assertNull(result.displayInfo.preferDefaultProvider)
  }

  /**
   * Ensures the constructor with a default provider keeps every other original field.
   */
  @Test
  fun constructorWithProviderKeepsOtherFields() {
    val result = apply(
      FidoCreateRequestSpec(preferDefaultProvider = "com.example/.Provider", isAutoSelectAllowed = true)
    )

    assertEquals("com.example/.Provider", result.displayInfo.preferDefaultProvider)
    assertTrue(result.isAutoSelectAllowed)
    assertFalse(result.isConditional)
    assertEquals("https://original.example", result.origin)
    assertEquals(originalHash.toList(), result.clientDataHash?.toList())
  }

  /**
   * Ensures a default provider combined with a conditional request is rejected and the
   * original request is kept.
   */
  @Test
  fun providerWithConditionalTrueIsRejected() {
    val request = original()

    val result = apply(
      FidoCreateRequestSpec(preferDefaultProvider = "com.example/.Provider", isConditional = true),
      request
    )

    assertSame(request, result)
    assertEquals(1, warnings.size)
    assertFalse(warnings.single().contains("com.example"))
  }

  /**
   * Ensures a default provider combined with an already conditional original request is rejected.
   */
  @Test
  fun providerWithConditionalOriginalIsRejected() {
    val request = original(isConditional = true)

    val result = apply(FidoCreateRequestSpec(preferDefaultProvider = "com.example/.Provider"), request)

    assertSame(request, result)
    assertEquals(1, warnings.size)
  }

  /**
   * Ensures a default provider with an explicit non-conditional request is accepted.
   */
  @Test
  fun providerWithConditionalFalseIsAccepted() {
    val result = apply(
      FidoCreateRequestSpec(preferDefaultProvider = "com.example/.Provider", isConditional = false)
    )

    assertEquals("com.example/.Provider", result.displayInfo.preferDefaultProvider)
    assertFalse(result.isConditional)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures an invalid base64url hash keeps the original request and warns without the value.
   */
  @Test
  fun invalidClientDataHashKeepsOriginalAndWarnsWithoutValue() {
    val request = original()

    val result = apply(FidoCreateRequestSpec(clientDataHash = "not+base64/url!", origin = "https://new.example"), request)

    assertSame(request, result)
    assertEquals(1, warnings.size)
    assertTrue(warnings.single().contains("clientDataHash"))
    assertTrue(warnings.single().contains("length 15"))
    assertFalse(warnings.single().contains("not+base64"))
  }

  /**
   * Ensures an empty hash is treated as invalid.
   */
  @Test
  fun emptyClientDataHashIsInvalid() {
    val request = original()

    assertSame(request, apply(FidoCreateRequestSpec(clientDataHash = ""), request))
    assertEquals(1, warnings.size)
  }

  /**
   * Ensures a standard padded base64url value is accepted.
   */
  @Test
  fun paddedBase64UrlHashIsAccepted() {
    val result = apply(FidoCreateRequestSpec(clientDataHash = "AQI="))

    assertEquals(listOf<Byte>(1, 2), result.clientDataHash?.toList())
  }
}
