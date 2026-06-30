/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Swift entry point used by the Obj-C++ DaVinci bridge.
@objcMembers
public final class RNPingDavinciImpl: NSObject, @unchecked Sendable {
  /// Promise resolver for DaVinci identifiers.
  public typealias DaVinciIdResolver = @Sendable (String) -> Void
  /// Promise resolver for DaVinci node payloads.
  public typealias NodeResolver = @Sendable (NSDictionary) -> Void
  /// Promise resolver for optional DaVinci session payloads.
  public typealias SessionResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for optional DaVinci userinfo payloads.
  public typealias UserInfoResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for boolean results.
  public typealias BoolResolver = @Sendable (Bool) -> Void
  /// Promise resolver for void results.
  public typealias VoidResolver = @Sendable () -> Void
  /// Promise rejecter closure type used by the DaVinci Swift bridge.
  public typealias PromiseRejecter = @Sendable (String, String, NSError?) -> Void

  /// Shared singleton instance.
  @objc public static let shared = RNPingDavinciImpl()

  private override init() {
    super.init()
  }

  /// Cleans up native resources when the bridge is invalidated.
  @objc
  public func invalidate() {
    RNPingDavinciCommon.cleanup()
  }

  /// Configures the native DaVinci runtime for one client instance.
  ///
  /// - Parameters:
  ///   - config: Bridge config payload from JavaScript.
  ///   - resolver: Promise resolver called with the DaVinci instance id.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(configureDaVinci:resolver:rejecter:)
  public func configureDaVinci(
    _ config: NSDictionary,
    resolver: @escaping DaVinciIdResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.configureDaVinci(config, resolver: resolver, rejecter: rejecter)
  }

  /// Starts DaVinci execution.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with the first node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(start:resolver:rejecter:)
  public func start(
    _ davinciId: String,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.start(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Applies collector input and advances DaVinci to the next node.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - input: Key-indexed collector values from JavaScript.
  ///   - resolver: Promise resolver called with the next node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(next:input:resolver:rejecter:)
  public func next(
    _ davinciId: String,
    input: NSDictionary,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.next(davinciId, input: input, resolver: resolver, rejecter: rejecter)
  }

  /// Resolves session details for an active DaVinci user.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with session payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(getSession:resolver:rejecter:)
  public func getSession(
    _ davinciId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.getSession(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Refreshes session details for an active DaVinci user.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with refreshed session payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(refresh:resolver:rejecter:)
  public func refresh(
    _ davinciId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.refresh(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Revokes active DaVinci user token set.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with `true` when revoke completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(revoke:resolver:rejecter:)
  public func revoke(
    _ davinciId: String,
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.revoke(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Resolves userinfo for an active DaVinci user.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with userinfo payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(userinfo:resolver:rejecter:)
  public func userinfo(
    _ davinciId: String,
    resolver: @escaping UserInfoResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.userinfo(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Logs out active DaVinci user and clears node state.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called when sign-off completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(logout:resolver:rejecter:)
  public func logout(
    _ davinciId: String,
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.logout(davinciId, resolver: resolver, rejecter: rejecter)
  }

  /// Disposes one DaVinci client and clears associated native state.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called when dispose completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(dispose:resolver:rejecter:)
  public func dispose(
    _ davinciId: String,
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingDavinciCommon.dispose(davinciId, resolver: resolver, rejecter: rejecter)
  }
}
