/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDavinci
import PingDavinciPlugin
import PingOrchestrate

/// Applies collector value mutations from JS payloads to active DaVinci collectors.
///
/// DaVinci collectors are identified by key (`collector.id`), not by type index.
enum DaVinciCollectorValueApplier {
  /// Result indicating whether the applied collector triggers an immediate form submit.
  struct ApplyResult: Sendable {
    /// True when a FlowCollector key was applied as part of the input.
    let isFlowTrigger: Bool
  }

  /// Parsed collector mutation instruction received from JavaScript.
  ///
  /// - Note: `@unchecked Sendable` is used because `value` is `Any?`, which is not
  ///   statically sendable. Parsed mutations are immutable value types and consumed
  ///   synchronously within native mutation flow.
  struct CollectorMutation: @unchecked Sendable {
    let key: String
    let value: Any?
  }

  /// Parses collector mutation payload from bridge input.
  ///
  /// The input format matches `DaVinciNextInput`:
  /// `{ collectors: [{ key: string, value: unknown }] }`.
  ///
  /// - Parameter input: Bridge input map.
  /// - Returns: Parsed collector mutations.
  /// - Throws: `DaVinciBridgeError.argument` when payload is malformed.
  static func parseInput(_ input: NSDictionary) throws -> [CollectorMutation] {
    guard let collectors = input["collectors"] as? [Any] else {
      return []
    }

    var mutations = [CollectorMutation]()
    for (index, item) in collectors.enumerated() {
      guard let entry = item as? NSDictionary else {
        throw DaVinciBridgeError.argument("Invalid collector entry at index \(index)")
      }
      guard let key = entry["key"] as? String, !key.isEmpty else {
        throw DaVinciBridgeError.argument("Missing 'key' in collector entry at index \(index)")
      }
      mutations.append(
        CollectorMutation(
          key: key,
          value: readDynamicValue(entry["value"])
        )
      )
    }
    return mutations
  }

  /// Applies parsed collector mutations to an active continue node.
  ///
  /// - Parameters:
  ///   - continueNode: Active continue node providing the collector instances.
  ///   - mutations: Parsed collector mutations.
  /// - Returns: Result indicating whether a FlowCollector key was applied.
  /// - Throws: `DaVinciBridgeError` when mutation fails.
  static func apply(
    _ continueNode: ContinueNode,
    mutations: [CollectorMutation]
  ) throws -> ApplyResult {
    let collectorsByKey = Dictionary(
      uniqueKeysWithValues: continueNode.collectors.map { ($0.id, $0) }
    )

    var isFlowTrigger = false
    for mutation in mutations {
      guard let collector = collectorsByKey[mutation.key] else {
        throw DaVinciBridgeError.argument("No active collector found for key='\(mutation.key)'")
      }
      try applyValue(collector, key: mutation.key, value: mutation.value)
      if collector is FlowCollector {
        isFlowTrigger = true
      }
    }
    return ApplyResult(isFlowTrigger: isFlowTrigger)
  }

  /// Apply a single value to a collector instance.
  ///
  /// - Parameters:
  ///   - collector: Target collector.
  ///   - key: Collector key (used for error messages).
  ///   - value: Value from JS.
  /// - Throws: `DaVinciBridgeError` when the value type is incompatible with the collector.
  private static func applyValue(_ collector: any Collector, key: String, value: Any?) throws {
    switch collector {
    case let multiSelectCollector as MultiSelectCollector:
      let list = try asStringList(value, key: key)
      multiSelectCollector.value = list

    case let phoneNumberCollector as PhoneNumberCollector:
      let map = asStringMap(value)
      if let countryCode = map["countryCode"] {
        phoneNumberCollector.countryCode = countryCode
      }
      if let phoneNumber = map["phoneNumber"] {
        phoneNumberCollector.phoneNumber = phoneNumber
      }

    case let registrationCollector as DeviceRegistrationCollector:
      let map = asStringMap(value)
      guard let deviceType = map["type"] else {
        throw DaVinciBridgeError.argument(
          "DeviceRegistrationCollector key='\(key)': value map must include 'type'"
        )
      }
      guard let device = registrationCollector.devices.first(where: { $0.type == deviceType }) else {
        throw DaVinciBridgeError.argument(
          "DeviceRegistrationCollector key='\(key)': no device found with type='\(deviceType)'"
        )
      }
      registrationCollector.value = device

    case let authenticationCollector as DeviceAuthenticationCollector:
      let map = asStringMap(value)
      guard let deviceType = map["type"] else {
        throw DaVinciBridgeError.argument(
          "DeviceAuthenticationCollector key='\(key)': value map must include 'type'"
        )
      }
      // Fall back to constructing a Device from the map when the type is not in the
      // known device list — mirrors Android DaVinciCollectorValueApplier behaviour.
      let device: Device
      if let known = authenticationCollector.devices.first(where: { $0.type == deviceType }) {
        device = known
      } else {
        device = try makeFallbackDevice(from: map, type: deviceType, key: key)
      }
      authenticationCollector.value = device

    default:
      // All remaining collectors (TextCollector, PasswordCollector, SingleSelectCollector,
      // SubmitCollector, FlowCollector) extend SingleValueCollector which accepts a String
      // via initialize(with:).
      guard collector is SingleValueCollector else {
        throw DaVinciBridgeError.unsupportedCollector(
          "Collector key='\(key)' type=\(String(describing: type(of: collector))) is not supported by the bridge"
        )
      }
      let stringValue = try asString(value, key: key)
      collector.initialize(with: stringValue)
    }
  }

  // MARK: - Value coercion helpers

  /// Read a dynamic value from a bridge entry.
  ///
  /// - Parameter value: Raw bridge value.
  /// - Returns: Dynamic value, or `nil` when null.
  private static func readDynamicValue(_ value: Any?) -> Any? {
    if value is NSNull {
      return nil
    }
    return value
  }

  /// Coerce a dynamic value to a string.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - key: Collector key (used in error messages).
  /// - Returns: String value.
  /// - Throws: `DaVinciBridgeError.argument` when value cannot be represented as a string.
  private static func asString(_ value: Any?, key: String) throws -> String {
    switch value {
    case let string as String:
      return string
    case let number as NSNumber:
      // CFBooleanGetTypeID() distinguishes an actual Swift/ObjC Bool from a bridged
      // integer NSNumber — both satisfy `as? Bool` in Swift, so we must check the
      // CF type first to avoid converting numeric 0/1 to "false"/"true".
      if CFGetTypeID(number) == CFBooleanGetTypeID() {
        return number.boolValue ? "true" : "false"
      }
      return number.stringValue
    default:
      throw DaVinciBridgeError.argument(
        "Collector key='\(key)' expects a string-compatible value"
      )
    }
  }

  /// Coerce a dynamic value to a list of strings.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - key: Collector key (used in error messages).
  /// - Returns: Array of strings.
  /// - Throws: `DaVinciBridgeError.argument` when value is not an array or contains a non-String element.
  private static func asStringList(_ value: Any?, key: String) throws -> [String] {
    let elements: [Any]
    if let array = value as? [Any] {
      elements = array
    } else if let array = value as? NSArray {
      elements = array as [Any]
    } else {
      throw DaVinciBridgeError.argument(
        "Collector key='\(key)' expects an array of strings"
      )
    }
    return try elements.map { element in
      guard let string = element as? String else {
        throw DaVinciBridgeError.argument(
          "Collector key='\(key)' expects an array of strings, got \(type(of: element))"
        )
      }
      return string
    }
  }

  /// Construct a `Device` from a string map when the type is absent from the collector's
  /// known device list. Mirrors the Android bridge fallback in `DaVinciCollectorValueApplier`.
  ///
  /// - Parameters:
  ///   - map: String map extracted from the JS value.
  ///   - type: Resolved device type string.
  ///   - key: Collector key (used for error messages).
  /// - Returns: A `Device` decoded from the map fields.
  /// - Throws: `DaVinciBridgeError.argument` when the JSON cannot be decoded.
  private static func makeFallbackDevice(
    from map: [String: String],
    type deviceType: String,
    key: String
  ) throws -> Device {
    var json: [String: Any] = [
      "type": deviceType,
      "title": map["title"] ?? deviceType,
      "iconSrc": map["iconSrc"] ?? "about:blank",
      "default": false
    ]
    if let id = map["id"] { json["id"] = id }
    if let description = map["description"] { json["description"] = description }
    do {
      let data = try JSONSerialization.data(withJSONObject: json)
      return try JSONDecoder().decode(Device.self, from: data)
    } catch {
      throw DaVinciBridgeError.argument(
        "DeviceAuthenticationCollector key='\(key)': failed to construct fallback device"
      )
    }
  }

  /// Coerce a dynamic value to a string-keyed string map.
  ///
  /// - Parameter value: Dynamic value.
  /// - Returns: String map.
  private static func asStringMap(_ value: Any?) -> [String: String] {
    guard let dictionary = value as? NSDictionary else {
      return [:]
    }
    var mapped = [String: String]()
    for (rawKey, rawValue) in dictionary {
      guard let key = rawKey as? String else { continue }
      if let string = rawValue as? String {
        mapped[key] = string
      } else if let number = rawValue as? NSNumber {
        mapped[key] = number.stringValue
      }
    }
    return mapped
  }
}
