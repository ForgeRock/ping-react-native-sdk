/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import React
import PingDeviceId

/// Implementation of the native device ID bridge for React Native.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingDeviceIdImpl: NSObject {

  /// Shared singleton instance.
  @objc public static let shared = RNPingDeviceIdImpl()

  private static let defaultIdentifierResult: Result<any DeviceIdentifier, Error> = {
    do {
      return .success(try DefaultDeviceIdentifier())
    } catch {
      return .failure(error)
    }
  }()

  @objc private override init() {
    super.init()
  }

  /// Returns the default keychain-backed device identifier.
  /// - Parameters:
  ///   - resolve: Promise resolver for the identifier string.
  ///   - reject: Promise rejecter for errors.
  @objc
  public func getDefaultDeviceId(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      switch Self.defaultIdentifierResult {
      case .success(let identifier):
        do {
          let deviceId = try await identifier.id
          resolve(deviceId)
        } catch {
          reject("DEVICE_ID_ERROR", error.localizedDescription, error)
        }
      case .failure(let error):
        reject("DEVICE_ID_ERROR", error.localizedDescription, error)
      }
    }
  }
}
