/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import android.content.ComponentName
import androidx.credentials.GetPublicKeyCredentialOption
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for applying a [FidoCredentialManagerSignInSpec] to a sign-in option.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoCredentialManagerSignInCustomizerTest {

  private val warnings = mutableListOf<String>()
  private val originalJson = """{"challenge":"abc","rpId":"example.com","timeout":60000}"""
  private val originalHash = byteArrayOf(9, 8, 7)
  private val originalProvider = ComponentName("com.original", "com.original.Provider")

  private data class Snapshot(
    val requestJson: JsonObject,
    val clientDataHash: List<Byte>?,
    val allowedProviders: Set<ComponentName>,
    val isAutoSelectAllowed: Boolean
  )

  private fun snapshot(option: GetPublicKeyCredentialOption) = Snapshot(
    requestJson = Json.parseToJsonElement(option.requestJson) as JsonObject,
    clientDataHash = option.clientDataHash?.toList(),
    allowedProviders = option.allowedProviders,
    isAutoSelectAllowed = option.isAutoSelectAllowed
  )

  private fun original() = GetPublicKeyCredentialOption(
    requestJson = originalJson,
    clientDataHash = originalHash,
    allowedProviders = setOf(originalProvider)
  )

  private fun customize(
    spec: FidoCredentialManagerSignInSpec,
    option: GetPublicKeyCredentialOption = original()
  ): GetPublicKeyCredentialOption {
    return FidoCredentialManagerSignInCustomizer(spec) { warnings.add(it) }.customize(option)
  }

  /**
   * Ensures an empty spec returns the original option instance.
   */
  @Test
  fun emptySpecReturnsOriginalInstance() {
    val option = original()

    assertSame(option, customize(FidoCredentialManagerSignInSpec(), option))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the request JSON patch changes only the request JSON.
   */
  @Test
  fun requestJsonPatchChangesOnlyRequestJson() {
    val before = snapshot(original())

    val after = snapshot(
      customize(
        FidoCredentialManagerSignInSpec(
          requestJsonPatch = JsonObject(mapOf("userVerification" to JsonPrimitive("required"), "timeout" to JsonNull))
        )
      )
    )

    assertEquals(
      JsonObject(mapOf("challenge" to JsonPrimitive("abc"), "rpId" to JsonPrimitive("example.com"), "userVerification" to JsonPrimitive("required"))),
      after.requestJson
    )
    assertEquals(before.copy(requestJson = after.requestJson), after)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the client data hash changes only the hash.
   */
  @Test
  fun clientDataHashChangesOnlyHash() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoCredentialManagerSignInSpec(clientDataHash = "AQID")))

    assertEquals(listOf<Byte>(1, 2, 3), after.clientDataHash)
    assertEquals(before.copy(clientDataHash = after.clientDataHash), after)
  }

  /**
   * Ensures the allowed providers replace only the providers.
   */
  @Test
  fun allowedProvidersChangeOnlyProviders() {
    val before = snapshot(original())

    val after = snapshot(
      customize(FidoCredentialManagerSignInSpec(allowedProviders = listOf("com.other/com.other.Provider")))
    )

    assertEquals(setOf(ComponentName("com.other", "com.other.Provider")), after.allowedProviders)
    assertEquals(before.copy(allowedProviders = after.allowedProviders), after)
  }

  /**
   * Ensures an explicitly empty provider list clears the providers.
   */
  @Test
  fun emptyProviderListClearsProviders() {
    val after = snapshot(customize(FidoCredentialManagerSignInSpec(allowedProviders = emptyList())))

    assertTrue(after.allowedProviders.isEmpty())
  }

  /**
   * Ensures unset providers keep the native default of the one-argument constructor.
   */
  @Test
  fun unsetProvidersKeepNativeDefault() {
    val native = GetPublicKeyCredentialOption(originalJson)

    val after = customize(FidoCredentialManagerSignInSpec(clientDataHash = "AQID"), native)

    assertEquals(native.allowedProviders, after.allowedProviders)
    assertTrue(native.allowedProviders.isEmpty())
  }

  /**
   * Ensures every field applies together.
   */
  @Test
  fun allFieldsApplyTogether() {
    val after = snapshot(
      customize(
        FidoCredentialManagerSignInSpec(
          requestJsonPatch = JsonObject(mapOf("extra" to JsonPrimitive(true))),
          clientDataHash = "AQID",
          allowedProviders = listOf("com.other/com.other.Provider")
        )
      )
    )

    assertEquals(JsonPrimitive(true), after.requestJson["extra"])
    assertEquals(listOf<Byte>(1, 2, 3), after.clientDataHash)
    assertEquals(setOf(ComponentName("com.other", "com.other.Provider")), after.allowedProviders)
  }

  /**
   * Ensures an invalid client data hash keeps the original option and warns without the value.
   */
  @Test
  fun invalidClientDataHashKeepsOriginalAndWarns() {
    val option = original()

    val result = customize(FidoCredentialManagerSignInSpec(clientDataHash = "not base64!"), option)

    assertSame(option, result)
    assertEquals(
      listOf("FIDO sign-in option 'clientDataHash' is not valid base64url (String of length 11); the original option is kept"),
      warnings
    )
  }

  /**
   * Ensures an invalid provider entry is dropped with a warning that omits its value.
   */
  @Test
  fun invalidProviderEntryIsIgnoredWithWarning() {
    val after = customize(
      FidoCredentialManagerSignInSpec(allowedProviders = listOf("no-slash", "com.other/com.other.Provider"))
    )

    assertEquals(setOf(ComponentName("com.other", "com.other.Provider")), after.allowedProviders)
    assertEquals(
      listOf("FIDO sign-in option 'allowedProviders[0]' is not a valid component name (String of length 8); the entry is ignored"),
      warnings
    )
  }
}
