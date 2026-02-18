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

  func testApplyUpdatesCoreManualCallbacks() throws {
    let name = NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "User Name"]],
      input: [["name": "IDToken1", "value": ""]]
    )) as! NameCallback
    let password = PasswordCallback().initialize(with: callbackPayload(
      type: "PasswordCallback",
      output: [["name": "prompt", "value": "Password"]],
      input: [["name": "IDToken2", "value": ""]]
    )) as! PasswordCallback

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "demo-user", index: nil),
      JourneyCallbackValueApplier.CallbackMutation(type: "PasswordCallback", value: "demo-pass", index: nil)
    ]

    try JourneyCallbackValueApplier.applyToCallbacks([name, password], mutations: mutations)

    XCTAssertEqual(name.name, "demo-user")
    XCTAssertEqual(password.password, "demo-pass")
  }

  func testApplyRespectsPerTypeIndexForDuplicateCallbacks() throws {
    let firstName = NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "First"]],
      input: [["name": "IDToken1", "value": ""]]
    )) as! NameCallback
    let secondName = NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "Second"]],
      input: [["name": "IDToken2", "value": ""]]
    )) as! NameCallback

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "value-1", index: 1),
      JourneyCallbackValueApplier.CallbackMutation(type: "NameCallback", value: "value-0", index: 0)
    ]

    try JourneyCallbackValueApplier.applyToCallbacks([firstName, secondName], mutations: mutations)

    XCTAssertEqual(firstName.name, "value-0")
    XCTAssertEqual(secondName.name, "value-1")
  }

  func testApplyRejectsOutputOnlyCallbackMutation() {
    let callback = TextOutputCallback().initialize(with: callbackPayload(
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

    XCTAssertThrowsError(
      try JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
    ) { error in
      guard case let JourneyBridgeError.unsupportedCallback(message) = error else {
        return XCTFail("Expected unsupported callback error, got \(error)")
      }
      XCTAssertTrue(message.contains("output-only"))
    }
  }

  func testApplyRejectsIntegrationRequiredCallbacks() {
    let callback = IntegrationRequiredStubCallback().initialize(with: callbackPayload(
      type: "Fido2RegistrationCallback",
      output: [],
      input: [["name": "token", "value": ""]]
    ))

    let mutations = [
      JourneyCallbackValueApplier.CallbackMutation(type: "Fido2RegistrationCallback", value: "token", index: nil)
    ]

    XCTAssertThrowsError(
      try JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)
    ) { error in
      guard case let JourneyBridgeError.missingIntegration(message) = error else {
        return XCTFail("Expected missing integration error, got \(error)")
      }
      XCTAssertTrue(message.contains("requires additional native integration"))
    }
  }

  func testApplyMapsKbaObjectValues() throws {
    let callback = KbaCreateCallback().initialize(with: callbackPayload(
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

    try JourneyCallbackValueApplier.applyToCallbacks([callback], mutations: mutations)

    XCTAssertEqual(callback.selectedQuestion, "Question 2")
    XCTAssertEqual(callback.selectedAnswer, "answer")
    XCTAssertEqual(callback.allowUserDefinedQuestions, false)
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

private final class IntegrationRequiredStubCallback: AbstractCallback {
  override func initValue(name: String, value: Any) {
    // No-op: this stub only exists to expose callback `type` from raw JSON.
  }
}

