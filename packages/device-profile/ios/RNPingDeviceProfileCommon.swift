/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceProfile
import RNPingCore

/// Shared device profile collection logic for React Native iOS bridges.
/// TODO: Add logging once logger module is available and error shapes
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingDeviceProfileCommon: NSObject {

  /// Collects device profile data outside of Journey flows.
  /// - Parameters:
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - resolver: Promise resolver for the collected profile payload.
  ///   - rejecter: Promise rejecter for collection errors.
  /// TODO: Add error shape once types module is available.
  @objc
  public static func collectDeviceProfile(
    _ collectors: [String],
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    let locationRequested = collectors.contains("location")
    let nativeCollectors = buildCollectors(from: collectors, includeLocation: true)

    Task {
      do {
        if nativeCollectors.isEmpty {
          resolver([:] as NSDictionary)
          return
        }

        let payload = try await collectPayload(from: nativeCollectors)
        resolver(NSDictionary(dictionary: payload))
      } catch {
        rejecter(
          "DEVICE_PROFILE_COLLECT_ERROR",
          "Failed to collect device profile: \(error.localizedDescription)",
          error as NSError
        )
      }
    }
  }

  /// Collects device profile data using the active Journey callback context.
  /// - Parameters:
  ///   - journeyId: Journey instance identifier.
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - resolver: Promise resolver for the collected profile payload.
  ///   - rejecter: Promise rejecter for collection errors.
  /// TODO: Add error shape once types module is available.
  @objc
  public static func collectDeviceProfileForJourney(
    _ journeyId: String,
    collectors: [String],
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    let locationRequested = collectors.contains("location")
    let metadataCollectors = buildCollectors(from: collectors, includeLocation: false)
    let metadataRequested = !metadataCollectors.isEmpty

    Task {
      guard let callback = await resolveDeviceProfileCallback(journeyId) else {
        rejecter(
          "DEVICE_PROFILE_CALLBACK_NOT_FOUND",
          "No active Device Profile callback found for journey \(journeyId).",
          nil
        )
        return
      }

      let result = await callback.collect { config in
        config.metadata = callback.metadata && metadataRequested
        config.location = callback.location && locationRequested
        config.collectors { metadataCollectors }
      }

      switch result {
      case .success(let payload):
        resolver(NSDictionary(dictionary: mapSendablePayload(payload)))
      case .failure(let error):
        rejecter(
          "DEVICE_PROFILE_COLLECT_ERROR",
          "Failed to collect device profile for journey \(journeyId): \(error.localizedDescription)",
          error as NSError
        )
      }
    }
  }

  /// Builds native DeviceProfile collectors from JS identifiers.
  /// - Parameters:
  ///   - collectorNames: List of collector identifiers requested from JS.
  ///   - includeLocation: Whether to instantiate the LocationCollector.
  /// - Returns: An array of initialized DeviceCollector instances corresponding to the requested types.
  private static func buildCollectors(
    from collectorNames: [String],
    includeLocation: Bool
  ) -> [any DeviceCollector] {
    var collectors: [any DeviceCollector] = []

    for name in collectorNames {
      switch name {
      case "platform":
        collectors.append(PlatformCollector())
      case "hardware":
        collectors.append(HardwareCollector())
      case "network":
        collectors.append(NetworkCollector())
      case "telephony":
        collectors.append(TelephonyCollector())
      case "browser":
        collectors.append(BrowserCollector())
      case "bluetooth":
        collectors.append(BluetoothCollector())
      case "location":
        if includeLocation {
          collectors.append(LocationCollector())
        }
      default:
        break
      }
    }

    return collectors
  }

  /// Collects payload data from the provided collectors.
  /// - Parameter collectors: The list of collectors to execute.
  /// - Returns: A dictionary containing the collected data keyed by collector type.
  private static func collectPayload(
    from collectors: [any DeviceCollector]
  ) async throws -> [String: Any] {
    var result: [String: Any] = [:]

    for collector in collectors {
      if let data = try await collector.collect() {
        let jsonData = try JSONEncoder().encode(data)
        let jsonObject = try JSONSerialization.jsonObject(with: jsonData)
        result[collector.key] = jsonObject
      }
    }

    return result
  }

  /// Resolves the active DeviceProfileCallback for a Journey identifier.
  ///
  /// This method queries the CoreRuntime for active Journey callbacks and filters
  /// for the first DeviceProfileCallback instance in the callback chain.
  ///
  /// - Parameter journeyId: The identifier of the journey flow.
  /// - Returns: The active DeviceProfileCallback if found, otherwise nil.
  /// - Note: Returns nil if no callbacks are registered or if no DeviceProfileCallback exists in the chain.
  private static func resolveDeviceProfileCallback(_ journeyId: String) async -> DeviceProfileCallback? {
    guard !journeyId.isEmpty else {
      return nil
    }

    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId),
          !callbacks.isEmpty else {
      return nil
    }

    return callbacks.first(where: { $0 is DeviceProfileCallback }) as? DeviceProfileCallback
  }

  /// Converts sendable payload values to Foundation types for Obj-C bridging.
  /// - Parameter payload: The payload dictionary with Sendable values.
  /// - Returns: A dictionary with values converted to Any for Objective-C compatibility.
  private static func mapSendablePayload(_ payload: [String: any Sendable]) -> [String: Any] {
    payload.mapValues { value in
      value as Any
    }
  }
}
