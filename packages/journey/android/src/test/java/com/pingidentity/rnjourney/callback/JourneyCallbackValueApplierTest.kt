/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.pingidentity.journey.callback.BooleanAttributeInputCallback
import com.pingidentity.journey.callback.ChoiceCallback
import com.pingidentity.journey.callback.ConfirmationCallback
import com.pingidentity.journey.callback.ConsentMappingCallback
import com.pingidentity.journey.callback.HiddenValueCallback
import com.pingidentity.journey.callback.KbaCreateCallback
import com.pingidentity.journey.callback.MetadataCallback
import com.pingidentity.journey.callback.NameCallback
import com.pingidentity.journey.callback.NumberAttributeInputCallback
import com.pingidentity.journey.callback.PasswordCallback
import com.pingidentity.journey.callback.PollingWaitCallback
import com.pingidentity.journey.callback.StringAttributeInputCallback
import com.pingidentity.journey.callback.SuspendedTextOutputCallback
import com.pingidentity.journey.callback.TermsAndConditionsCallback
import com.pingidentity.journey.callback.TextInputCallback
import com.pingidentity.journey.callback.TextOutputCallback
import com.pingidentity.journey.callback.ValidatedPasswordCallback
import com.pingidentity.journey.callback.ValidatedUsernameCallback
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for Journey callback value application.
 */
class JourneyCallbackValueApplierTest {

  @Test
  fun parseInputReturnsCallbackMutations() {
    val input = JavaOnlyMap().apply {
      putArray(
        "callbacks",
        JavaOnlyArray.of(
          JavaOnlyMap.of("type", "NameCallback", "value", "demo-user", "index", 0)
        )
      )
    }

    val result = JourneyCallbackValueApplier.parseInput(input)

    assertEquals(1, result.size)
    assertEquals("NameCallback", result[0].type)
    assertEquals("demo-user", result[0].value)
    assertEquals(0, result[0].index)
  }

  @Test
  fun parseInputParsesStringIndexAndNestedValue() {
    val input = JavaOnlyMap().apply {
      putArray(
        "callbacks",
        JavaOnlyArray.of(
          JavaOnlyMap.of(
            "type",
            "KbaCreateCallback",
            "index",
            "1",
            "value",
            JavaOnlyMap.of(
              "selectedQuestion",
              "Favorite color?",
              "selectedAnswer",
              "Green"
            )
          )
        )
      )
    }

    val result = JourneyCallbackValueApplier.parseInput(input)

    assertEquals(1, result.size)
    assertEquals("KbaCreateCallback", result[0].type)
    assertEquals(1, result[0].index)
    val value = result[0].value as Map<*, *>
    assertEquals("Favorite color?", value["selectedQuestion"])
    assertEquals("Green", value["selectedAnswer"])
  }

  @Test
  fun applyMutationsAcrossCoreCallbacks() {
    val name = NameCallback()
    val password = PasswordCallback()
    val textInput = TextInputCallback()
    val stringAttr = StringAttributeInputCallback()
    val numberAttr = NumberAttributeInputCallback()
    val booleanAttr = BooleanAttributeInputCallback()
    val hiddenValue = HiddenValueCallback()
    val terms = TermsAndConditionsCallback()
    val consent = ConsentMappingCallback()
    val choice = ChoiceCallback()
    val confirmation = ConfirmationCallback()
    val validatedPassword = ValidatedPasswordCallback()
    val validatedUsername = ValidatedUsernameCallback()
    val kba = KbaCreateCallback()

    val mutations = listOf(
      JourneyCallbackValueApplier.CallbackMutation("NameCallback", "demo-user", null),
      JourneyCallbackValueApplier.CallbackMutation("PasswordCallback", "demo-pass", null),
      JourneyCallbackValueApplier.CallbackMutation("TextInputCallback", "hello", null),
      JourneyCallbackValueApplier.CallbackMutation("StringAttributeInputCallback", "string-value", null),
      JourneyCallbackValueApplier.CallbackMutation("NumberAttributeInputCallback", "42", null),
      JourneyCallbackValueApplier.CallbackMutation("BooleanAttributeInputCallback", true, null),
      JourneyCallbackValueApplier.CallbackMutation("HiddenValueCallback", "hidden-value", null),
      JourneyCallbackValueApplier.CallbackMutation("TermsAndConditionsCallback", 1, null),
      JourneyCallbackValueApplier.CallbackMutation("ConsentMappingCallback", true, null),
      JourneyCallbackValueApplier.CallbackMutation("ChoiceCallback", 1, null),
      JourneyCallbackValueApplier.CallbackMutation("ConfirmationCallback", "0", null),
      JourneyCallbackValueApplier.CallbackMutation("ValidatedCreatePasswordCallback", "S3cr3t!", null),
      JourneyCallbackValueApplier.CallbackMutation("ValidatedCreateUsernameCallback", "demo@example.com", null),
      JourneyCallbackValueApplier.CallbackMutation(
        "KbaCreateCallback",
        mapOf(
          "selectedQuestion" to "What is your pet's name?",
          "selectedAnswer" to "Nova",
          "allowUserDefinedQuestions" to true
        ),
        null
      )
    )

    JourneyCallbackValueApplier.applyToCallbacks(
      listOf(
        name,
        password,
        textInput,
        stringAttr,
        numberAttr,
        booleanAttr,
        hiddenValue,
        terms,
        consent,
        choice,
        confirmation,
        validatedPassword,
        validatedUsername,
        kba
      ),
      mutations
    )

    assertEquals("demo-user", name.name)
    assertEquals("demo-pass", password.password)
    assertEquals("hello", textInput.text)
    assertEquals("string-value", stringAttr.value)
    assertEquals(42.0, numberAttr.value, 0.0)
    assertTrue(booleanAttr.value)
    assertEquals("hidden-value", hiddenValue.value)
    assertTrue(terms.accepted)
    assertTrue(consent.accepted)
    assertEquals(1, choice.selectedIndex)
    assertEquals(0, confirmation.selectedIndex?.toInt())
    assertEquals("S3cr3t!", validatedPassword.password)
    assertEquals("demo@example.com", validatedUsername.username)
    assertEquals("What is your pet's name?", kba.selectedQuestion)
    assertEquals("Nova", kba.selectedAnswer)
    assertTrue(kba.allowUserDefinedQuestions)
  }

  @Test
  fun applyUsesSequentialIndexWhenMutationIndexIsMissing() {
    val first = NameCallback()
    val second = NameCallback()

    val mutations = listOf(
      JourneyCallbackValueApplier.CallbackMutation("NameCallback", "first-user", null),
      JourneyCallbackValueApplier.CallbackMutation("NameCallback", "second-user", null)
    )

    JourneyCallbackValueApplier.applyToCallbacks(listOf(first, second), mutations)

    assertEquals("first-user", first.name)
    assertEquals("second-user", second.name)
  }

  @Test
  fun applyThrowsForOutputOnlyCallbacks() {
    val outputOnlyCallbacks = listOf(
      MetadataCallback() to "MetadataCallback",
      PollingWaitCallback() to "PollingWaitCallback",
      SuspendedTextOutputCallback() to "SuspendedTextOutputCallback",
      TextOutputCallback() to "TextOutputCallback"
    )

    outputOnlyCallbacks.forEach { (callback, type) ->
      try {
        JourneyCallbackValueApplier.applyToCallbacks(
          listOf(callback),
          listOf(JourneyCallbackValueApplier.CallbackMutation(type, "value", null))
        )
      } catch (error: UnsupportedOperationException) {
        assertTrue(error.message?.contains("output-only") == true)
        return@forEach
      }
      throw AssertionError("Expected UnsupportedOperationException for $type")
    }
  }

  @Test
  fun applyThrowsForMissingIntegrationCallback() {
    class DeviceProfileCallback

    try {
      JourneyCallbackValueApplier.applyToCallbacks(
        listOf(DeviceProfileCallback()),
        listOf(
          JourneyCallbackValueApplier.CallbackMutation("DeviceProfileCallback", "payload", null)
        )
      )
    } catch (error: IllegalStateException) {
      assertTrue(error.message?.contains("additional native integration") == true)
      assertTrue(error.message?.contains("@react-native-pingidentity/device-profile") == true)
      return
    }
    throw AssertionError("Expected IllegalStateException for integration callback")
  }

  @Test
  fun applyThrowsForRedirectIntegrationCallback() {
    class RedirectCallback

    try {
      JourneyCallbackValueApplier.applyToCallbacks(
        listOf(RedirectCallback()),
        listOf(
          JourneyCallbackValueApplier.CallbackMutation("RedirectCallback", "payload", null)
        )
      )
    } catch (error: IllegalStateException) {
      assertTrue(error.message?.contains("additional native integration") == true)
      assertTrue(error.message?.contains("Redirect handling integration") == true)
      return
    }
    throw AssertionError("Expected IllegalStateException for redirect integration callback")
  }

  @Test
  fun applyThrowsForNativeExtensionIntegrationCallbacks() {
    class IdPCallback
    class DeviceBindingCallback
    class DeviceSigningVerifierCallback

    val callbacks = listOf(
      Triple(IdPCallback(), "IdPCallback", "External IdP integration"),
      Triple(DeviceBindingCallback(), "DeviceBindingCallback", "Binding integration"),
      Triple(DeviceSigningVerifierCallback(), "DeviceSigningVerifierCallback", "Binding integration")
    )

    callbacks.forEach { (callback, type, expectedRequirement) ->
      try {
        JourneyCallbackValueApplier.applyToCallbacks(
          listOf(callback),
          listOf(JourneyCallbackValueApplier.CallbackMutation(type, "payload", null))
        )
      } catch (error: IllegalStateException) {
        assertTrue(error.message?.contains("additional native integration") == true)
        assertTrue(error.message?.contains(expectedRequirement) == true)
        return@forEach
      }

      throw AssertionError("Expected IllegalStateException for $type integration callback")
    }
  }

  @Test
  fun applyThrowsForUnsupportedCallback() {
    class UnknownCustomCallback

    try {
      JourneyCallbackValueApplier.applyToCallbacks(
        listOf(UnknownCustomCallback()),
        listOf(
          JourneyCallbackValueApplier.CallbackMutation("UnknownCustomCallback", "payload", null)
        )
      )
    } catch (error: UnsupportedOperationException) {
      assertTrue(error.message?.contains("not supported for value mutation") == true)
      return
    }
    throw AssertionError("Expected UnsupportedOperationException for unsupported callback")
  }
}
