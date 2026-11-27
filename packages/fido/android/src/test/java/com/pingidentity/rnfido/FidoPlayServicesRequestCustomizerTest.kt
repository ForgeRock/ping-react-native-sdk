/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.google.android.gms.fido.common.Transport
import com.google.android.gms.fido.fido2.api.common.AuthenticationExtensions
import com.google.android.gms.fido.fido2.api.common.FidoAppIdExtension
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialDescriptor
import com.google.android.gms.fido.fido2.api.common.PublicKeyCredentialRequestOptions
import com.google.android.gms.fido.fido2.api.common.UserVerificationMethodExtension
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for applying a [FidoPlayServicesRequestSpec] to Play Services request options.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class FidoPlayServicesRequestCustomizerTest {

  private val warnings = mutableListOf<String>()
  private val idA = byteArrayOf(1, 2, 3)
  private val idB = byteArrayOf(4, 5, 6)

  private data class Descriptor(val id: List<Byte>, val type: String, val transports: List<Transport>)

  private data class Snapshot(
    val challenge: List<Byte>,
    val rpId: String?,
    val timeoutSeconds: Double?,
    val requestId: Int?,
    val allowList: List<Descriptor>,
    val fidoAppId: String?,
    val userVerificationMethod: Boolean?
  )

  private fun snapshot(options: PublicKeyCredentialRequestOptions) = Snapshot(
    challenge = options.challenge.toList(),
    rpId = options.rpId,
    timeoutSeconds = options.timeoutSeconds,
    requestId = options.requestId,
    allowList = options.allowList.orEmpty().map {
      Descriptor(it.id.toList(), it.typeAsString, it.transports.orEmpty())
    },
    fidoAppId = options.authenticationExtensions?.fidoAppIdExtension?.appId,
    userVerificationMethod = options.authenticationExtensions?.userVerificationMethodExtension?.uvm
  )

  private fun original(withAllowList: Boolean = true): PublicKeyCredentialRequestOptions {
    val builder = PublicKeyCredentialRequestOptions.Builder()
      .setChallenge(byteArrayOf(7, 7, 7))
      .setRpId("example.com")
      .setTimeoutSeconds(60.0)
      .setRequestId(5)
      .setAuthenticationExtensions(
        AuthenticationExtensions.Builder()
          .setFido2Extension(FidoAppIdExtension("https://original.example"))
          .build()
      )
    if (withAllowList) {
      builder.setAllowList(
        listOf(
          PublicKeyCredentialDescriptor("public-key", idA, listOf(Transport.INTERNAL)),
          PublicKeyCredentialDescriptor("public-key", idB, listOf(Transport.INTERNAL))
        )
      )
    }
    return builder.build()
  }

  private fun customize(
    spec: FidoPlayServicesRequestSpec,
    options: PublicKeyCredentialRequestOptions = original()
  ): PublicKeyCredentialRequestOptions {
    return FidoPlayServicesRequestCustomizer(spec) { warnings.add(it) }.customize(options)
  }

  /**
   * Ensures an empty spec leaves every field of the request unchanged.
   */
  @Test
  fun emptySpecKeepsEveryField() {
    assertEquals(snapshot(original()), snapshot(customize(FidoPlayServicesRequestSpec())))
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures the timeout changes only the timeout.
   */
  @Test
  fun timeoutChangesOnlyTimeout() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(timeoutSeconds = 30.5)))

    assertEquals(30.5, after.timeoutSeconds)
    assertEquals(before.copy(timeoutSeconds = 30.5), after)
  }

  /**
   * Ensures the request id changes only the request id.
   */
  @Test
  fun requestIdChangesOnlyRequestId() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(requestId = 42)))

    assertEquals(before.copy(requestId = 42), after)
  }

  /**
   * Ensures the FIDO app id changes only that extension and keeps the other one absent.
   */
  @Test
  fun fidoAppIdChangesOnlyAppId() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(fidoAppId = "https://new.example")))

    assertEquals(before.copy(fidoAppId = "https://new.example"), after)
    assertNull(after.userVerificationMethod)
  }

  /**
   * Ensures the user verification method extension is added while the app id is preserved.
   */
  @Test
  fun userVerificationMethodPreservesAppId() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(userVerificationMethod = true)))

    assertEquals(before.copy(userVerificationMethod = true), after)
  }

  /**
   * Ensures extensions are created when the original request had none.
   */
  @Test
  fun extensionsAreCreatedWhenOriginalHasNone() {
    val bare = PublicKeyCredentialRequestOptions.Builder()
      .setChallenge(byteArrayOf(1))
      .setRpId("example.com")
      .build()

    val after = snapshot(customize(FidoPlayServicesRequestSpec(fidoAppId = "https://new.example"), bare))

    assertEquals("https://new.example", after.fidoAppId)
  }

  /**
   * Ensures the transport list replaces the transports of every descriptor and nothing else.
   */
  @Test
  fun transportsApplyToEveryDescriptor() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(transports = listOf("usb", "nfc"))))

    assertEquals(
      before.allowList.map { it.copy(transports = listOf(Transport.USB, Transport.NFC)) },
      after.allowList
    )
    assertEquals(before.copy(allowList = after.allowList), after)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures a repeated transport name is applied once.
   */
  @Test
  fun duplicateTransportNamesAreCollapsed() {
    val after = snapshot(customize(FidoPlayServicesRequestSpec(transports = listOf("usb", "usb"))))

    assertEquals(listOf(Transport.USB), after.allowList[0].transports)
    assertTrue(warnings.isEmpty())
  }

  /**
   * Ensures transports are ignored with a warning when the request has no allow list.
   */
  @Test
  fun noAllowListIgnoresTransports() {
    val bare = original(withAllowList = false)

    val after = snapshot(customize(FidoPlayServicesRequestSpec(transports = listOf("usb")), bare))

    assertEquals(snapshot(bare), after)
    assertEquals(
      listOf("FIDO transports ignored: the request has no allowed credentials (Array of length 1)"),
      warnings
    )
  }

  /**
   * Ensures an unsupported transport name is dropped with a warning that omits the name.
   */
  @Test
  fun unsupportedTransportIsDroppedWithWarning() {
    val after = snapshot(customize(FidoPlayServicesRequestSpec(transports = listOf("usb", "carrier-pigeon"))))

    assertEquals(listOf(Transport.USB), after.allowList[0].transports)
    assertEquals(listOf(Transport.USB), after.allowList[1].transports)
    assertEquals(
      listOf("FIDO transports[1] is not a supported transport (String of length 14); the entry is ignored"),
      warnings
    )
  }

  /**
   * Ensures a list without any valid transport keeps the native transports.
   */
  @Test
  fun noValidTransportKeepsNativeTransports() {
    val before = snapshot(original())

    val after = snapshot(customize(FidoPlayServicesRequestSpec(transports = listOf("bogus"))))

    assertEquals(before, after)
    assertEquals(
      listOf(
        "FIDO transports[0] is not a supported transport (String of length 5); the entry is ignored",
        "FIDO transports contain no valid transport (Array of length 1); the native transports are kept"
      ),
      warnings
    )
  }
}
