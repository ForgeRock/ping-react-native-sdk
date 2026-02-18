/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceProfile
import PingLogger
import RNPingCore
import RNPingLogger

/// Shared device profile collection logic for React Native iOS bridges.
@objcMembers
public class RNPingDeviceProfileCommon: NSObject {

  /// Stable error codes emitted by the Device Profile module.
  ///
  /// Keep these in sync with JS `DeviceProfileErrorCode` and Android `DeviceProfileErrorCodes`.
  private enum DeviceProfileErrorCode: String {
    case locationUnavailable = "DEVICE_PROFILE_LOCATION_UNAVAILABLE"
    case callbackNotFound = "DEVICE_PROFILE_CALLBACK_NOT_FOUND"
    case collectError = "DEVICE_PROFILE_COLLECT_ERROR"
  }

  /// Collects device profile data outside of Journey flows.
  /// - Parameters:
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - resolver: Promise resolver for the collected profile payload.
  ///   - rejecter: Promise rejecter for collection errors.
  /// - Note: Rejects with a `GenericError` payload on failure.
  @objc
  public static func collectDeviceProfile(
    _ collectors: [String],
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
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
        let mapped = GenericError(
          type: .internalError,
          error: DeviceProfileErrorCode.collectError.rawValue,
          message: "Failed to collect device profile: \(error.localizedDescription)"
        )
        reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
      }
    }
  }

  /// Collects device profile data using the active Journey callback context.
  /// - Parameters:
  ///   - journeyId: Journey instance identifier.
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - loggerId: Optional logger configuration id resolved from the Logger module.
  ///   - resolver: Promise resolver for the collected profile payload.
  ///   - rejecter: Promise rejecter for collection errors.
  /// - Note: Rejects with a `GenericError` payload on failure.
  @objc
  public static func collectDeviceProfileForJourney(
    _ journeyId: String,
    collectors: [String],
    loggerId: String?,
    resolver: @escaping (Any?) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    let isLoggerConfigured = RNPingLoggerImpl.shared.applyLogger(loggerId)
    let locationRequested = collectors.contains("location")
    let metadataCollectors = buildCollectors(from: collectors, includeLocation: false)
    let metadataRequested = !metadataCollectors.isEmpty

    Task {
      guard let callback = await resolveDeviceProfileCallback(journeyId) else {
        let error = GenericError(
          type: .stateError,
          error: DeviceProfileErrorCode.callbackNotFound.rawValue,
          message: "No active Device Profile callback found for journey \(journeyId)."
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await callback.collect { config in
        if isLoggerConfigured {
          config.logger = LogManager.logger
        }
        config.metadata = callback.metadata && metadataRequested
        config.location = callback.location && locationRequested
        config.collectors { metadataCollectors }
      }

      switch result {
      case .success:
        resolver(createJourneyResultPayload(type: "success"))
      case .failure(let error):
        let mapped = GenericError(
          type: .internalError,
          error: DeviceProfileErrorCode.collectError.rawValue,
          message: "Failed to collect device profile for journey \(journeyId): \(error.localizedDescription)"
        )
        reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
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

  private static func createJourneyResultPayload(
    type: String,
    code: String? = nil,
    message: String? = nil
  ) -> NSDictionary {
    let payload = NSMutableDictionary()
    payload["type"] = type
    if let code = code {
      payload["code"] = code
    }
    if let message = message {
      payload["message"] = message
    }
    return payload
  }

}
