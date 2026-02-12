/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Helpers for converting JSON payloads into JS bridge-safe Foundation values.
public enum JsonBridgeMapper {
  /// Convert a JSON object (dictionary) into an NSDictionary suitable for the bridge.
  public static func encodeJsonObject(_ value: [String: Any]) -> NSDictionary {
    var result: [String: Any] = [:]
    for (key, element) in value {
      result[key] = encodeJsonElement(element) ?? NSNull()
    }
    return result as NSDictionary
  }

  /// Convert a JSON element into a bridge-safe Foundation value.
  public static func encodeJsonElement(_ element: Any?) -> Any? {
    guard let element else { return nil }
    if element is NSNull { return nil }
    if let dict = element as? [String: Any] {
      return encodeJsonObject(dict)
    }
    if let array = element as? [Any] {
      return encodeJsonArray(array)
    }
    if let number = element as? NSNumber { return number }
    if let string = element as? String { return string }
    if let bool = element as? Bool { return bool }
    return String(describing: element)
  }

  /// Convert a JSON array into an NSArray suitable for the bridge.
  public static func encodeJsonArray(_ value: [Any]) -> NSArray {
    let array = value.map { encodeJsonElement($0) ?? NSNull() }
    return array as NSArray
  }
}
