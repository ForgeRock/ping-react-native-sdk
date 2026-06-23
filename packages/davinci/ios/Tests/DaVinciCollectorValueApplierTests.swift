//
//  DaVinciCollectorValueApplierTests.swift
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

final class DaVinciCollectorValueApplierTests: XCTestCase {

  // MARK: - parseInput

  func testParseInputReturnsEmptyForMissingCollectorsKey() throws {
    let input: NSDictionary = [:]
    let mutations = try DaVinciCollectorValueApplier.parseInput(input)
    XCTAssertTrue(mutations.isEmpty)
  }

  func testParseInputParsesKeyAndValue() throws {
    let input: NSDictionary = [
      "collectors": [
        ["key": "username", "value": "alice"]
      ]
    ]
    let mutations = try DaVinciCollectorValueApplier.parseInput(input)
    XCTAssertEqual(mutations.count, 1)
    XCTAssertEqual(mutations[0].key, "username")
    XCTAssertEqual(mutations[0].value as? String, "alice")
  }

  func testParseInputHandlesNullValueAsNil() throws {
    let input: NSDictionary = [
      "collectors": [
        ["key": "field", "value": NSNull()]
      ]
    ]
    let mutations = try DaVinciCollectorValueApplier.parseInput(input)
    XCTAssertEqual(mutations.count, 1)
    XCTAssertNil(mutations[0].value)
  }

  func testParseInputThrowsForNonDictionaryEntry() {
    let input: NSDictionary = [
      "collectors": ["invalid-item"]
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.parseInput(input)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("Invalid collector entry at index 0"))
    }
  }

  func testParseInputThrowsForMissingKey() {
    let input: NSDictionary = [
      "collectors": [
        ["value": "hello"]
      ]
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.parseInput(input)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("Missing 'key'"))
    }
  }

  func testParseInputThrowsForEmptyKey() {
    let input: NSDictionary = [
      "collectors": [
        ["key": "", "value": "v"]
      ]
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.parseInput(input)) { error in
      guard case DaVinciBridgeError.argument = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
    }
  }

  func testParseInputParsesMultipleEntries() throws {
    let input: NSDictionary = [
      "collectors": [
        ["key": "a", "value": "1"],
        ["key": "b", "value": "2"]
      ]
    ]
    let mutations = try DaVinciCollectorValueApplier.parseInput(input)
    XCTAssertEqual(mutations.count, 2)
    XCTAssertEqual(mutations[0].key, "a")
    XCTAssertEqual(mutations[1].key, "b")
  }

  // MARK: - apply — SingleValueCollector (TextCollector)

  func testApplyMutatesTextCollector() throws {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "username", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "username", value: "alice")]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)

    let collector = node.collectors.first as? TextCollector
    XCTAssertEqual(collector?.value, "alice")
  }

  func testApplyCoercesNumberToString() throws {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "otp", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "otp", value: NSNumber(value: 42))]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)

    let collector = node.collectors.first as? TextCollector
    XCTAssertEqual(collector?.value, "42")
  }

  func testApplyCoercesBoolToString() throws {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "flag", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "flag", value: true)]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)

    let collector = node.collectors.first as? TextCollector
    XCTAssertEqual(collector?.value, "true")
  }

  func testApplyThrowsForIncompatibleValueType() {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "field", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "field", value: ["nested": "dict"])]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations))
  }

  func testApplyThrowsForUnknownCollectorKey() {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "known", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "unknown", value: "v")]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("No active collector found for key='unknown'"))
    }
  }

  // MARK: - apply — MultiSelectCollector

  func testApplyMutatesMultiSelectCollector() throws {
    let collector = makeMultiSelectCollector(key: "countries")
    let node = makeContinueNode(collectors: [collector])
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "countries", value: ["US", "CA"])
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.value, ["US", "CA"])
  }

  func testApplyThrowsForNonArrayOnMultiSelect() {
    let collector = makeMultiSelectCollector(key: "tags")
    let node = makeContinueNode(collectors: [collector])
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "tags", value: "not-an-array")
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations))
  }

  // MARK: - apply — PhoneNumberCollector

  func testApplyMutatesPhoneNumberCollectorFromDictionary() throws {
    let collector = makePhoneNumberCollector(key: "phone")
    let node = makeContinueNode(collectors: [collector])
    let value: NSDictionary = ["countryCode": "+1", "phoneNumber": "5551234"]
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "phone", value: value)
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.countryCode, "+1")
    XCTAssertEqual(collector.phoneNumber, "5551234")
  }

  func testApplySkipsPhoneFieldsForNonDictionary() throws {
    let collector = makePhoneNumberCollector(key: "phone")
    collector.countryCode = "+44"
    collector.phoneNumber = "0700000"
    let node = makeContinueNode(collectors: [collector])
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "phone", value: "not-a-dict")
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.countryCode, "+44")
    XCTAssertEqual(collector.phoneNumber, "0700000")
  }

  // MARK: - apply — DeviceRegistrationCollector

  func testApplyMutatesDeviceRegistrationCollector() throws {
    let device = makeDevice(type: "TOTP")
    let collector = makeDeviceRegistrationCollector(key: "device", devices: [device])
    let node = makeContinueNode(collectors: [collector])
    let value: NSDictionary = ["type": "TOTP"]
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "device", value: value)
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.value?.type, "TOTP")
  }

  func testApplyThrowsForDeviceRegistrationMissingType() {
    let collector = makeDeviceRegistrationCollector(key: "device", devices: [])
    let node = makeContinueNode(collectors: [collector])
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "device", value: NSDictionary())
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("value map must include 'type'"))
    }
  }

  func testApplyThrowsForDeviceRegistrationUnknownType() {
    let collector = makeDeviceRegistrationCollector(key: "device", devices: [makeDevice(type: "TOTP")])
    let node = makeContinueNode(collectors: [collector])
    let value: NSDictionary = ["type": "FIDO"]
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "device", value: value)
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("no device found with type='FIDO'"))
    }
  }

  // MARK: - apply — DeviceAuthenticationCollector

  func testApplyMutatesDeviceAuthenticationCollectorFromKnownDevice() throws {
    let device = makeDevice(type: "PUSH")
    let collector = makeDeviceAuthenticationCollector(key: "auth", devices: [device])
    let node = makeContinueNode(collectors: [collector])
    let value: NSDictionary = ["type": "PUSH"]
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "auth", value: value)
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.value?.type, "PUSH")
  }

  func testApplyMutatesDeviceAuthenticationCollectorWithFallbackDevice() throws {
    let collector = makeDeviceAuthenticationCollector(key: "auth", devices: [])
    let node = makeContinueNode(collectors: [collector])
    let value: NSDictionary = ["type": "TOTP", "title": "My Token"]
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "auth", value: value)
    ]
    _ = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertEqual(collector.value?.type, "TOTP")
    XCTAssertEqual(collector.value?.title, "My Token")
  }

  func testApplyThrowsForDeviceAuthenticationMissingType() {
    let collector = makeDeviceAuthenticationCollector(key: "auth", devices: [])
    let node = makeContinueNode(collectors: [collector])
    let mutations = [
      DaVinciCollectorValueApplier.CollectorMutation(key: "auth", value: NSDictionary())
    ]
    XCTAssertThrowsError(try DaVinciCollectorValueApplier.apply(node, mutations: mutations)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("value map must include 'type'"))
    }
  }

  // MARK: - apply — FlowCollector trigger detection

  func testApplyReturnsFlowTriggerTrueForFlowCollector() throws {
    let node = makeContinueNode(collectors: [
      makeFlowCollector(key: "next")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "next", value: "NEXT")]
    let result = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertTrue(result.isFlowTrigger)
  }

  func testApplyReturnsFlowTriggerFalseForTextCollector() throws {
    let node = makeContinueNode(collectors: [
      makeTextCollector(key: "username", value: "")
    ])
    let mutations = [DaVinciCollectorValueApplier.CollectorMutation(key: "username", value: "alice")]
    let result = try DaVinciCollectorValueApplier.apply(node, mutations: mutations)
    XCTAssertFalse(result.isFlowTrigger)
  }

  // MARK: - Helpers

  private func makeContinueNode(collectors: [any Collector]) -> ContinueNode {
    return TestContinueNode(
      context: FlowContext(flowContext: SharedContext()),
      workflow: Workflow(config: WorkflowConfig()),
      input: [:],
      actions: collectors
    )
  }

  private func makeTextCollector(key: String, value: String) -> TextCollector {
    return TextCollector(with: ["key": key, "type": "TEXT", "label": key, "required": false, "value": value])
  }

  private func makeFlowCollector(key: String) -> FlowCollector {
    return FlowCollector(with: ["key": key, "type": "FLOW", "label": key, "required": false])
  }

  private func makeMultiSelectCollector(key: String) -> MultiSelectCollector {
    return MultiSelectCollector(with: ["key": key, "type": "CHECKBOX", "label": key, "required": false])
  }

  private func makePhoneNumberCollector(key: String) -> PhoneNumberCollector {
    return PhoneNumberCollector(with: [
      "key": key, "type": "PHONE", "label": key, "required": false,
      "defaultCountryCode": "+1", "validatePhoneNumber": false
    ])
  }

  private func makeDeviceRegistrationCollector(key: String, devices: [Device]) -> DeviceRegistrationCollector {
    let devicesJson = devices.map { d -> [String: Any] in
      var m: [String: Any] = ["type": d.type, "title": d.title, "iconSrc": d.iconSrc.absoluteString]
      if let id = d.id { m["id"] = id }
      return m
    }
    return DeviceRegistrationCollector(with: [
      "key": key, "type": "DEVICE_REGISTRATION", "label": key, "required": false,
      "options": devicesJson
    ])
  }

  private func makeDeviceAuthenticationCollector(key: String, devices: [Device]) -> DeviceAuthenticationCollector {
    let devicesJson = devices.map { d -> [String: Any] in
      var m: [String: Any] = ["type": d.type, "title": d.title, "iconSrc": d.iconSrc.absoluteString]
      if let id = d.id { m["id"] = id }
      return m
    }
    return DeviceAuthenticationCollector(with: [
      "key": key, "type": "DEVICE_AUTHENTICATION", "label": key, "required": false,
      "options": devicesJson
    ])
  }

  private func makeDevice(type: String, title: String = "Test Device") -> Device {
    let json: [String: Any] = [
      "type": type,
      "title": title,
      "iconSrc": "https://example.com/icon.png",
      "default": false
    ]
    let data = try! JSONSerialization.data(withJSONObject: json)
    return try! JSONDecoder().decode(Device.self, from: data)
  }
}

private final class TestContinueNode: ContinueNode {
  override func asRequest() -> Request {
    return workflow.config.httpClient.request()
  }
}
