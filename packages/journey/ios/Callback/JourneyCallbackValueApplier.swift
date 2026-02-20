/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingJourney
import PingJourneyPlugin
import PingOrchestrate

/// Applies callback input mutations from JS payloads to active Journey callbacks.
enum JourneyCallbackValueApplier {
  /// Callback types that require additional integration before values can be mutated.
  private static let integrationCallbackRequirements: [String: String] = [
    "DeviceProfileCallback": "@react-native-pingidentity/device-profile",
    "PingOneProtectInitializeCallback": "PingOne Protect integration",
    "PingOneProtectEvaluationCallback": "PingOne Protect integration",
    "Fido2RegistrationCallback": "FIDO/WebAuthn integration",
    "Fido2AuthenticationCallback": "FIDO/WebAuthn integration",
    "FidoRegistrationCallback": "FIDO/WebAuthn integration",
    "FidoAuthenticationCallback": "FIDO/WebAuthn integration",
    "SelectIdPCallback": "External IdP integration",
    "IdPCallback": "External IdP integration",
    "RedirectCallback": "Redirect handling integration",
    "ReCaptchaCallback": "ReCaptcha integration",
    "ReCaptchaEnterpriseCallback": "ReCaptcha Enterprise integration",
    "BindingCallback": "Binding integration",
    "DeviceBindingCallback": "Binding integration",
    "DeviceSigningVerifierCallback": "Binding integration"
  ]

  /// Callback types that are output-only and cannot be mutated via `next()`.
  private static let outputOnlyCallbackTypes: Set<String> = [
    "MetadataCallback",
    "PollingWaitCallback",
    "TextOutputCallback",
    "SuspendedTextOutputCallback"
  ]

  /// Parsed callback mutation instruction received from JavaScript.
  ///
  /// - Note: `@unchecked Sendable` is used because `value` is `Any?`, which
  ///   is not statically sendable. Parsed mutations are immutable value types
  ///   and consumed synchronously within native mutation flow.
  struct CallbackMutation: @unchecked Sendable {
    let type: String
    let value: Any?
    let index: Int?
  }

  /// Parses callback mutation payload from bridge input.
  ///
  /// - Parameter input: Bridge input map.
  /// - Returns: Parsed callback mutations.
  /// - Throws: `JourneyBridgeError.argument` when payload is malformed.
  static func parseInput(_ input: NSDictionary) throws -> [CallbackMutation] {
    guard let callbacks = input["callbacks"] as? [Any] else {
      return []
    }

    var mutations = [CallbackMutation]()
    for (index, item) in callbacks.enumerated() {
      guard let callbackMap = item as? NSDictionary else {
        throw JourneyBridgeError.argument("Invalid callback payload at index \(index)")
      }
      guard let type = callbackMap["type"] as? String, !type.isEmpty else {
        throw JourneyBridgeError.argument("Callback type is required at index \(index)")
      }

      mutations.append(
        CallbackMutation(
          type: type,
          value: readDynamicValue(callbackMap["value"]),
          index: parseOptionalIndex(callbackMap["index"])
        )
      )
    }

    return mutations
  }

  /// Applies parsed callback mutations to an active continue node.
  ///
  /// - Parameters:
  ///   - continueNode: Active continue node.
  ///   - mutations: Parsed callback mutations.
  /// - Throws: `JourneyBridgeError` when mutation fails.
  static func apply(_ continueNode: ContinueNode, mutations: [CallbackMutation]) throws {
    try applyToCallbacks(continueNode.callbacks.map { $0 }, mutations: mutations)
  }

  /// Applies parsed callback mutations to callback list.
  ///
  /// - Parameters:
  ///   - callbacks: Active callbacks.
  ///   - mutations: Parsed callback mutations.
  /// - Throws: `JourneyBridgeError` when mutation fails.
  static func applyToCallbacks(_ callbacks: [Any], mutations: [CallbackMutation]) throws {
    var consumedIndexByType = [String: Int]()

    for mutation in mutations {
      let callback = try findCallback(
        callbacks: callbacks,
        mutation: mutation,
        consumedIndexByType: &consumedIndexByType
      )
      let value = mutation.value

      switch callback {
      case let callback as NameCallback:
        callback.name = try asString(value, fieldName: mutation.type)

      case let callback as PasswordCallback:
        callback.password = try asString(value, fieldName: mutation.type)

      case let callback as TextInputCallback:
        callback.text = try asString(value, fieldName: mutation.type)

      case let callback as StringAttributeInputCallback:
        callback.value = try asString(value, fieldName: mutation.type)

      case let callback as NumberAttributeInputCallback:
        callback.value = try asDouble(value, fieldName: mutation.type)

      case let callback as BooleanAttributeInputCallback:
        callback.value = try asBoolean(value, fieldName: mutation.type)

      case let callback as HiddenValueCallback:
        callback.value = try asString(value, fieldName: mutation.type)

      case let callback as TermsAndConditionsCallback:
        callback.accepted = try asBoolean(value, fieldName: mutation.type)

      case let callback as ConsentMappingCallback:
        callback.accepted = try asBoolean(value, fieldName: mutation.type)

      case let callback as ChoiceCallback:
        callback.selectedIndex = try asInt(value, fieldName: mutation.type)

      case let callback as ConfirmationCallback:
        callback.selectedIndex = try asInt(value, fieldName: mutation.type)

      case let callback as ValidatedPasswordCallback:
        callback.password = try asString(value, fieldName: mutation.type)

      case let callback as ValidatedUsernameCallback:
        callback.username = try asString(value, fieldName: mutation.type)

      case let callback as KbaCreateCallback:
        let map = asStringMap(value)
        if let selectedQuestion = map["selectedQuestion"] ?? map["question"] {
          callback.selectedQuestion = try asString(
            selectedQuestion,
            fieldName: "\(mutation.type).selectedQuestion"
          )
        }
        if let selectedAnswer = map["selectedAnswer"] ?? map["answer"] {
          callback.selectedAnswer = try asString(
            selectedAnswer,
            fieldName: "\(mutation.type).selectedAnswer"
          )
        } else if let stringValue = value as? String {
          callback.selectedAnswer = stringValue
        }
        if let allowUserDefinedQuestions = map["allowUserDefinedQuestions"] {
          callback.allowUserDefinedQuestions = try asBoolean(
            allowUserDefinedQuestions,
            fieldName: "\(mutation.type).allowUserDefinedQuestions"
          )
        }

      case is MetadataCallback, is PollingWaitCallback, is TextOutputCallback, is SuspendedTextOutputCallback:
        throw JourneyBridgeError.unsupportedCallback(
          "Callback type \(mutation.type) is output-only and cannot be mutated"
        )

      default:
        let normalizedType = normalizedCallbackType(mutation.type)
        if outputOnlyCallbackTypes.contains(normalizedType) {
          throw JourneyBridgeError.unsupportedCallback(
            "Callback type \(mutation.type) is output-only and cannot be mutated"
          )
        }
        if let requirement = integrationCallbackRequirements[normalizedType] {
          throw JourneyBridgeError.missingIntegration(
            "Callback type \(mutation.type) requires additional native integration: \(requirement)"
          )
        }
        throw JourneyBridgeError.unsupportedCallback(
          "Callback type \(mutation.type) is not supported for value mutation"
        )
      }
    }
  }

  /// Resolves one callback target for a mutation, accounting for callback aliases and indexes.
  ///
  /// - Parameters:
  ///   - callbacks: Active callbacks.
  ///   - mutation: Parsed callback mutation.
  ///   - consumedIndexByType: Mutable sequential index tracker keyed by callback type.
  /// - Returns: Matching callback instance.
  /// - Throws: `JourneyBridgeError.argument` when no matching callback is found.
  private static func findCallback(
    callbacks: [Any],
    mutation: CallbackMutation,
    consumedIndexByType: inout [String: Int]
  ) throws -> Any {
    let normalizedType = normalizedCallbackType(mutation.type)
    let matching = callbacks.filter { callback in
      callbackLookupType(callback) == normalizedType
    }

    if matching.isEmpty {
      throw JourneyBridgeError.argument("No active callback found for type \(mutation.type)")
    }

    let index = mutation.index ?? consumedIndexByType[normalizedType, default: 0]
    consumedIndexByType[normalizedType] = index + 1

    guard index >= 0, index < matching.count else {
      throw JourneyBridgeError.argument(
        "No active callback found for type \(mutation.type) at index \(index)"
      )
    }
    return matching[index]
  }

  /// Resolves callback lookup type from runtime callback and callback JSON payload.
  ///
  /// - Parameter callback: Runtime callback instance.
  /// - Returns: Normalized callback type.
  private static func callbackLookupType(_ callback: Any) -> String {
    if let abstract = callback as? AbstractCallback,
       let rawType = abstract.json["type"] as? String,
       !rawType.isEmpty {
      return normalizedCallbackType(rawType)
    }
    return normalizedCallbackType(String(describing: type(of: callback)))
  }

  /// Normalizes alias callback type names used by JS helper APIs.
  ///
  /// - Parameter type: Callback type from mutation payload.
  /// - Returns: Native callback type name used in callback lookup.
  private static func normalizedCallbackType(_ type: String) -> String {
    switch type {
    case "ValidatedCreatePasswordCallback":
      return "ValidatedPasswordCallback"
    case "ValidatedCreateUsernameCallback":
      return "ValidatedUsernameCallback"
    default:
      return type
    }
  }

  /// Parses optional callback index from bridge payload.
  ///
  /// - Parameter rawValue: Raw index field.
  /// - Returns: Parsed callback index or `nil`.
  private static func parseOptionalIndex(_ rawValue: Any?) -> Int? {
    if let number = rawValue as? NSNumber {
      return number.intValue
    }
    if let string = rawValue as? String {
      return Int(string)
    }
    return nil
  }

  /// Converts bridge values to optional dynamic values.
  ///
  /// - Parameter rawValue: Raw bridge value.
  /// - Returns: Dynamic value.
  private static func readDynamicValue(_ rawValue: Any?) -> Any? {
    if rawValue is NSNull {
      return nil
    }
    return rawValue
  }

  /// Coerces a dynamic value to a string.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - fieldName: Field path used in validation errors.
  /// - Returns: String value.
  /// - Throws: `JourneyBridgeError.argument` when value cannot be represented as a string.
  private static func asString(_ value: Any?, fieldName: String) throws -> String {
    switch value {
    case let string as String:
      return string
    case let number as NSNumber:
      return number.stringValue
    case let bool as Bool:
      return bool ? "true" : "false"
    default:
      throw JourneyBridgeError.argument("\(fieldName) expects a string-compatible value")
    }
  }

  /// Coerces a dynamic value to a boolean.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - fieldName: Field path used in validation errors.
  /// - Returns: Boolean value.
  /// - Throws: `JourneyBridgeError.argument` when value cannot be represented as a boolean.
  private static func asBoolean(_ value: Any?, fieldName: String) throws -> Bool {
    switch value {
    case let bool as Bool:
      return bool
    case let number as NSNumber:
      return number.intValue != 0
    case let string as String:
      let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      if normalized == "true" || normalized == "1" {
        return true
      }
      if normalized == "false" || normalized == "0" {
        return false
      }
      throw JourneyBridgeError.argument("\(fieldName) expects a boolean value")
    default:
      throw JourneyBridgeError.argument("\(fieldName) expects a boolean value")
    }
  }

  /// Coerces a dynamic value to a double.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - fieldName: Field path used in validation errors.
  /// - Returns: Double value.
  /// - Throws: `JourneyBridgeError.argument` when value is not numeric.
  private static func asDouble(_ value: Any?, fieldName: String) throws -> Double {
    switch value {
    case let number as NSNumber:
      return number.doubleValue
    case let string as String:
      let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
      if let parsed = Double(normalized) {
        return parsed
      }
      throw JourneyBridgeError.argument("\(fieldName) expects a numeric value")
    default:
      throw JourneyBridgeError.argument("\(fieldName) expects a numeric value")
    }
  }

  /// Coerces a dynamic value to an integer.
  ///
  /// - Parameters:
  ///   - value: Dynamic value.
  ///   - fieldName: Field path used in validation errors.
  /// - Returns: Integer value.
  /// - Throws: `JourneyBridgeError.argument` when value is not an integer.
  private static func asInt(_ value: Any?, fieldName: String) throws -> Int {
    switch value {
    case let number as NSNumber:
      return number.intValue
    case let string as String:
      let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
      if let parsed = Int(normalized) {
        return parsed
      }
      throw JourneyBridgeError.argument("\(fieldName) expects an integer value")
    default:
      throw JourneyBridgeError.argument("\(fieldName) expects an integer value")
    }
  }

  /// Coerces a dynamic value to a string-keyed map.
  ///
  /// - Parameter value: Dynamic value.
  /// - Returns: String-keyed map representation.
  private static func asStringMap(_ value: Any?) -> [String: Any] {
    guard let dictionary = value as? NSDictionary else {
      return [:]
    }
    var mapped = [String: Any]()
    dictionary.forEach { key, item in
      guard let key = key as? String else {
        return
      }
      mapped[key] = item
    }
    return mapped
  }
}
