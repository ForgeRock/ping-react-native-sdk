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
import PingExternalIdP
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

  func testMapPasswordCollectorUsesNativePasswordPolicyAccessor() {
    // `passwordPolicy()` resolves the field-level policy first — the same JSON the
    // collector itself was constructed from — rather than a raw-JSON traversal of
    // node.input.form.components.fields[].
    let collector = PasswordCollector(with: [
      "key": "password", "type": "PASSWORD", "label": "Password", "required": false,
      "passwordPolicy": ["name": "strong", "length": ["min": 8, "max": 64]]
    ])
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let policy = first?["passwordPolicy"] as? NSDictionary

    XCTAssertNotNil(policy)
    XCTAssertEqual(policy?["name"] as? String, "strong")
  }

  func testMapPasswordCollectorFallsBackToNodeRootPasswordPolicy() {
    // When no field-level policy is present, `passwordPolicy()` falls back to
    // `continueNode.input["passwordPolicy"]` (node-root scope).
    let collector = PasswordCollector(with: [
      "key": "password", "type": "PASSWORD", "label": "Password", "required": false
    ])
    let node = makeContinueNode(
      collectors: [collector],
      input: ["passwordPolicy": ["name": "Global Policy", "maxAgeDays": 30]]
    )
    collector.continueNode = node

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let policy = first?["passwordPolicy"] as? NSDictionary

    XCTAssertNotNil(policy)
    XCTAssertEqual(policy?["name"] as? String, "Global Policy")
    XCTAssertEqual(policy?["maxAgeDays"] as? Int, 30)
  }

  func testMapPasswordCollectorOmitsPasswordPolicyWhenAbsent() {
    let node = makeContinueNode(collectors: [makePasswordCollector(key: "password")])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["passwordPolicy"])
  }

  func testMapPasswordCollectorIncludesValidationRegexWhenPresent() {
    let node = makeContinueNode(collectors: [
      PasswordCollector(with: [
        "key": "password", "type": "PASSWORD", "label": "Password", "required": false,
        "validation": ["regex": "^.{8,}$", "errorMessage": "Password is too short"]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let validation = first?["validation"] as? [String: Any]

    XCTAssertNotNil(validation)
    XCTAssertNotNil(validation?["regex"])
  }

  // MARK: - Validation error encoding

  func testMapValidationErrorsIncludesRequiredAndRegex() {
    let required = DaVinciNodeMapper.encodeValidationError(.required)
    XCTAssertEqual(required["code"] as? String, "REQUIRED")

    let regex = DaVinciNodeMapper.encodeValidationError(.regexError(message: "Invalid value"))
    XCTAssertEqual(regex["code"] as? String, "REGEX_ERROR")
    XCTAssertEqual(regex["message"] as? String, "Invalid value")
  }

  func testMapPasswordValidationErrorsIncludesPolicyConstraints() {
    let errors = DaVinciNodeMapper.encodeValidationErrors([
      .invalidLength(min: 8, max: 64),
      .uniqueCharacter(min: 3),
      .maxRepeat(max: 2),
      .minCharacters(character: "digit", min: 1)
    ])

    XCTAssertEqual(errors.count, 4)
    XCTAssertEqual(errors[0]["code"] as? String, "INVALID_LENGTH")
    XCTAssertEqual(errors[0]["min"] as? Int, 8)
    XCTAssertEqual(errors[0]["max"] as? Int, 64)
    XCTAssertEqual(errors[1]["code"] as? String, "UNIQUE_CHARACTER")
    XCTAssertEqual(errors[1]["min"] as? Int, 3)
    XCTAssertEqual(errors[2]["code"] as? String, "MAX_REPEAT")
    XCTAssertEqual(errors[2]["max"] as? Int, 2)
    XCTAssertEqual(errors[3]["code"] as? String, "MIN_CHARACTERS")
    XCTAssertEqual(errors[3]["character"] as? String, "digit")
    XCTAssertEqual(errors[3]["min"] as? Int, 1)
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

  func testMapLabelCollectorIncludesRichContentWhenPresent() {
    let node = makeContinueNode(collectors: [
      LabelCollector(with: [
        "key": "terms",
        "content": "Read the terms",
        "richContent": [
          "content": "Read the {{terms}}",
          "replacements": [
            "terms": [
              "value": "terms",
              "href": "https://example.com/terms",
              "type": "link",
              "target": "_blank"
            ]
          ]
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let rc = first?["richContent"] as? [String: Any]

    XCTAssertNotNil(rc)
    XCTAssertEqual(rc?["content"] as? String, "Read the {{terms}}")
    let replacements = rc?["replacements"] as? [String: Any]
    let termsReplacement = replacements?["terms"] as? [String: Any]
    XCTAssertEqual(termsReplacement?["href"] as? String, "https://example.com/terms")
    XCTAssertEqual(termsReplacement?["target"] as? String, "_blank")
  }

  func testMapLabelCollectorOmitsRichContentWhenAbsent() {
    let node = makeContinueNode(collectors: [
      LabelCollector(with: ["key": "title", "content": "Sign In"])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["richContent"])
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

  func testMapPhoneNumberCollectorIncludesExtensionFields() {
    let collector = PhoneNumberCollector(with: [
      "key": "phone", "type": "PHONE", "label": "Phone", "required": false,
      "defaultCountryCode": "+1", "validatePhoneNumber": true,
      "showExtension": true, "extensionLabel": "Extension"
    ])
    collector.extension = "99"
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["extension"] as? String, "99")
    XCTAssertEqual(first?["showExtension"] as? Bool, true)
    XCTAssertEqual(first?["extensionLabel"] as? String, "Extension")
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
    // BOOLEAN and READ_ONLY_TEXT are registered in 2.1.0 and produce collectors, so they
    // no longer appear in unsupportedFields. Use a genuinely unregistered inputType here.
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "username", "type": "TEXT", "inputType": "TEXT"],
            ["key": "exotic", "type": "EXOTIC_FUTURE_TYPE", "inputType": "EXOTIC_FUTURE_TYPE"]
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

    XCTAssertEqual(unsupported?.count, 1)
    XCTAssertEqual(unsupported?[0]["key"] as? String, "exotic")
    XCTAssertEqual(unsupported?[0]["type"] as? String, "EXOTIC_FUTURE_TYPE")
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

  // MARK: - IdpCollector serialization

  func testMapIdpCollectorEmitsTypeIDP() {
    let node = makeContinueNode(collectors: [
      makeIdpCollector(idpId: "google-idp-1", idpType: "GOOGLE", label: "Sign in with Google")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["type"] as? String, DaVinciNodeMapper.socialLoginButton)
  }

  func testMapIdpCollectorEmitsIdpId() {
    let node = makeContinueNode(collectors: [
      makeIdpCollector(idpId: "google-idp-1", idpType: "GOOGLE", label: "Sign in with Google")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["idpId"] as? String, "google-idp-1")
    XCTAssertEqual(first?["idpType"] as? String, "GOOGLE")
    XCTAssertEqual(first?["label"] as? String, "Sign in with Google")
    XCTAssertEqual(first?["idpEnabled"] as? Bool, true)
  }

  func testMapIdpCollectorUsesIdpIdAsKeyNotUUID() {
    let node = makeContinueNode(collectors: [
      makeIdpCollector(idpId: "facebook-idp-42", idpType: "FACEBOOK", label: "Sign in with Facebook")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    // key must equal idpId, NOT the UUID returned by IdpCollector.id
    XCTAssertEqual(first?["key"] as? String, "facebook-idp-42")
  }

  func testMapIdpCollectorEmitsLinkWhenPresent() {
    let href = "https://auth.pingone.com/connections/idp-1/loginFirstFactor?interactionId=abc"
    let node = makeContinueNode(collectors: [
      makeIdpCollector(idpId: "apple-idp-99", idpType: "APPLE", label: "Sign in with Apple", href: href)
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["link"] as? String, href)
  }

  func testMapIdpCollectorOmitsLinkWhenAbsent() {
    let node = makeContinueNode(collectors: [
      makeIdpCollector(idpId: "google-idp-1", idpType: "GOOGLE", label: "Google", href: nil)
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["link"])
  }

  // MARK: - PROTECT field unsupported surfacing
  // Note: ProtectCollector live-instance tests are not included here because PingOneProtect
  // is intentionally not a compile-time dependency of rn-davinci. The bridge detects PROTECT
  // collectors via the server's form-field JSON (field type == "PROTECT"), not by class name.
  // When rn-protect is absent (no ProtectCollector registered), a PROTECT field is surfaced
  // via unsupportedFields so JS consumers can observe it.

  func testProtectFormFieldAppearsInUnsupportedFieldsWhenCollectorAbsent() {
    // A PROTECT form field with no registered collector must appear in unsupportedFields
    // so JS can observe that the server sent a PROTECT collector but rn-protect is absent.
    let formInput: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "protect-1", "type": "PROTECT"]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(collectors: [], input: formInput)

    let payload = DaVinciNodeMapper.mapNodePayload(node)

    let unsupported = payload["unsupportedFields"] as? [[String: Any]]
    XCTAssertEqual(unsupported?.count, 1)
    XCTAssertEqual(unsupported?.first?["key"] as? String, "protect-1")
    XCTAssertEqual(unsupported?.first?["type"] as? String, "PROTECT")
  }

  // MARK: - BooleanCollector serialization

  func testMapBooleanCollectorIncludesAllBaseAndBooleanFields() {
    let node = makeContinueNode(collectors: [
      BooleanCollector(with: [
        "key": "accept-terms",
        "type": "SINGLE_CHECKBOX",
        "label": "I accept the terms",
        "required": true,
        "appearance": "CHECKBOX",
        "errorMessage": "You must accept the terms to continue."
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "accept-terms")
    XCTAssertEqual(first?["type"] as? String, "SINGLE_CHECKBOX")
    XCTAssertEqual(first?["label"] as? String, "I accept the terms")
    XCTAssertEqual(first?["required"] as? Bool, true)
    XCTAssertEqual(first?["value"] as? Bool, false)
    XCTAssertEqual(first?["appearance"] as? String, "CHECKBOX")
    XCTAssertEqual(first?["errorMessage"] as? String, "You must accept the terms to continue.")
    XCTAssertNil(first?["richContent"])
  }

  func testMapBooleanCollectorErrorMessageFallsBackToEmptyStringWhenAbsent() {
    let node = makeContinueNode(collectors: [
      BooleanCollector(with: [
        "key": "toggle", "type": "SINGLE_CHECKBOX", "label": "Toggle", "required": false
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["errorMessage"] as? String, "")
  }

  func testMapBooleanCollectorIncludesRichContentWhenPresent() {
    let node = makeContinueNode(collectors: [
      BooleanCollector(with: [
        "key": "consent",
        "type": "SINGLE_CHECKBOX",
        "label": "Consent",
        "required": false,
        "appearance": "SWITCH",
        "richContent": [
          "content": "Please read the {{link}} before continuing.",
          "replacements": [
            "link": [
              "value": "Terms of Service",
              "href": "https://example.com/tos",
              "type": "link",
              "target": "_blank"
            ]
          ]
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first
    let rc = first?["richContent"] as? [String: Any]

    XCTAssertNotNil(rc)
    XCTAssertEqual(rc?["content"] as? String, "Please read the {{link}} before continuing.")
    let replacements = rc?["replacements"] as? [String: Any]
    let linkReplacement = replacements?["link"] as? [String: Any]
    XCTAssertNotNil(linkReplacement)
    XCTAssertEqual(linkReplacement?["value"] as? String, "Terms of Service")
    XCTAssertEqual(linkReplacement?["href"] as? String, "https://example.com/tos")
    XCTAssertEqual(linkReplacement?["type"] as? String, "link")
    XCTAssertEqual(linkReplacement?["target"] as? String, "_blank")
  }

  func testMapBooleanCollectorOmitsRichContentWhenAbsent() {
    let node = makeContinueNode(collectors: [
      BooleanCollector(with: [
        "key": "toggle", "type": "SINGLE_CHECKBOX", "label": "Toggle", "required": false
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNil(first?["richContent"])
  }

  // MARK: - PollingCollector serialization

  func testMapPollingCollectorIncludesPollFields() {
    let node = makeContinueNode(collectors: [
      makePollingCollector(key: "polling-field", pollInterval: 2000, pollRetries: 60)
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "polling-field")
    XCTAssertEqual(first?["pollInterval"] as? Int, 2000)
    XCTAssertEqual(first?["pollRetries"] as? Int, 60)
    XCTAssertEqual(first?["pollChallengeStatus"] as? Bool, false)
    XCTAssertEqual(first?["challenge"] as? String, "")
  }

  func testMapPollingCollectorIncludesChallengeFieldsForChallengeStatusMode() {
    let node = makeContinueNode(collectors: [
      makePollingCollector(
        key: "polling-field",
        pollInterval: 1000,
        pollRetries: 30,
        pollChallengeStatus: true,
        challenge: "abc-challenge-id"
      )
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["pollChallengeStatus"] as? Bool, true)
    XCTAssertEqual(first?["challenge"] as? String, "abc-challenge-id")
  }

  func testMapPollingCollectorIncludesRawFieldWhenFormInputPresent() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "polling-field", "type": "POLLING"]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(
      collectors: [makePollingCollector(key: "polling-field", pollInterval: 2000, pollRetries: 60)],
      input: input
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNotNil(first?["raw"])
  }

  // MARK: - QRCodeCollector serialization

  func testMapQRCodeCollectorEmitsContentAndFallbackText() {
    let node = makeContinueNode(collectors: [
      makeQRCodeCollector(
        key: "qr-field",
        content: "data:image/png;base64,iVBORw0KGgo=",
        fallbackText: "Scan this code with your device"
      )
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["type"] as? String, "QR_CODE")
    XCTAssertEqual(first?["content"] as? String, "data:image/png;base64,iVBORw0KGgo=")
    XCTAssertEqual(first?["fallbackText"] as? String, "Scan this code with your device")
  }

  func testMapQRCodeCollectorUsesStableKeyFromServerField() {
    // Unlike Android 2.1.0 (whose native `id()` returns a random UUID per call), iOS's
    // native `QRCodeCollector.key` is parsed from the server JSON and is stable.
    let node = makeContinueNode(collectors: [
      makeQRCodeCollector(key: "qr-field", content: "data:image/png;base64,iVBORw0KGgo=", fallbackText: "Scan")
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "qr-field")
  }

  func testMapQRCodeCollectorReconstructsContentFromImageDataWhenRawFieldAbsent() {
    let imageBytes = Data([0x01, 0x02, 0x03])
    let base64 = imageBytes.base64EncodedString()
    let node = makeContinueNode(collectors: [
      makeQRCodeCollector(
        key: "qr-field",
        content: "data:image/png;base64,\(base64)",
        fallbackText: "Scan"
      )
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["content"] as? String, "data:image/png;base64,\(base64)")
  }

  func testMapQRCodeCollectorDefaultsToEmptyStringWhenContentAndImageDataAbsent() {
    // Omit "content" entirely (rather than passing an empty string) so
    // QRCodeCollector.imageData stays nil — Data(base64Encoded: "") would otherwise
    // decode to a non-nil empty Data, masking the mapper's final `?? ""` fallback.
    let collector = QRCodeCollector(with: ["key": "qr-field", "fallbackText": "Scan"])
    let node = makeContinueNode(collectors: [collector])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["content"] as? String, "")
  }

  func testMapQRCodeCollectorIncludesRawFieldWhenFormInputPresent() {
    let input: [String: Any] = [
      "form": [
        "components": [
          "fields": [
            ["key": "qr-field", "type": "QR_CODE", "content": "data:image/png;base64,iVBORw0KGgo="]
          ]
        ]
      ]
    ]
    let node = makeContinueNode(
      collectors: [makeQRCodeCollector(key: "qr-field", content: "data:image/png;base64,iVBORw0KGgo=", fallbackText: "Scan")],
      input: input
    )

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertNotNil(first?["raw"])
  }

  // MARK: - ReadOnlyTextCollector serialization

  func testMapReadOnlyTextCollectorIncludesAllFields() {
    let node = makeContinueNode(collectors: [
      ReadOnlyTextCollector(with: [
        "key": "agreement",
        "type": "AGREEMENT",
        "content": "This is example agreement text.",
        "title": "Terms of Service Agreement",
        "titleEnabled": true,
        "enabled": true,
        "agreement": [
          "id": "6ff30c9e-cd98-4fe5-85ca-01111ca20702",
          "useDynamicAgreement": false
        ]
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["key"] as? String, "agreement")
    // Bridge normalizes type to READ_ONLY_TEXT regardless of server type ("AGREEMENT")
    XCTAssertEqual(first?["type"] as? String, "READ_ONLY_TEXT")
    XCTAssertEqual(first?["content"] as? String, "This is example agreement text.")
    XCTAssertEqual(first?["title"] as? String, "Terms of Service Agreement")
    XCTAssertEqual(first?["titleEnabled"] as? Bool, true)
    XCTAssertEqual(first?["enabled"] as? Bool, true)
    XCTAssertEqual(first?["agreementId"] as? String, "6ff30c9e-cd98-4fe5-85ca-01111ca20702")
    XCTAssertEqual(first?["useDynamicAgreement"] as? Bool, false)
  }

  func testMapReadOnlyTextCollectorNormalizesTypeToReadOnlyText() {
    // The server `type` field varies (e.g. "AGREEMENT") — the bridge must emit "READ_ONLY_TEXT"
    let node = makeContinueNode(collectors: [
      ReadOnlyTextCollector(with: [
        "key": "tos", "type": "AGREEMENT", "content": "TOS text", "title": "", "titleEnabled": false, "enabled": true
      ])
    ])

    let payload = DaVinciNodeMapper.mapNodePayload(node)
    let first = (payload["collectors"] as? [[String: Any]])?.first

    XCTAssertEqual(first?["type"] as? String, "READ_ONLY_TEXT")
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

  private func makePollingCollector(
    key: String,
    pollInterval: Int,
    pollRetries: Int,
    pollChallengeStatus: Bool = false,
    challenge: String = ""
  ) -> PollingCollector {
    return PollingCollector(with: [
      "key": key,
      "type": "POLLING",
      "label": key,
      "required": false,
      "pollInterval": pollInterval,
      "pollRetries": pollRetries,
      "pollChallengeStatus": pollChallengeStatus,
      "challenge": challenge
    ])
  }

  private func makeQRCodeCollector(key: String, content: String, fallbackText: String) -> QRCodeCollector {
    return QRCodeCollector(with: [
      "key": key,
      "content": content,
      "fallbackText": fallbackText
    ])
  }

  private func makeDaVinciSuccessNode(sessionValue: String) -> SuccessNode {
    return SuccessNode(input: [:], session: StubSession(value: sessionValue))
  }

  private func makeIdpCollector(
    idpId: String,
    idpType: String,
    label: String,
    href: String? = nil
  ) -> IdpCollector {
    var json: [String: Any] = [
      "idpId": idpId,
      "idpType": idpType,
      "label": label,
      "idpEnabled": true
    ]
    if let href = href {
      json["links"] = ["authenticate": ["href": href]]
    }
    return IdpCollector(with: json)
  }

  // MARK: - resolvedFormFieldType

  func testResolvedFormFieldTypeReturnsInputTypeWhenPresent() {
    let input: [String: Any] = [
      "form": ["components": ["fields": [
        ["key": "protect-field", "inputType": "PROTECT", "type": "OTHER"]
      ]]]
    ]
    let collector = makeTextCollector(key: "protect-field")
    let node = makeContinueNode(collectors: [collector], input: input)

    XCTAssertEqual(DaVinciNodeMapper.resolvedFormFieldType(for: collector, node: node, logger: nil), "PROTECT")
  }

  func testResolvedFormFieldTypeFallsBackToTypeWhenInputTypeMissing() {
    let input: [String: Any] = [
      "form": ["components": ["fields": [
        ["key": "protect-field", "type": "PROTECT"]
      ]]]
    ]
    let collector = makeTextCollector(key: "protect-field")
    let node = makeContinueNode(collectors: [collector], input: input)

    XCTAssertEqual(DaVinciNodeMapper.resolvedFormFieldType(for: collector, node: node, logger: nil), "PROTECT")
  }

  func testResolvedFormFieldTypeReturnsNilWhenFieldMissing() {
    let collector = makeTextCollector(key: "no-field")
    let node = makeContinueNode(collectors: [collector], input: [:])

    XCTAssertNil(DaVinciNodeMapper.resolvedFormFieldType(for: collector, node: node, logger: nil))
  }

  func testResolvedFormFieldTypeReturnsNilWhenNoFormPresent() {
    let collector = makeTextCollector(key: "protect-field")
    let node = makeContinueNode(collectors: [collector], input: [:])

    XCTAssertNil(DaVinciNodeMapper.resolvedFormFieldType(for: collector, node: node, logger: nil))
  }

  // MARK: - Connector fields

  func testMapContinueNodeConnectorFieldsAlwaysPresent() {
    // TestContinueNode is not a Connector subtype — extension properties return "" safely.
    let node = makeContinueNode(collectors: [])

    let result = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertNotNil(result["id"])
    XCTAssertNotNil(result["name"])
    XCTAssertNotNil(result["description"])
    XCTAssertNotNil(result["category"])
  }

  func testMapContinueNodeConnectorFieldsDefaultToEmptyStringForNonConnectorSubtype() {
    let node = makeContinueNode(collectors: [])

    let result = DaVinciNodeMapper.mapNodePayload(node)

    XCTAssertEqual(result["id"] as? String, "")
    XCTAssertEqual(result["name"] as? String, "")
    XCTAssertEqual(result["description"] as? String, "")
    XCTAssertEqual(result["category"] as? String, "")
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
