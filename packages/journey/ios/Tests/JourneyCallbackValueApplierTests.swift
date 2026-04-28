/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingJourney
@testable import RNPingJourney

final class JourneyCallbackValueApplierTests: XCTestCase {

  func testParseInputMapsCallbacksWithOptionalIndex() throws {
    let input: NSDictionary = [
      "callbacks": [
        [
          "type": "NameCallback",
          "value": "demo-user",
          "index": 1
        ],
        [
          "type": "PasswordCallback",
          "value": "demo-pass"
        ]
      ]
    ]

    let mutations = try JourneyCallbackValueApplier.parseInput(input)

    XCTAssertEqual(mutations.count, 2)
    XCTAssertEqual(mutations[0].type, "NameCallback")
    XCTAssertEqual(mutations[0].index, 1)
    XCTAssertEqual(mutations[0].value as? String, "demo-user")
    XCTAssertEqual(mutations[1].type, "PasswordCallback")
    XCTAssertNil(mutations[1].index)
    XCTAssertEqual(mutations[1].value as? String, "demo-pass")
  }

  func testParseInputRejectsMalformedCallbackPayload() {
    let input: NSDictionary = [
      "callbacks": ["invalid-callback-item"]
    ]

    XCTAssertThrowsError(
      try JourneyCallbackValueApplier.parseInput(input)
    ) { error in
      guard case let JourneyBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("Invalid callback payload"))
    }
  }

  func testParseInputRejectsMissingCallbackType() {
    let input: NSDictionary = [
      "callbacks": [
        [
          "value": "demo-user"
        ]
      ]
    ]

    XCTAssertThrowsError(
      try JourneyCallbackValueApplier.parseInput(input)
    ) { error in
      guard case let JourneyBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("Callback type is required"))
    }
  }

  func testApplyUpdatesCoreManualCallbacks() async throws {
    let name = await NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "User Name"]],
      input: [["name": "IDToken1", "value": ""]]
    )) as! NameCallback
    let password = await PasswordCallback().initialize(with: callbackPayload(
      type: "PasswordCallback",
      output: [["name": "prompt", "value": "Password"]],
      input: [["name": "IDToken2", "value": ""]]
    )) as! PasswordCallback

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "demo-user", index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "PasswordCallback", value: "demo-pass", index: nil)
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks([name, password], mutations: mutations)

    XCTAssertEqual(name.name, "demo-user")
    XCTAssertEqual(password.password, "demo-pass")
  }

  func testApplyRespectsPerTypeIndexForDuplicateCallbacks() async throws {
    let firstName = await NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "First"]],
      input: [["name": "IDToken1", "value": ""]]
    )) as! NameCallback
    let secondName = await NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "Second"]],
      input: [["name": "IDToken2", "value": ""]]
    )) as! NameCallback

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "value-1", index: 1),
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "value-0", index: 0)
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks([firstName, secondName], mutations: mutations)

    XCTAssertEqual(firstName.name, "value-0")
    XCTAssertEqual(secondName.name, "value-1")
  }

  func testApplyRejectsOutputOnlyCallbackMutation() async {
    let callback = await TextOutputCallback().initialize(with: callbackPayload(
      type: "TextOutputCallback",
      output: [
        ["name": "message", "value": "Read-only output"],
        ["name": "messageType", "value": "0"]
      ],
      input: []
    ))

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "TextOutputCallback", value: "mutate", index: nil)
    ]

    do {
      try await JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
      XCTFail("Expected unsupported callback error")
    } catch let JourneyBridgeError.unsupportedCallback(message) {
      XCTAssertTrue(message.contains("output-only"))
    } catch {
      XCTFail("Expected unsupported callback error, got \(error)")
    }
  }

  func testApplyRejectsIntegrationRequiredCallbacks() async {
    class DeviceProfileCallback {}
    let callback = DeviceProfileCallback()

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "DeviceProfileCallback", value: "token", index: nil)
    ]

    do {
      try await JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
      XCTFail("Expected missing integration error")
    } catch let JourneyBridgeError.missingIntegration(message) {
      XCTAssertTrue(message.contains("requires additional native integration"))
    } catch {
      XCTFail("Expected missing integration error, got \(error)")
    }
  }

  @MainActor
  func testApplyRejectsFidoIntegrationCallbacks() async {
    class FidoRegistrationCallback {}
    class FidoAuthenticationCallback {}

    let cases: [(Any, String)] = [
      (FidoRegistrationCallback(), "FidoRegistrationCallback"),
      (FidoAuthenticationCallback(), "FidoAuthenticationCallback"),
    ]

    for (callback, type) in cases {
      do {
        let mutations = [
          JourneyCallbackValueApplier.CallbackMutation(type: type, value: "token", index: nil)
        ]
        try await JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
        XCTFail("Expected missing integration error for \(type)")
      } catch let JourneyBridgeError.missingIntegration(message) {
        XCTAssertTrue(message.contains("@ping-identity/rn-fido"))
      } catch {
        XCTFail("Expected missing integration error for \(type), got \(error)")
      }
    }
  }
  @MainActor
  func testApplyNormalizesExternalIdpAliasInputsForIntegrationCallbacks() async {
    class IdpCallback {}
    class SelectIdpCallback {}

    let cases: [(Any, String)] = [
      (IdpCallback(), "IdPCallback"),
      (SelectIdpCallback(), "SelectIdPCallback")
    ]

    for (callback, type) in cases {
      do {
        let mutations = [
          JourneyCallbackValueApplier.CallbackMutation(type: type, value: "token", index: nil)
        ]
        try await JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
        XCTFail("Expected missing integration error for \(type)")
      } catch let JourneyBridgeError.missingIntegration(message) {
        XCTAssertTrue(message.contains("External IdP integration"))
      } catch {
        XCTFail("Expected missing integration error for \(type), got \(error)")
      }
    }
  }

  func testApplyMapsKbaObjectValues() async throws {
    let callback = await KbaCreateCallback().initialize(with: callbackPayload(
      type: "KbaCreateCallback",
      output: [
        ["name": "prompt", "value": "Choose question"],
        ["name": "predefinedQuestions", "value": ["Question 1", "Question 2"]],
        ["name": "allowUserDefinedQuestions", "value": true]
      ],
      input: [
        ["name": "IDToken1", "value": ""],
        ["name": "IDToken2", "value": ""]
      ]
    )) as! KbaCreateCallback

    let mutationValue: NSDictionary = [
      "selectedQuestion": "Question 2",
      "selectedAnswer": "answer",
      "allowUserDefinedQuestions": false
    ]
    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "KbaCreateCallback", value: mutationValue, index: nil)
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)

    XCTAssertEqual(callback.selectedQuestion, "Question 2")
    XCTAssertEqual(callback.selectedAnswer, "answer")
    XCTAssertEqual(callback.allowUserDefinedQuestions, false)
  }

  func testApplyMutatesAttributeAndTermsCallbackValues() async throws {
    let textInput = TextInputCallback()
    let stringAttribute = StringAttributeInputCallback()
    let numberAttribute = NumberAttributeInputCallback()
    let booleanAttribute = BooleanAttributeInputCallback()
    let hiddenValue = HiddenValueCallback()
    let terms = TermsAndConditionsCallback()
    let consent = ConsentMappingCallback()

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "TextInputCallback", value: "hello", index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "StringAttributeInputCallback", value: "string", index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "NumberAttributeInputCallback", value: 42, index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "BooleanAttributeInputCallback", value: true, index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "HiddenValueCallback", value: "hidden", index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "TermsAndConditionsCallback", value: true, index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "ConsentMappingCallback", value: true, index: nil)
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks(
      [textInput, stringAttribute, numberAttribute, booleanAttribute, hiddenValue, terms, consent],
      mutations: mutations
    )

    XCTAssertEqual(textInput.text, "hello")
    XCTAssertEqual(stringAttribute.value, "string")
    XCTAssertEqual(numberAttribute.value, 42.0)
    XCTAssertEqual(booleanAttribute.value, true)
    XCTAssertEqual(hiddenValue.value, "hidden")
    XCTAssertEqual(terms.accepted, true)
    XCTAssertEqual(consent.accepted, true)
  }

  func testApplySupportsValidatedAliasTypes() async throws {
    let validatedPassword = ValidatedPasswordCallback()
    let validatedUsername = ValidatedUsernameCallback()
    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(
        type: "ValidatedCreatePasswordCallback",
        value: "S3cr3t!",
        index: nil
      ),
      JourneyCallbackValueApplier.CallbackMutation(
        type: "ValidatedCreateUsernameCallback",
        value: "demo-user",
        index: nil
      )
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks(
      [validatedPassword, validatedUsername],
      mutations: mutations
    )

    XCTAssertEqual(validatedPassword.password, "S3cr3t!")
    XCTAssertEqual(validatedUsername.username, "demo-user")
  }

  func testApplyMutatesChoiceAndConfirmationCallbacks() async throws {
    let choice = ChoiceCallback()
    let confirmation = ConfirmationCallback()
    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "ChoiceCallback", value: 1, index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "ConfirmationCallback", value: "0", index: nil)
    ]

    try await JourneyCallbackValueApplier.applyToCallbacks(
      [choice, confirmation],
      mutations: mutations
    )

    XCTAssertEqual(choice.selectedIndex, 1)
    XCTAssertEqual(confirmation.selectedIndex, 0)
  }

  private func callbackPayload(
    type: String,
    output: [[String: Any]],
    input: [[String: Any]]
  ) -> [String: Any] {
    return [
      "type": type,
      "output": output,
      "input": input
    ]
  }
}
