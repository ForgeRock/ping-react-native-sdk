/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceProfile

/// Swift entry point for the Device Profile native module.
@objcMembers
public class RNPingDeviceProfileImpl: NSObject {

  /// Shared singleton instance.
  public static let shared = RNPingDeviceProfileImpl()

  private override init() {
    super.init()
  }

  /// Collects device profile data outside of Journey flows.
  /// - Parameters:
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - resolver: Promise resolver for the collected profile payload.
  ///   - rejecter: Promise rejecter for collection errors.
  public func collectDeviceProfile(
    _ collectors: [String],
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingDeviceProfileCommon.collectDeviceProfile(
      collectors,
      resolver: resolver,
      rejecter: rejecter
    )
  }

  /// Collects device profile data using the active Journey callback context.
  /// - Parameters:
  ///   - journeyId: Journey instance identifier.
  ///   - collectors: Ordered list of collector identifiers to execute.
  ///   - loggerId: Optional logger configuration id resolved from the Logger module.
  ///   - resolver: Promise resolver invoked once the callback submission completes (no payload is returned).
  ///   - rejecter: Promise rejecter for collection errors.
  public func collectDeviceProfileForJourney(
    _ journeyId: String,
    collectors: [String],
    loggerId: String?,
    resolver: @escaping (Any?) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      journeyId,
      collectors: collectors,
      loggerId: loggerId,
      resolver: resolver,
      rejecter: rejecter
    )
  }
}
