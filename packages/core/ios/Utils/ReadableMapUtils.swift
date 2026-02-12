/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Helpers for reading typed values from JS dictionaries.
public enum ReadableMapUtils {
  /// Read a required string value from a JS dictionary.
  ///
  /// - Throws: `NSError` when the key is missing or empty.
  public static func requireString(_ map: NSDictionary, key: String) throws -> String {
    let value = map[key] as? String
    if value == nil || value?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true {
      throw NSError(domain: "RNPingCore", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing required parameter: \(key)"])
    }
    return value ?? ""
  }

  /// Read a required array of strings from a JS dictionary.
  ///
  /// - Throws: `NSError` when the key is missing or the array is empty.
  public static func requireStringArray(_ map: NSDictionary, key: String) throws -> [String] {
    let values = readStringArray(map[key] as? NSArray)
    if values.isEmpty {
      throw NSError(domain: "RNPingCore", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing required parameter: \(key)"])
    }
    return values
  }

  /// Convert a JS array into a list of strings, ignoring nulls.
  public static func readStringArray(_ array: NSArray?) -> [String] {
    guard let array else { return [] }
    return array.compactMap { $0 as? String }
  }

  /// Convert a JS dictionary of string values into a Swift dictionary.
  public static func readStringMap(_ map: NSDictionary?) -> [String: String] {
    guard let map else { return [:] }
    var result: [String: String] = [:]
    for (key, rawValue) in map {
      guard let stringKey = key as? String, let stringValue = rawValue as? String else { continue }
      result[stringKey] = stringValue
    }
    return result
  }
}
