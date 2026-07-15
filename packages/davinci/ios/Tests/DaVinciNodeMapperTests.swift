//
//  DaVinciNodeMapperTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
import PingDavinci
import PingDavinciPlugin
import PingOrchestrate
@testable import RNPingDavinci

final class DaVinciNodeMapperTests: XCTestCase {

  // MARK: - mapNodePayload

  func testMapNodePayloadContinueNodeIncludesCollectors() {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "username")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "ContinueNode")
    let collectors = payload["collectors"] as? [[String: Any]]
    XCTAssertEqual(collectors?.count, 1)
    XCTAssertEqual(collectors?.first?["key"] as? String, "username")
  }

  func testMapNodePayloadSuccessNodeIncludesSession() {
    let node = makeDaVinciSuccessNode(sessionValue: "tok-abc")

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "SuccessNode")
    let session = payload["session"] as? [String: Any]
    XCTAssertEqual(session?["value"] as? String, "tok-abc")
  }

  func testMapNodePayloadErrorNodeIncludesMessageAndStatus() {
    let node = ErrorNode(
      status: 400,
      input: ["code": "INVALID_REQUEST"],
      message: "Bad request",
      context: FlowContext(flowContext: SharedContext())
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "ErrorNode")
    XCTAssertEqual(payload["message"] as? String, "Bad request")
    XCTAssertEqual(payload["status"] as? Int, 400)
    XCTAssertNotNil(payload["input"])
  }

  func testMapNodePayloadErrorNodeIncludesInput() {
    let node = ErrorNode(
      status: nil,
      input: ["code": "AUTH_ERROR", "detail": "invalid token"],
      message: "Auth failed",
      context: FlowContext(flowContext: SharedContext())
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let input = payload["input"] as? NSDictionary

    XCTAssertNotNil(input)
    XCTAssertEqual(input?["code"] as? String, "AUTH_ERROR")
  }

  func testMapNodePayloadErrorNodeWithNilStatusOmitsStatus() {
    let node = ErrorNode(
      status: nil,
      input: [:],
      message: "Unknown",
      context: FlowContext(flowContext: SharedContext())
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "ErrorNode")
    XCTAssertNil(payload["status"])
  }

  func testMapNodePayloadContinueNodeIncludesInput() {
    let input: [String: Any] = ["form": ["name": "login"]]
    let node = makeContinueNode(collectors: [], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let bridgeInput = payload["input"] as? NSDictionary

    XCTAssertNotNil(bridgeInput)
  }

  func testMapNodePayloadFailureNodeIncludesMessageAndCause() {
    let node = FailureNode(cause: NSError(
      domain: "test",
      code: -1,
      userInfo: [NSLocalizedDescriptionKey: "network failure"]
    ))

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "FailureNode")
    XCTAssertEqual(payload["message"] as? String, "network failure")
    XCTAssertEqual(payload["cause"] as? String, "network failure")
  }

  func testMapNodePayloadFailureNodeWithApiErrorIncludesStatus() {
    let node = FailureNode(cause: ApiError.error(503, [:], "service unavailable"))

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(payload["type"] as? String, "FailureNode")
    XCTAssertEqual(payload["status"] as? Int, 503)
  }

  func testMapNodeReturnsBridgeDictionary() {
    let node = makeDaVinciSuccessNode(sessionValue: "tok-xyz")

    let result = DaVinciNodeMapper.mapNode(node)

    XCTAssertEqual(result["type"] as? String, "SuccessNode")
  }

  // MARK: - collector serialization — base fields

  func testMapTextCollectorIncludesValueAndKey() {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "username", value: "alice")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let collectors = payload["collectors"] as? [[String: Any]]
    let first = collectors?.first

    XCTAssertEqual(first?["key"] as? String, "username")
    XCTAssertEqual(first?["value"] as? String, "alice")
    XCTAssertEqual(first?["type"] as? String, "TEXT")
  }

  func testMapTextCollectorIncludesValidationRegex() {
    let node = makeContinueNode(collectors: [
      TextCollector(with: [
        "key": "email", "type": "TEXT", "label": "Email", "required": false,
        "validation": ["regex": "^.+@.+$", "errorMessage": "Invalid email"]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let validation = first?["validation"] as? [String: Any]

    XCTAssertNotNil(validation)
    XCTAssertNotNil(validation?["regex"])
  }

  func testMapPasswordCollectorEmitsEmptyValue() {
    let node = makeContinueNode(collectors: [
      makePasswordCollector(key: "password")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "password")
    XCTAssertEqual(first?["value"] as? String, "")
  }

  func testMapPasswordCollectorEmitsClearPasswordTrueByDefault() {
    let node = makeContinueNode(collectors: [makePasswordCollector(key: "password")])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["clearPassword"] as? Bool, true)
  }

  func testMapPasswordCollectorEmitsClearPasswordFalseWhenSet() {
    let collector = makePasswordCollector(key: "password")
    collector.clearPassword = false
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["clearPassword"] as? Bool, false)
  }

  func testMapPasswordCollectorIncludesPasswordPolicyFromFormField() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            [
              "key": "password", "type": "PASSWORD", "label": "Password", "required": false,
              "passwordPolicy": ["name": "strong", "length": ["min": 8, "max": 64]]
            ]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [makePasswordCollector(key: "password")], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let policy = first?["passwordPolicy"] as? NSDictionary

    XCTAssertNotNil(policy)
    XCTAssertEqual(policy?["name"] as? String, "strong")
  }

  func testMapPasswordCollectorOmitsPasswordPolicyWhenAbsentFromFormField() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "password", "type": "PASSWORD", "label": "Password", "required": false]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [makePasswordCollector(key: "password")], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["passwordPolicy"])
  }

  func testMapPasswordCollectorOmitsPasswordPolicyOnDecodeError() {
    // "length" must be a keyed container but receives a String, so JSONDecoder throws
    // DecodingError.typeMismatch — the catch block returns nil and policy is omitted.
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            [
              "key": "password", "type": "PASSWORD", "label": "Password", "required": false,
              "passwordPolicy": ["length": "not-a-dict"]
            ]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [makePasswordCollector(key: "password")], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["passwordPolicy"])
  }

  func testMapSubmitCollectorIncludesBaseFields() {
    let node = makeContinueNode(collectors: [
      SubmitCollector(with: ["key": "submit", "type": "SUBMIT_BUTTON", "label": "Submit", "required": false])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "submit")
    XCTAssertEqual(first?["type"] as? String, "SUBMIT_BUTTON")
  }

  func testMapFlowCollectorIncludesBaseFields() {
    let node = makeContinueNode(collectors: [
      FlowCollector(with: ["key": "register", "type": "FLOW_BUTTON", "label": "Register", "required": false])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "register")
    XCTAssertEqual(first?["type"] as? String, "FLOW_BUTTON")
  }

  func testMapLabelCollectorIncludesContent() {
    let node = makeContinueNode(collectors: [
      LabelCollector(with: ["key": "title", "content": "Sign In"])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["type"] as? String, "LABEL")
    XCTAssertEqual(first?["content"] as? String, "Sign In")
  }

  func testMapSingleSelectCollectorIncludesOptionsAndValue() {
    let node = makeContinueNode(collectors: [
      SingleSelectCollector(with: [
        "key": "country", "type": "DROPDOWN", "label": "Country", "required": false,
        "value": "US",
        "options": [
          ["label": "United States", "value": "US"],
          ["label": "Canada", "value": "CA"]
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let options = first?["options"] as? [[String: Any]]

    XCTAssertEqual(first?["value"] as? String, "US")
    XCTAssertEqual(options?.count, 2)
    XCTAssertEqual(options?.first?["value"] as? String, "US")
  }

  func testMapMultiSelectCollectorIncludesOptionsAndValue() {
    let collector = MultiSelectCollector(with: [
      "key": "tags", "type": "CHECKBOX", "label": "Tags", "required": false,
      "options": [
        ["label": "Swift", "value": "swift"],
        ["label": "iOS", "value": "ios"]
      ]
    ])
    collector.value = ["swift"]
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["value"] as? [String], ["swift"])
    XCTAssertNotNil(first?["options"])
  }

  func testMapPhoneNumberCollectorIncludesCountryCodeAndPhoneNumber() {
    let collector = PhoneNumberCollector(with: [
      "key": "phone", "type": "PHONE", "label": "Phone", "required": false,
      "defaultCountryCode": "+1", "validatePhoneNumber": true
    ])
    collector.countryCode = "+44"
    collector.phoneNumber = "07000000000"
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["defaultCountryCode"] as? String, "+1")
    XCTAssertEqual(first?["countryCode"] as? String, "+44")
    XCTAssertEqual(first?["phoneNumber"] as? String, "07000000000")
    XCTAssertEqual(first?["validatePhoneNumber"] as? Bool, true)
  }

  func testMapDeviceRegistrationCollectorIncludesDevices() {
    let node = makeContinueNode(collectors: [
      DeviceRegistrationCollector(with: [
        "key": "device", "type": "DEVICE_REGISTRATION", "label": "Device", "required": false,
        "options": [
          ["type": "TOTP", "title": "Authenticator App", "iconSrc": "https://example.com/icon.png", "default": false]
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let devices = first?["devices"] as? [[String: Any]]

    XCTAssertEqual(devices?.count, 1)
    XCTAssertEqual(devices?.first?["type"] as? String, "TOTP")
  }

  func testMapDeviceAuthenticationCollectorIncludesDevices() {
    let node = makeContinueNode(collectors: [
      DeviceAuthenticationCollector(with: [
        "key": "auth", "type": "DEVICE_AUTHENTICATION", "label": "Auth Device", "required": false,
        "options": [
          ["type": "PUSH", "title": "Push Notification", "iconSrc": "https://example.com/icon.png", "default": true]
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let devices = first?["devices"] as? [[String: Any]]

    XCTAssertEqual(devices?.count, 1)
    XCTAssertEqual(devices?.first?["type"] as? String, "PUSH")
  }

  // MARK: - unsupportedFields parity

  func testMapNodePayloadSurfacesUnsupportedFields() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "username", "type": "TEXT", "inputType": "TEXT"],
            ["key": "tos", "type": "AGREEMENT", "inputType": "READ_ONLY_TEXT"],
            ["key": "marketing", "type": "SINGLE_CHECKBOX", "inputType": "BOOLEAN"]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(
      collectors: [makeTextCollector(key: "username")],
      input: input
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let unsupported = payload["unsupportedFields"] as? [[String: Any]]

    XCTAssertEqual(unsupported?.count, 2)
    XCTAssertEqual(unsupported?[0]["key"] as? String, "tos")
    XCTAssertEqual(unsupported?[0]["type"] as? String, "READ_ONLY_TEXT")
    XCTAssertEqual(unsupported?[1]["key"] as? String, "marketing")
    XCTAssertEqual(unsupported?[1]["type"] as? String, "BOOLEAN")
  }

  func testMapNodePayloadFallsBackToTypeWhenInputTypeMissing() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "unknown", "type": "EXOTIC"]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let unsupported = payload["unsupportedFields"] as? [[String: Any]]

    XCTAssertEqual(unsupported?.first?["type"] as? String, "EXOTIC")
  }

  func testMapNodePayloadOmitsUnsupportedFieldsWhenAllRegistered() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "username", "type": "TEXT", "inputType": "TEXT"]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(
      collectors: [makeTextCollector(key: "username")],
      input: input
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertNil(payload["unsupportedFields"])
  }

  func testMapNodePayloadOmitsUnsupportedFieldsWhenFormMissing() {
    let node = makeContinueNode(collectors: [], input: [:])

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertNil(payload["unsupportedFields"])
  }

  func testMapNodePayloadSuccessNodeDoesNotEmitUnsupportedFields() {
    let node = makeDaVinciSuccessNode(sessionValue: "tok")

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertNil(payload["unsupportedFields"])
  }

  // MARK: - raw field passthrough

  func testCollectorIncludesRawFieldWhenFormInputPresent() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "username", "type": "TEXT", "label": "Username", "required": false, "value": ""]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [makeTextCollector(key: "username")], input: input)

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let raw = first?["raw"] as? NSDictionary

    XCTAssertNotNil(raw)
    XCTAssertEqual(raw?["key"] as? String, "username")
  }

  func testCollectorOmitsRawWhenNoMatchingFormField() {
    let node = makeContinueNode(
      collectors: [makeTextCollector(key: "username")],
      input: [:]
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["raw"])
  }

  func testMultipleCollectorTypesEachIncludeRaw() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "username", "type": "TEXT", "label": "Username", "required": false],
            ["key": "password", "type": "PASSWORD", "label": "Password", "required": true],
            ["key": "submit", "type": "SUBMIT_BUTTON", "label": "Submit", "required": false]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(
      collectors: [
        makeTextCollector(key: "username"),
        makePasswordCollector(key: "password"),
        SubmitCollector(with: ["key": "submit", "type": "SUBMIT_BUTTON", "label": "Submit", "required": false])
      ],
      input: input
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let collectors = payload["collectors"] as? [[String: Any]]

    XCTAssertEqual(collectors?.count, 3)
    XCTAssertNotNil(collectors?[0]["raw"])
    XCTAssertNotNil(collectors?[1]["raw"])
    XCTAssertNotNil(collectors?[2]["raw"])
  }

  // MARK: - multiple collector types

  func testMapContinueNodeWithMultipleCollectorTypes() {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "username"),
      makePasswordCollector(key: "password"),
      SubmitCollector(with: ["key": "submit", "type": "SUBMIT_BUTTON", "label": "Sign In", "required": false])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let collectors = payload["collectors"] as? [[String: Any]]

    XCTAssertEqual(collectors?.count, 3)
  }

  // MARK: - Helpers

  private func makeContinueNode(
    collectors: [any Collector],
    input: [String: Any] = [:]
  ) -> ContinueNode {
    return TestContinueNode(
      context: FlowContext(flowContext: SharedContext()),
      workflow: Workflow(config: WorkflowConfig()),
      input: input,
      actions: collectors
    )
  }

  private func makeTextCollector(key: String, value: String = "") -> TextCollector {
    return TextCollector(with: ["key": key, "type": "TEXT", "label": key, "required": false, "value": value])
  }

  private func makePasswordCollector(key: String) -> PasswordCollector {
    return PasswordCollector(with: ["key": key, "type": "PASSWORD", "label": key, "required": false])
  }

  private func makeDaVinciSuccessNode(sessionValue: String) -> SuccessNode {
    return SuccessNode(input: [:], session: StubSession(value: sessionValue))
  }
}

private final class TestContinueNode: ContinueNode {
  override func asRequest() -> Request {
    return workflow.config.httpClient.request()
  }
}

private struct StubSession: Session {
  var value: String
}
