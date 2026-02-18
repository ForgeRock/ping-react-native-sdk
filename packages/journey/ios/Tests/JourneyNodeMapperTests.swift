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

  func testMapNodePayloadContinueIncludesCallbacksAndInput() {
    let callback = NameCallback().initialize(with: callbackPayload(
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

  func testMapCallbackPayloadIncludesValidatedAliasTypeAndFields() {
    let callback = ValidatedPasswordCallback().initialize(with: callbackPayload(
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
    return Request()
  }
}

