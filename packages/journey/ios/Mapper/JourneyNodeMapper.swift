/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingJourney
import PingOrchestrate

/// Maps native Journey nodes/callbacks to React Native bridge payloads.
enum JourneyNodeMapper {
  /// Converts a native node to a bridge-friendly dictionary payload.
  ///
  /// - Parameter node: Native Journey node.
  /// - Returns: Serialized node payload.
  static func mapNode(_ node: Node) -> NSDictionary {
    return mapNodePayload(node) as NSDictionary
  }

  /// Converts a native callback to a bridge-friendly dictionary payload.
  ///
  /// - Parameter callback: Native callback instance.
  /// - Returns: Serialized callback payload.
  static func mapCallback(_ callback: Any) -> NSDictionary {
    return mapCallbackPayload(callback) as NSDictionary
  }

  /// Builds a plain dictionary payload for a native node.
  ///
  /// - Parameter node: Native Journey node.
  /// - Returns: Serializable node payload map.
  static func mapNodePayload(_ node: Node) -> [String: Any] {
    var payload = [String: Any]()

    switch node {
    case let continueNode as ContinueNode:
      payload["type"] = "ContinueNode"
      payload["input"] = bridgeValue(continueNode.input)
      payload["callbacks"] = continueNode.callbacks.map { callback in
        mapCallbackPayload(callback)
      }
    case let errorNode as ErrorNode:
      payload["type"] = "ErrorNode"
      payload["message"] = errorNode.message
      if let status = errorNode.status {
        payload["status"] = status
      }
      payload["input"] = bridgeValue(errorNode.input)
    case let successNode as SuccessNode:
      payload["type"] = "SuccessNode"
      payload["input"] = bridgeValue(successNode.input)
    case let failureNode as FailureNode:
      let message = failureNode.cause.localizedDescription
      payload["type"] = "FailureNode"
      payload["message"] = message
      payload["cause"] = message
    default:
      payload["type"] = "FailureNode"
      payload["message"] = "Unsupported node type: \(String(describing: type(of: node)))"
      payload["cause"] = "Unsupported node type"
    }

    return payload
  }

  /// Builds a plain dictionary payload for a native callback.
  ///
  /// - Parameter callback: Native callback instance.
  /// - Returns: Serializable callback payload map.
  static func mapCallbackPayload(_ callback: Any) -> [String: Any] {
    var payload: [String: Any] = ["type": callbackType(callback)]

    if let abstractCallback = callback as? AbstractCallback {
      payload["raw"] = bridgeValue(abstractCallback.json)
    }

    if let validatedCallback = callback as? AbstractValidatedCallback {
      payload["validateOnly"] = validatedCallback.validateOnly
      payload["prompt"] = validatedCallback.prompt
      payload["policies"] = bridgeValue(validatedCallback.policies)
      payload["failedPolicies"] = validatedCallback.failedPolicies.map { failedPolicy in
        var failedPayload: [String: Any] = [
          "policyRequirement": failedPolicy.policyRequirement
        ]
        if let params = failedPolicy.params {
          failedPayload["params"] = bridgeValue(params)
        }
        return failedPayload
      }
    }

    if let required = resolveRequired(callback) {
      payload["required"] = required
    }

    switch callback {
    case let name as NameCallback:
      payload["prompt"] = name.prompt
      payload["value"] = name.name

    case let password as PasswordCallback:
      payload["prompt"] = password.prompt
      payload["value"] = ""

    case let textInput as TextInputCallback:
      payload["prompt"] = textInput.prompt
      payload["defaultText"] = textInput.defaultText
      payload["value"] = textInput.text

    case let textOutput as TextOutputCallback:
      payload["prompt"] = textOutput.message
      payload["message"] = textOutput.message
      payload["messageType"] = String(describing: textOutput.messageType)

    case let suspended as SuspendedTextOutputCallback:
      payload["prompt"] = suspended.message
      payload["message"] = suspended.message
      payload["messageType"] = String(describing: suspended.messageType)

    case let attribute as StringAttributeInputCallback:
      payload["prompt"] = attribute.prompt
      payload["name"] = attribute.name
      payload["required"] = attribute.required
      payload["validateOnly"] = attribute.validateOnly
      payload["value"] = attribute.value

    case let attribute as NumberAttributeInputCallback:
      payload["prompt"] = attribute.prompt
      payload["name"] = attribute.name
      payload["required"] = attribute.required
      payload["validateOnly"] = attribute.validateOnly
      payload["value"] = attribute.value

    case let attribute as BooleanAttributeInputCallback:
      payload["prompt"] = attribute.prompt
      payload["name"] = attribute.name
      payload["required"] = attribute.required
      payload["validateOnly"] = attribute.validateOnly
      payload["value"] = attribute.value

    case let choice as ChoiceCallback:
      payload["prompt"] = choice.prompt
      payload["choices"] = choice.choices
      payload["defaultChoice"] = choice.defaultChoice
      payload["selectedIndex"] = choice.selectedIndex

    case let confirmation as ConfirmationCallback:
      payload["prompt"] = confirmation.prompt
      payload["options"] = confirmation.options
      payload["selectedIndex"] = confirmation.selectedIndex ?? -1
      payload["defaultOption"] = String(describing: confirmation.defaultOption)
      payload["optionType"] = String(describing: confirmation.optionType)
      payload["messageType"] = String(describing: confirmation.messageType)

    case let consent as ConsentMappingCallback:
      payload["name"] = consent.name
      payload["displayName"] = consent.displayName
      payload["icon"] = consent.icon
      payload["accessLevel"] = consent.accessLevel
      payload["required"] = consent.isRequired
      payload["fields"] = consent.fields
      payload["message"] = consent.message
      payload["accepted"] = consent.accepted

    case let terms as TermsAndConditionsCallback:
      payload["version"] = terms.version
      payload["terms"] = terms.terms
      payload["createDate"] = terms.createDate
      payload["accepted"] = terms.accepted

    case let hidden as HiddenValueCallback:
      payload["id"] = hidden.hiddenId
      payload["value"] = hidden.value

    case let kba as KbaCreateCallback:
      payload["prompt"] = kba.prompt
      payload["predefinedQuestions"] = kba.predefinedQuestions
      payload["selectedQuestion"] = kba.selectedQuestion
      payload["selectedAnswer"] = kba.selectedAnswer
      payload["allowUserDefinedQuestions"] = kba.allowUserDefinedQuestions

    case let polling as PollingWaitCallback:
      payload["waitTime"] = polling.waitTime
      payload["message"] = polling.message

    case let metadata as MetadataCallback:
      payload["value"] = bridgeValue(metadata.value)

    case let validated as ValidatedPasswordCallback:
      payload["prompt"] = validated.prompt
      payload["value"] = ""
      payload["validateOnly"] = validated.validateOnly
      payload["echoOn"] = validated.echoOn

    case let validated as ValidatedUsernameCallback:
      payload["prompt"] = validated.prompt
      payload["value"] = validated.username
      payload["validateOnly"] = validated.validateOnly

    default:
      break
    }

    return payload
  }

  /// Resolves normalized callback type aliases for bridge payloads.
  ///
  /// - Parameter callback: Native callback instance.
  /// - Returns: Callback type string exposed to JavaScript.
  private static func callbackType(_ callback: Any) -> String {
    switch callback {
    case is ValidatedPasswordCallback:
      return "ValidatedCreatePasswordCallback"
    case is ValidatedUsernameCallback:
      return "ValidatedCreateUsernameCallback"
    case let abstractCallback as AbstractCallback:
      if let rawType = abstractCallback.json["type"] as? String, !rawType.isEmpty {
        return rawType
      }
      return String(describing: type(of: callback))
    default:
      return String(describing: type(of: callback))
    }
  }

  /// Resolves callback required metadata from known callback properties.
  ///
  /// - Parameter callback: Native callback instance.
  /// - Returns: Required flag when available.
  private static func resolveRequired(_ callback: Any) -> Bool? {
    switch callback {
    case let attribute as AttributeInputCallback:
      return attribute.required
    case let consent as ConsentMappingCallback:
      return consent.isRequired
    default:
      return reflectedBooleanProperty(callback, names: ["isRequired", "required"])
    }
  }

  /// Reads the first available boolean property by name using reflection.
  ///
  /// - Parameters:
  ///   - source: Reflected source object.
  ///   - names: Candidate property names.
  /// - Returns: Boolean value when available.
  private static func reflectedBooleanProperty(_ source: Any, names: [String]) -> Bool? {
    let mirror = Mirror(reflecting: source)
    for child in mirror.children {
      guard let label = child.label, names.contains(label) else {
        continue
      }
      if let boolValue = child.value as? Bool {
        return boolValue
      }
      if let numberValue = child.value as? NSNumber {
        return numberValue.boolValue
      }
      if let stringValue = child.value as? String {
        let normalized = stringValue.lowercased()
        if normalized == "true" || normalized == "1" {
          return true
        }
        if normalized == "false" || normalized == "0" {
          return false
        }
      }
    }
    return nil
  }

  /// Converts native values into React Native bridge-friendly values.
  ///
  /// - Parameter value: Native value.
  /// - Returns: Bridge-safe value.
  private static func bridgeValue(_ value: Any?) -> Any {
    guard let value else {
      return NSNull()
    }

    switch value {
    case let string as String:
      return string
    case let number as NSNumber:
      return number
    case let bool as Bool:
      return bool
    case let int as Int:
      return int
    case let int64 as Int64:
      return NSNumber(value: int64)
    case let float as Float:
      return NSNumber(value: float)
    case let double as Double:
      return NSNumber(value: double)
    case let url as URL:
      return url.absoluteString
    case is NSNull:
      return NSNull()
    case let dictionary as [String: Any]:
      var mapped = [String: Any]()
      dictionary.forEach { key, item in
        mapped[key] = bridgeValue(item)
      }
      return mapped
    case let dictionary as [String: Sendable]:
      var mapped = [String: Any]()
      dictionary.forEach { key, item in
        mapped[key] = bridgeValue(item)
      }
      return mapped
    case let dictionary as NSDictionary:
      var mapped = [String: Any]()
      dictionary.forEach { key, item in
        guard let key = key as? String else {
          return
        }
        mapped[key] = bridgeValue(item)
      }
      return mapped
    case let array as [Any]:
      return array.map { bridgeValue($0) }
    case let array as [Sendable]:
      return array.map { bridgeValue($0) }
    case let array as NSArray:
      return array.map { bridgeValue($0) }
    default:
      return String(describing: value)
    }
  }
}

