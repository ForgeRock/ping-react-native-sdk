/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDavinci
import PingDavinciPlugin
import PingLogger
import PingOrchestrate
import RNPingCore

/// Maps native iOS DaVinci nodes and collectors to React Native bridge payloads.
enum DaVinciNodeMapper {
  private static let logTag = "DaVinciNodeMapper"

  /// Converts a native DaVinci node to a bridge-friendly dictionary payload.
  ///
  /// - Parameters:
  ///   - node: Native DaVinci node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: Serialized node payload.
  static func mapNode(_ node: Node, logger: Logger? = nil) -> NSDictionary {
    return JsonBridgeMapper.encodeJsonObject(mapNodePayload(node, logger: logger))
  }

  /// Builds a plain dictionary payload for a native node.
  ///
  /// - Parameters:
  ///   - node: Native DaVinci node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: Serializable node payload map.
  static func mapNodePayload(_ node: Node, logger: Logger? = nil) -> [String: Any] {
    var payload = [String: Any]()

    switch node {
    case let continueNode as ContinueNode:
      payload["type"] = "ContinueNode"
      payload["collectors"] = mapCollectors(continueNode, logger: logger)
      payload["input"] = JsonBridgeMapper.encodeJsonObject(continueNode.input)
      let unsupported = unsupportedFields(continueNode, logger: logger)
      if !unsupported.isEmpty {
        payload["unsupportedFields"] = unsupported
      }

    case let successNode as SuccessNode:
      payload["type"] = "SuccessNode"
      payload["session"] = ["value": successNode.session.value]

    case let errorNode as ErrorNode:
      payload["type"] = "ErrorNode"
      payload["message"] = errorNode.message
      payload["input"] = JsonBridgeMapper.encodeJsonObject(errorNode.input)
      if let status = errorNode.status {
        payload["status"] = status
      }

    case let failureNode as FailureNode:
      let causeMessage = failureNode.cause.localizedDescription
      payload["type"] = "FailureNode"
      payload["message"] = causeMessage
      payload["cause"] = causeMessage
      if case let ApiError.error(status, _, _) = failureNode.cause {
        payload["status"] = status
      }

    default:
      payload["type"] = "FailureNode"
      payload["message"] = "Unsupported node type: \(String(describing: type(of: node)))"
    }

    return payload
  }

  /// Serializes all `Collector` instances from a `ContinueNode` into an array.
  ///
  /// Unknown collector subtypes are skipped gracefully.
  ///
  /// - Parameters:
  ///   - node: Active continue node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: Serialized collectors array.
  private static func mapCollectors(_ node: ContinueNode, logger: Logger?) -> [[String: Any]] {
    var output = [[String: Any]]()
    for collector in node.collectors {
      if let map = mapCollector(collector, node: node, logger: logger) {
        output.append(map)
      }
    }
    return output
  }

  /// Diffs the raw form fields against the collectors the native SDK instantiated.
  ///
  /// Surfaces field entries from `node.input.form.components.fields[]` whose
  /// `inputType`/`type` was not registered with the native `CollectorFactory` — these
  /// are silently dropped by the SDK and would otherwise be invisible to JS consumers.
  ///
  /// The resolution order (`inputType` preferred over `type`) mirrors
  /// `CollectorFactory.collector(daVinci:from:)` in the iOS DaVinci SDK.
  ///
  /// - Parameters:
  ///   - node: Active continue node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: Array of `{ key, type }` entries describing dropped fields.
  private static func unsupportedFields(_ node: ContinueNode, logger: Logger?) -> [[String: Any]] {
    guard let fields = formFields(node, logger: logger) else { return [] }

    let registeredKeys = Set(node.collectors.map { $0.id })

    var entries = [[String: Any]]()
    for field in fields {
      guard let key = field["key"] as? String else { continue }

      // Mirrors CollectorFactory.collector(daVinci:from:): inputType takes precedence over type.
      guard let resolvedType = (field["inputType"] as? String) ?? (field["type"] as? String) else {
        continue
      }

      // A field is supported when the SDK instantiated a collector for its key.
      guard !registeredKeys.contains(key) else { continue }

      entries.append(["key": key, "type": resolvedType])
    }
    return entries
  }

  // MARK: - Form-field JSON navigation helpers

  /// Reads `node.input.form.components.fields[]` as a flat array of field dictionaries.
  ///
  /// - Parameters:
  ///   - node: Active continue node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: The fields array, or `nil` when the path is absent or malformed.
  private static func formFields(_ node: ContinueNode, logger: Logger?) -> [[String: Any]]? {
    guard
      let form = node.input["form"] as? [String: Any],
      let components = form["components"] as? [String: Any],
      let fields = components["fields"] as? [[String: Any]]
    else {
      return nil
    }
    return fields
  }

  /// Locates the field-level dictionary whose `key` matches `collectorKey`.
  ///
  /// - Parameters:
  ///   - collectorKey: The collector key to match against field entries.
  ///   - node: Active continue node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: The matching field dictionary, or `nil` when not present.
  private static func findFieldJson(
    _ collectorKey: String,
    node: ContinueNode,
    logger: Logger?
  ) -> [String: Any]? {
    return formFields(node, logger: logger)?.first { ($0["key"] as? String) == collectorKey }
  }

  /// Looks up the field-level JSON for a collector and emits it as `raw` on the collector map.
  ///
  /// Collectors whose key has no matching field entry (e.g. action buttons) have `raw` omitted.
  ///
  /// - Parameters:
  ///   - map: Mutable collector map to annotate with the raw field JSON.
  ///   - collectorKey: The collector key used to look up the matching field entry.
  ///   - node: Active continue node.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  private static func applyRawField(
    _ map: inout [String: Any],
    collectorKey: String,
    node: ContinueNode,
    logger: Logger?
  ) {
    guard let field = findFieldJson(collectorKey, node: node, logger: logger) else { return }
    map["raw"] = JsonBridgeMapper.encodeJsonObject(field)
  }

  /// Serializes a single collector to a bridge map.
  ///
  /// - Parameters:
  ///   - collector: Native collector instance to serialize.
  ///   - node: Active continue node providing form field context.
  ///   - logger: Optional Ping logger for non-fatal mapping warnings.
  /// - Returns: Serialized collector map, or `nil` for unknown collector subtypes.
  private static func mapCollector(
    _ collector: any Collector,
    node: ContinueNode,
    logger: Logger?
  ) -> [String: Any]? {
    var map: [String: Any]?
    switch collector {
    case let textCollector as TextCollector:
      map = mapTextCollector(textCollector)
    case let passwordCollector as PasswordCollector:
      map = mapPasswordCollector(passwordCollector, node: node, logger: logger)
    case let submitCollector as SubmitCollector:
      map = mapBaseFieldCollector(submitCollector)
    case let flowCollector as FlowCollector:
      map = mapBaseFieldCollector(flowCollector)
    case let labelCollector as LabelCollector:
      map = mapLabelCollector(labelCollector)
    case let singleSelectCollector as SingleSelectCollector:
      map = mapSingleSelectCollector(singleSelectCollector)
    case let multiSelectCollector as MultiSelectCollector:
      map = mapMultiSelectCollector(multiSelectCollector)
    case let phoneNumberCollector as PhoneNumberCollector:
      map = mapPhoneNumberCollector(phoneNumberCollector)
    case let registrationCollector as DeviceRegistrationCollector:
      map = mapDeviceRegistrationCollector(registrationCollector)
    case let authenticationCollector as DeviceAuthenticationCollector:
      map = mapDeviceAuthenticationCollector(authenticationCollector)
    default:
      logger?.w(
        "[\(logTag)] Skipping unsupported collector type: \(String(describing: type(of: collector)))",
        error: nil
      )
      return nil
    }
    guard var collectorMap = map else { return nil }
    applyRawField(&collectorMap, collectorKey: collector.id, node: node, logger: logger)
    return collectorMap
  }

  // MARK: - Field collector helpers

  /// Serializes base FieldCollector fields (key, type, label, required) into a map.
  ///
  /// - Parameter collector: FieldCollector instance.
  /// - Returns: Base collector map.
  private static func baseFieldCollectorMap<T>(_ collector: FieldCollector<T>) -> [String: Any] {
    return [
      "key": collector.key,
      "type": collector.type,
      "label": collector.label,
      "required": collector.required
    ]
  }

  /// Serializes base FieldCollector fields into a map without additional specialization.
  ///
  /// - Parameter collector: FieldCollector instance.
  /// - Returns: Base collector map.
  private static func mapBaseFieldCollector<T>(_ collector: FieldCollector<T>) -> [String: Any] {
    return baseFieldCollectorMap(collector)
  }

  /// Serializes a `TextCollector` to a bridge map, including value and optional validation regex.
  ///
  /// - Parameter collector: TextCollector instance.
  /// - Returns: Serialized text collector map.
  private static func mapTextCollector(_ collector: TextCollector) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["value"] = collector.value
    if let validation = collector.validation, let regex = validation.regex {
      map["validation"] = ["regex": regex.pattern]
    }
    return map
  }

  /// Serializes a `PasswordCollector` to a bridge map.
  ///
  /// - Note: The `value` field is always emitted as `""` and never reflects the native
  ///   collector's current value. Password fields are treated as write-only across the
  ///   bridge — JS may push a value into the collector via `next()`, but the bridge
  ///   never round-trips the entered password back to JS. This matches the
  ///   `PasswordCollector.value` contract in the public TypeScript types and aligns
  ///   with the Android bridge's emission.
  private static func mapPasswordCollector(
    _ collector: PasswordCollector,
    node: ContinueNode,
    logger: Logger?
  ) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["value"] = ""
    map["clearPassword"] = collector.clearPassword
    if let policy = extractPasswordPolicy(collector.key, node: node, logger: logger) {
      map["passwordPolicy"] = policy
    }
    return map
  }

  /// Reads passwordPolicy from the raw JSON at
  /// `continueNode.input.form.components.fields[].passwordPolicy` by matching the
  /// collector key.
  ///
  /// The SDK's own `passwordPolicy()` method reads from the node root
  /// (`continueNode.input["passwordPolicy"]`) which is the wrong path — that is why
  /// the bridge does the lookup itself.
  ///
  /// - Returns: Bridge-encoded password policy dictionary, or `nil` when missing.
  private static func extractPasswordPolicy(
    _ collectorKey: String,
    node: ContinueNode,
    logger: Logger?
  ) -> NSDictionary? {
    guard
      let field = findFieldJson(collectorKey, node: node, logger: logger),
      let policyDict = field["passwordPolicy"] as? [String: Any]
    else {
      return nil
    }

    do {
      let data = try JSONSerialization.data(withJSONObject: policyDict, options: [])
      let policy = try JSONDecoder().decode(PasswordPolicy.self, from: data)
      let encoded = try JSONEncoder().encode(policy)
      if let object = try JSONSerialization.jsonObject(with: encoded) as? [String: Any] {
        return JsonBridgeMapper.encodeJsonObject(object)
      }
      return nil
    } catch {
      logger?.w(
        "[\(logTag)] Failed to extract password policy for key=\(collectorKey)",
        error: error
      )
      return nil
    }
  }

  /// Serializes a `LabelCollector` to a bridge map.
  ///
  /// - Parameter collector: LabelCollector instance.
  /// - Returns: Serialized label collector map.
  private static func mapLabelCollector(_ collector: LabelCollector) -> [String: Any] {
    return [
      "key": collector.key,
      "type": "LABEL",
      "content": collector.content
    ]
  }

  /// Serializes a `SingleSelectCollector` to a bridge map, including value and options.
  ///
  /// - Parameter collector: SingleSelectCollector instance.
  /// - Returns: Serialized single-select collector map.
  private static func mapSingleSelectCollector(_ collector: SingleSelectCollector) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["value"] = collector.value
    map["options"] = mapOptions(collector.options)
    if let validation = collector.validation, let regex = validation.regex {
      map["validation"] = ["regex": regex.pattern]
    }
    return map
  }

  /// Serializes a `MultiSelectCollector` to a bridge map, including value and options.
  ///
  /// - Parameter collector: MultiSelectCollector instance.
  /// - Returns: Serialized multi-select collector map.
  private static func mapMultiSelectCollector(_ collector: MultiSelectCollector) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["value"] = collector.value
    map["options"] = mapOptions(collector.options)
    return map
  }

  /// Serializes a `PhoneNumberCollector` to a bridge map.
  ///
  /// - Parameter collector: PhoneNumberCollector instance.
  /// - Returns: Serialized phone number collector map.
  private static func mapPhoneNumberCollector(_ collector: PhoneNumberCollector) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["defaultCountryCode"] = collector.defaultCountryCode
    map["validatePhoneNumber"] = collector.validatePhoneNumber
    map["countryCode"] = collector.countryCode
    map["phoneNumber"] = collector.phoneNumber
    return map
  }

  /// Serializes a `DeviceRegistrationCollector` to a bridge map, including available devices.
  ///
  /// - Parameter collector: DeviceRegistrationCollector instance.
  /// - Returns: Serialized device registration collector map.
  private static func mapDeviceRegistrationCollector(
    _ collector: DeviceRegistrationCollector
  ) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["devices"] = mapDevices(collector.devices)
    return map
  }

  /// Serializes a `DeviceAuthenticationCollector` to a bridge map, including available devices.
  ///
  /// - Parameter collector: DeviceAuthenticationCollector instance.
  /// - Returns: Serialized device authentication collector map.
  private static func mapDeviceAuthenticationCollector(
    _ collector: DeviceAuthenticationCollector
  ) -> [String: Any] {
    var map = baseFieldCollectorMap(collector)
    map["devices"] = mapDevices(collector.devices)
    return map
  }

  /// Converts an array of `Option` values to serializable bridge maps.
  ///
  /// - Parameter options: Native option values from a select collector.
  /// - Returns: Array of `{ label, value }` dictionaries.
  private static func mapOptions(_ options: [Option]) -> [[String: Any]] {
    return options.map { option in
      ["label": option.label, "value": option.value]
    }
  }

  /// Converts an array of `Device` values to serializable bridge maps.
  ///
  /// - Parameter devices: Native device entries from a device collector.
  /// - Returns: Array of device dictionaries with type, title, iconSrc, isDefault, and optional id and description.
  private static func mapDevices(_ devices: [Device]) -> [[String: Any]] {
    return devices.map { device in
      var map: [String: Any] = [
        "type": device.type,
        "title": device.title,
        "iconSrc": device.iconSrc.absoluteString,
        "isDefault": device.isDefault ?? false
      ]
      if let id = device.id {
        map["id"] = id
      }
      if let description = device.description {
        map["description"] = description
      }
      return map
    }
  }
}
