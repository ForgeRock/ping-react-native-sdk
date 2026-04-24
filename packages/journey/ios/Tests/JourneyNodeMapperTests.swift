/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingJourney
import PingOrchestrate
@testable import RNPingJourney

final class JourneyNodeMapperTests: XCTestCase {

  func testMapNodePayloadContinueIncludesCallbacksAndInput() async {
    let callback = await NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "User Name"]],
      input: [["name": "IDToken1", "value": ""]]
    ))
    let node = TestContinueNode(
      context: FlowContext(flowContext: SharedContext()),
      workflow: Workflow(config: WorkflowConfig()),
      input: ["authId": "auth-id"],
      actions: [callback]
    )

    let payload = JourneyNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "ContinueNode")
    let input = payload["input"] as? [String: Any]
    XCTAssertEqual(input?["authId"] as? String, "auth-id")
    let callbacks = payload["callbacks"] as? [[String: Any]]
    XCTAssertEqual(callbacks?.count, 1)
    XCTAssertEqual(callbacks?.first?["type"] as? String, "NameCallback")
    XCTAssertEqual(callbacks?.first?["prompt"] as? String, "User Name")
  }

  func testMapNodePayloadErrorIncludesStatusMessageAndInput() {
    let node = ErrorNode(
      status: 401,
      input: ["code": "INVALID_CREDENTIALS"],
      message: "Invalid credentials",
      context: FlowContext(flowContext: SharedContext())
    )

    let payload = JourneyNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "ErrorNode")
    XCTAssertEqual(payload["message"] as? String, "Invalid credentials")
    XCTAssertEqual(payload["status"] as? Int, 401)
    let input = payload["input"] as? [String: Any]
    XCTAssertEqual(input?["code"] as? String, "INVALID_CREDENTIALS")
  }

  func testMapNodePayloadSuccessIncludesInput() {
    let node = SuccessNode(input: ["tokenId": "abc"], session: EmptySession())

    let payload = JourneyNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "SuccessNode")
    let input = payload["input"] as? [String: Any]
    XCTAssertEqual(input?["tokenId"] as? String, "abc")
  }

  func testMapNodePayloadFailureIncludesMessageAndCause() {
    let node = FailureNode(cause: NSError(
      domain: "test",
      code: -1,
      userInfo: [NSLocalizedDescriptionKey: "network failure"]
    ))

    let payload = JourneyNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "FailureNode")
    XCTAssertEqual(payload["message"] as? String, "network failure")
    XCTAssertEqual(payload["cause"] as? String, "network failure")
  }

  func testMapNodeReturnsBridgeDictionary() {
    let node = SuccessNode(input: ["tokenId": "abc"], session: EmptySession())

    let payload = JourneyNodeMapper.mapNode(node)

    XCTAssertEqual(payload["type"] as? String, "SuccessNode")
    let input = payload["input"] as? [String: Any]
    XCTAssertEqual(input?["tokenId"] as? String, "abc")
  }

  func testMapCallbackPayloadIncludesValidatedAliasTypeAndFields() async {
    let callback = await ValidatedPasswordCallback().initialize(with: callbackPayload(
      type: "ValidatedCreatePasswordCallback",
      output: [
        ["name": "prompt", "value": "Password"],
        ["name": "validateOnly", "value": true],
        ["name": "echoOn", "value": false]
      ],
      input: [
        ["name": "IDToken1", "value": ""],
        ["name": "IDToken2", "value": false]
      ]
    ))

    let payload = JourneyNodeMapper.mapCallbackPayload(callback)

    XCTAssertEqual(payload["type"] as? String, "ValidatedCreatePasswordCallback")
    XCTAssertEqual(payload["prompt"] as? String, "Password")
    XCTAssertEqual(payload["validateOnly"] as? Bool, true)
    XCTAssertEqual(payload["echoOn"] as? Bool, false)
    XCTAssertEqual(payload["value"] as? String, "")
  }


  func testMapCallbackPayloadExposesExternalIdpCanonicalTypeNames() {
    class IdpCallback {}
    class SelectIdpCallback {}

    let idpPayload = JourneyNodeMapper.mapCallbackPayload(IdpCallback())
    let selectIdpPayload = JourneyNodeMapper.mapCallbackPayload(SelectIdpCallback())

    XCTAssertEqual(idpPayload["type"] as? String, "IdpCallback")
    XCTAssertEqual(selectIdpPayload["type"] as? String, "SelectIdpCallback")
  }

  func testMapCallbackPayloadIncludesConsentFields() {
    let callback = ConsentMappingCallback().initialize(with: callbackPayload(
      type: "ConsentMappingCallback",
      output: [
        ["name": "name", "value": "email-consent"],
        ["name": "displayName", "value": "Email Consent"],
        ["name": "message", "value": "Allow access?"],
        ["name": "isRequired", "value": true],
        ["name": "fields", "value": ["mail"]]
      ],
      input: [["name": "IDToken1", "value": false]]
    ))

    let payload = JourneyNodeMapper.mapCallbackPayload(callback)

    XCTAssertEqual(payload["type"] as? String, "ConsentMappingCallback")
    XCTAssertEqual(payload["name"] as? String, "email-consent")
    XCTAssertEqual(payload["displayName"] as? String, "Email Consent")
    XCTAssertEqual(payload["message"] as? String, "Allow access?")
    XCTAssertEqual(payload["required"] as? Bool, true)
    XCTAssertEqual(payload["fields"] as? [String], ["mail"])
  }

  func testMapCallbackReturnsBridgeDictionary() async {
    let callback = await NameCallback().initialize(with: callbackPayload(
      type: "NameCallback",
      output: [["name": "prompt", "value": "User Name"]],
      input: [["name": "IDToken1", "value": "demo-user"]]
    ))

    let payload = JourneyNodeMapper.mapCallback(callback)

    XCTAssertEqual(payload["type"] as? String, "NameCallback")
    XCTAssertEqual(payload["value"] as? String, "")
    XCTAssertEqual(payload["prompt"] as? String, "User Name")
  }

  func testMapCallbackPayloadIncludesAttributeAndHiddenFields() {
    let booleanAttribute = BooleanAttributeInputCallback()
    let stringAttribute = StringAttributeInputCallback()
    let numberAttribute = NumberAttributeInputCallback()
    let hiddenValue = HiddenValueCallback()

    let booleanPayload = JourneyNodeMapper.mapCallbackPayload(booleanAttribute)
    let stringPayload = JourneyNodeMapper.mapCallbackPayload(stringAttribute)
    let numberPayload = JourneyNodeMapper.mapCallbackPayload(numberAttribute)
    let hiddenPayload = JourneyNodeMapper.mapCallbackPayload(hiddenValue)

    XCTAssertEqual(booleanPayload["type"] as? String, "BooleanAttributeInputCallback")
    XCTAssertTrue(booleanPayload.keys.contains("value"))
    XCTAssertEqual(stringPayload["type"] as? String, "StringAttributeInputCallback")
    XCTAssertTrue(stringPayload.keys.contains("value"))
    XCTAssertEqual(numberPayload["type"] as? String, "NumberAttributeInputCallback")
    XCTAssertTrue(numberPayload.keys.contains("value"))
    XCTAssertEqual(hiddenPayload["type"] as? String, "HiddenValueCallback")
    XCTAssertTrue(hiddenPayload.keys.contains("id"))
  }

  func testMapCallbackPayloadIncludesChoiceAndConfirmationFields() {
    let choice = ChoiceCallback()
    let confirmation = ConfirmationCallback()

    let choicePayload = JourneyNodeMapper.mapCallbackPayload(choice)
    let confirmationPayload = JourneyNodeMapper.mapCallbackPayload(confirmation)

    XCTAssertEqual(choicePayload["type"] as? String, "ChoiceCallback")
    XCTAssertTrue(choicePayload.keys.contains("selectedIndex"))
    XCTAssertEqual(confirmationPayload["type"] as? String, "ConfirmationCallback")
    XCTAssertTrue(confirmationPayload.keys.contains("selectedIndex"))
  }

  func testMapCallbackPayloadIncludesOutputOnlyFamilies() {
    let polling = PollingWaitCallback()
    let suspended = SuspendedTextOutputCallback()
    let metadata = MetadataCallback()

    let pollingPayload = JourneyNodeMapper.mapCallbackPayload(polling)
    let suspendedPayload = JourneyNodeMapper.mapCallbackPayload(suspended)
    let metadataPayload = JourneyNodeMapper.mapCallbackPayload(metadata)

    XCTAssertEqual(pollingPayload["type"] as? String, "PollingWaitCallback")
    XCTAssertTrue(pollingPayload.keys.contains("waitTime"))
    XCTAssertEqual(suspendedPayload["type"] as? String, "SuspendedTextOutputCallback")
    XCTAssertTrue(suspendedPayload.keys.contains("message"))
    XCTAssertEqual(metadataPayload["type"] as? String, "MetadataCallback")
    XCTAssertTrue(metadataPayload.keys.contains("value"))
  }

  func testMapCallbackPayloadIncludesTermsFields() {
    let terms = TermsAndConditionsCallback()
    let termsPayload = JourneyNodeMapper.mapCallbackPayload(terms)

    XCTAssertEqual(termsPayload["type"] as? String, "TermsAndConditionsCallback")
    XCTAssertTrue(termsPayload.keys.contains("accepted"))
    XCTAssertTrue(termsPayload.keys.contains("version"))
  }

  func testMapCoreCallbackFamiliesExposeExpectedTypeAliases() {
    let callbacks: [(Any, String)] = [
      (NameCallback(), "NameCallback"),
      (PasswordCallback(), "PasswordCallback"),
      (TextInputCallback(), "TextInputCallback"),
      (StringAttributeInputCallback(), "StringAttributeInputCallback"),
      (NumberAttributeInputCallback(), "NumberAttributeInputCallback"),
      (BooleanAttributeInputCallback(), "BooleanAttributeInputCallback"),
      (ChoiceCallback(), "ChoiceCallback"),
      (ConfirmationCallback(), "ConfirmationCallback"),
      (ConsentMappingCallback(), "ConsentMappingCallback"),
      (HiddenValueCallback(), "HiddenValueCallback"),
      (KbaCreateCallback(), "KbaCreateCallback"),
      (MetadataCallback(), "MetadataCallback"),
      (PollingWaitCallback(), "PollingWaitCallback"),
      (SuspendedTextOutputCallback(), "SuspendedTextOutputCallback"),
      (TermsAndConditionsCallback(), "TermsAndConditionsCallback"),
      (TextOutputCallback(), "TextOutputCallback"),
      (ValidatedPasswordCallback(), "ValidatedCreatePasswordCallback"),
      (ValidatedUsernameCallback(), "ValidatedCreateUsernameCallback")
    ]

    callbacks.forEach { callback, expectedType in
      let payload = JourneyNodeMapper.mapCallbackPayload(callback)
      XCTAssertEqual(payload["type"] as? String, expectedType)
    }
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

private final class TestContinueNode: ContinueNode {
  override func asRequest() -> Request {
    return workflow.config.httpClient.request()
  }
}
