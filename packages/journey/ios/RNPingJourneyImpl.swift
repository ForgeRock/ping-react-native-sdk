/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Swift entry point used by the Obj-C++ Journey bridge.
@objcMembers
public final class RNPingJourneyImpl: NSObject, @unchecked Sendable {
  /// Promise resolver for Journey identifiers.
  public typealias JourneyIdResolver = @Sendable (String) -> Void
  /// Promise resolver for Journey node payloads.
  public typealias NodeResolver = @Sendable (NSDictionary) -> Void
  /// Promise resolver for optional Journey session payloads.
  public typealias SessionResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for boolean results.
  public typealias BoolResolver = @Sendable (Bool) -> Void
  /// Promise resolver for void results.
  public typealias VoidResolver = @Sendable () -> Void
  /// Promise rejecter closure type used by the Journey Swift bridge.
  public typealias PromiseRejecter = @Sendable (String, String, NSError?) -> Void

  /// Shared singleton instance.
  @objc public static let shared = RNPingJourneyImpl()

  private override init() {
    super.init()
  }

  /// Cleans up native resources when the bridge is invalidated.
  @objc
  public func invalidate() {
    RNPingJourneyCommon.cleanup()
  }

  /// Configures the native Journey runtime for one client instance.
  ///
  /// - Parameters:
  ///   - config: Journey configuration payload from JS.
  ///   - resolver: Promise resolver called with Journey id.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(configureJourney:resolver:rejecter:)
  public func configureJourney(
    _ config: NSDictionary,
    resolver: @escaping JourneyIdResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.configureJourney(config, resolver: resolver, rejecter: rejecter)
  }

  /// Starts Journey execution by tree name.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - journeyName: Journey/tree name.
  ///   - options: Optional start flags.
  ///   - resolver: Promise resolver called with first node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(start:journeyName:options:resolver:rejecter:)
  public func start(
    _ journeyId: String,
    journeyName: String,
    options: NSDictionary?,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let forceAuth = options?["forceAuth"] as? Bool ?? false
    let noSession = options?["noSession"] as? Bool ?? false
    RNPingJourneyCommon.start(
      journeyId,
      journeyName: journeyName,
      forceAuth: forceAuth,
      noSession: noSession,
      resolver: resolver,
      rejecter: rejecter
    )
  }

  /// Applies callback input and advances Journey to the next node.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - nodeId: Legacy node id argument kept for bridge compatibility.
  ///   - input: Callback mutation payload.
  ///   - resolver: Promise resolver called with next node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(next:nodeId:input:resolver:rejecter:)
  public func next(
    _ journeyId: String,
    nodeId: String,
    input: NSDictionary,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    _ = nodeId
    RNPingJourneyCommon.next(journeyId, input: input, resolver: resolver, rejecter: rejecter)
  }

  /// Resumes a suspended Journey flow.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - uri: Resume URI from redirect/magic-link flow.
  ///   - resolver: Promise resolver called with resumed node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(resume:uri:resolver:rejecter:)
  public func resume(
    _ journeyId: String,
    uri: String,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.resume(journeyId, uri: uri, resolver: resolver, rejecter: rejecter)
  }

  /// Resolves session details for an active Journey user.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with session payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(getSession:resolver:rejecter:)
  public func getSession(
    _ journeyId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.getSession(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Refreshes session details for an active Journey user.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with refreshed session payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(refresh:resolver:rejecter:)
  public func refresh(
    _ journeyId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.refresh(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Revokes active Journey user token set.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with `true` when revoke succeeds.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(revoke:resolver:rejecter:)
  public func revoke(
    _ journeyId: String,
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.revoke(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Resolves userinfo for an active Journey user.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with userinfo payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(userinfo:resolver:rejecter:)
  public func userinfo(
    _ journeyId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.userinfo(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Resolves SSO token payload for an active Journey session.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with SSO token payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(ssoToken:resolver:rejecter:)
  public func ssoToken(
    _ journeyId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.ssoToken(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Logs out active Journey user and clears node state.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called with `true` on success.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(logout:resolver:rejecter:)
  public func logout(
    _ journeyId: String,
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.logout(journeyId, resolver: resolver, rejecter: rejecter)
  }

  /// Disposes one Journey client and clears associated native state.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey id.
  ///   - resolver: Promise resolver called when dispose completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc(dispose:resolver:rejecter:)
  public func dispose(
    _ journeyId: String,
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    RNPingJourneyCommon.dispose(journeyId, resolver: resolver, rejecter: rejecter)
  }
}
