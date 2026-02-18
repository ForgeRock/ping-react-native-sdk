/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingJourney
import PingOidc
import PingOrchestrate
@preconcurrency import React
import RNPingCore

/// Sendable wrapper for React promise handlers captured inside async tasks.
private final class JourneyPromiseBridge: @unchecked Sendable {
  let resolver: RCTPromiseResolveBlock
  let rejecter: RCTPromiseRejectBlock

  init(
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    self.resolver = resolver
    self.rejecter = rejecter
  }

  func resolve(_ value: Any?) {
    resolver(value)
  }
}

/// Shared iOS runtime orchestration for Journey bridge calls.
@objcMembers
public final class RNPingJourneyCommon: NSObject {
  /// Shared state store keyed by generated Journey id.
  private static let stateStore = JourneyStateStore()

  /// Initializes common runtime wiring for Journey bridge operations.
  @objc
  public static func configure() {
    CoreRuntime.setJourneyCallbackResolver { journeyId in
      stateStore.callbacks(for: journeyId)
    }
  }

  /// Releases shared runtime state.
  @objc
  public static func cleanup() {
    CoreRuntime.setJourneyCallbackResolver(nil)
    stateStore.removeAll()
  }

  /// Configures a native Journey workflow from JS configuration.
  ///
  /// - Parameters:
  ///   - config: Bridge config payload.
  ///   - resolver: Promise resolver called with Journey id.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func configureJourney(
    _ config: NSDictionary,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    configure()

    let payload: JourneyClientPayload
    do {
      payload = try JourneyConfigParser.parse(config)
    } catch {
      reject(JourneyErrorMapper.map(error, code: .configError), rejecter: promise.rejecter)
      return
    }

    Task { @MainActor in
      do {
        let journey = try await JourneyClientFactory().build(payload)
        let journeyId = stateStore.registerJourney(journey)
        promise.resolve(journeyId)
      } catch {
        reject(JourneyErrorMapper.map(error, code: .initError), rejecter: promise.rejecter)
      }
    }
  }

  /// Starts a configured Journey by name.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - journeyName: Journey/tree name to execute.
  ///   - forceAuth: Whether to force AM authentication despite active sessions.
  ///   - noSession: Whether to avoid creating/updating an AM session.
  ///   - resolver: Promise resolver called with first node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func start(
    _ journeyId: String,
    journeyName: String,
    forceAuth: Bool,
    noSession: Bool,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    if journeyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      reject(
        JourneyErrorMapper.argument(
          code: .startError,
          message: "Journey name must not be empty"
        ),
        rejecter: promise.rejecter
      )
      return
    }

    Task { @MainActor in
      guard let journey = stateStore.journey(for: journeyId) else {
        reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          ),
          rejecter: promise.rejecter
        )
        return
      }

      let node = await journey.start(journeyName) { startOptions in
        startOptions.forceAuth = forceAuth
        startOptions.noSession = noSession
      }
      stateStore.setNode(journeyId: journeyId, node: node)
      promise.resolve(JourneyNodeMapper.mapNode(node))
    }
  }

  /// Applies callback input and progresses to the next Journey node.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - input: Callback mutation payload for active continue node.
  ///   - resolver: Promise resolver called with next node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func next(
    _ journeyId: String,
    input: NSDictionary,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    let mutations: [JourneyCallbackValueApplier.CallbackMutation]
    do {
      mutations = try JourneyCallbackValueApplier.parseInput(input)
    } catch {
      reject(JourneyErrorMapper.map(error, code: .nextError), rejecter: promise.rejecter)
      return
    }

    Task { @MainActor in
      guard let currentNode = stateStore.activeContinueNode(for: journeyId) else {
        reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "No active ContinueNode found for journey id=\(journeyId)"
          ),
          rejecter: promise.rejecter
        )
        return
      }

      do {
        if !mutations.isEmpty {
          try JourneyCallbackValueApplier.apply(currentNode, mutations: mutations)
        }
      } catch {
        reject(JourneyErrorMapper.map(error, code: .nextError), rejecter: promise.rejecter)
        return
      }

      let nextNode = await currentNode.next()
      stateStore.setNode(journeyId: journeyId, node: nextNode)
      promise.resolve(JourneyNodeMapper.mapNode(nextNode))
    }
  }

  /// Resumes a suspended Journey flow with callback URI.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - uri: Resume URI from external redirect/magic-link flow.
  ///   - resolver: Promise resolver called with resumed node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func resume(
    _ journeyId: String,
    uri: String,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    if uri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      reject(
        JourneyErrorMapper.argument(
          code: .resumeError,
          message: "Resume URI must not be empty"
        ),
        rejecter: promise.rejecter
      )
      return
    }

    guard let resumeURL = URL(string: uri) else {
      reject(
        JourneyErrorMapper.argument(
          code: .resumeError,
          message: "Resume URI is invalid"
        ),
        rejecter: promise.rejecter
      )
      return
    }

    Task { @MainActor in
      guard let journey = stateStore.journey(for: journeyId) else {
        reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          ),
          rejecter: promise.rejecter
        )
        return
      }

      let node = await journey.resume(resumeURL)
      stateStore.setNode(journeyId: journeyId, node: node)
      promise.resolve(JourneyNodeMapper.mapNode(node))
    }
  }

  /// Resolves active session data for a Journey user.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with session payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func getSession(
    _ journeyId: String,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = stateStore.journey(for: journeyId) else {
        reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          ),
          rejecter: promise.rejecter
        )
        return
      }

      let user = await journey.journeyUser()
      guard let user else {
        promise.resolve(nil)
        return
      }

      let tokenResult = await user.token()
      switch tokenResult {
      case .success(let token):
        var payload: [String: Any] = [
          "accessToken": token.accessToken,
          "expiresIn": NSNumber(value: token.expiresIn)
        ]
        if let refreshToken = token.refreshToken {
          payload["refreshToken"] = refreshToken
        }
        let userInfoResult = await user.userinfo(cache: false)
        if case let .success(userInfo) = userInfoResult {
          payload["userInfo"] = bridgeUserInfo(userInfo)
        }
        promise.resolve(payload as NSDictionary)

      case .failure(let error):
        reject(JourneyErrorMapper.map(error, code: .userError), rejecter: promise.rejecter)
      }
    }
  }

  /// Logs out active Journey user and clears in-memory node state.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with `true` when logout succeeds.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func logout(
    _ journeyId: String,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = stateStore.journey(for: journeyId) else {
        reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          ),
          rejecter: promise.rejecter
        )
        return
      }

      let user = await journey.journeyUser()
      await user?.logout()
      stateStore.clearNodeState(for: journeyId)
      promise.resolve(true)
    }
  }

  /// Disposes a Journey workflow and clears native state for that client.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called when dispose completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func dispose(
    _ journeyId: String,
    resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    let promise = JourneyPromiseBridge(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      stateStore.removeJourney(for: journeyId)
      promise.resolve(nil)
    }
  }

  /// Returns registered storage identifiers used by debug tooling.
  ///
  /// - Parameters:
  ///   - resolver: Promise resolver called with storage id list.
  ///   - rejecter: Promise rejecter.
  @objc
  public static func listRegisteredStoragesFromCore(
    _ resolver: @escaping @Sendable RCTPromiseResolveBlock,
    rejecter reject: @escaping @Sendable RCTPromiseRejectBlock
  ) {
    // TODO(iOS SDK parity): expose storage handles from iOS Core runtime when needed.
    resolver([])
  }

  /// Bridges OIDC userinfo dictionaries to React Native-safe values.
  ///
  /// - Parameter userInfo: OIDC userinfo payload.
  /// - Returns: Bridge-safe userinfo payload.
  private static func bridgeUserInfo(_ userInfo: UserInfo) -> NSDictionary {
    var payload = [String: Any]()
    userInfo.forEach { key, value in
      payload[key] = bridgeValue(value)
    }
    return payload as NSDictionary
  }

  /// Converts values to bridge-safe dictionary/list primitive payloads.
  ///
  /// - Parameter value: Raw value.
  /// - Returns: Bridge-safe value.
  private static func bridgeValue(_ value: Any) -> Any {
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
    case let double as Double:
      return NSNumber(value: double)
    case let float as Float:
      return NSNumber(value: float)
    case let dictionary as [String: Any]:
      var mapped = [String: Any]()
      dictionary.forEach { key, nestedValue in
        mapped[key] = bridgeValue(nestedValue)
      }
      return mapped
    case let dictionary as [String: Sendable]:
      var mapped = [String: Any]()
      dictionary.forEach { key, nestedValue in
        mapped[key] = bridgeValue(nestedValue)
      }
      return mapped
    case let array as [Any]:
      return array.map { bridgeValue($0) }
    case let array as [Sendable]:
      return array.map { bridgeValue($0) }
    case is NSNull:
      return NSNull()
    default:
      return String(describing: value)
    }
  }
}

/// Thread-safe Journey state store keyed by generated journey id.
private final class JourneyStateStore: @unchecked Sendable {
  private let lock = NSLock()
  private var journeyMap = [String: Journey]()
  private var nodeMap = [String: Node]()
  private var continueNodeMap = [String: ContinueNode]()

  /// Registers a Journey instance and returns generated id.
  ///
  /// - Parameter journey: Native Journey instance.
  /// - Returns: Generated Journey id.
  func registerJourney(_ journey: Journey) -> String {
    lock.lock()
    defer { lock.unlock() }
    let journeyId = UUID().uuidString
    journeyMap[journeyId] = journey
    return journeyId
  }

  /// Resolves Journey by id.
  ///
  /// - Parameter journeyId: Journey id.
  /// - Returns: Journey instance when available.
  func journey(for journeyId: String) -> Journey? {
    lock.lock()
    defer { lock.unlock() }
    return journeyMap[journeyId]
  }

  /// Stores node state for Journey id.
  ///
  /// - Parameters:
  ///   - journeyId: Journey id.
  ///   - node: Latest node.
  func setNode(journeyId: String, node: Node) {
    lock.lock()
    nodeMap[journeyId] = node
    let previousContinueNode: ContinueNode?
    if let continueNode = node as? ContinueNode {
      previousContinueNode = continueNodeMap.updateValue(continueNode, forKey: journeyId)
    } else {
      previousContinueNode = continueNodeMap.removeValue(forKey: journeyId)
    }
    lock.unlock()
    previousContinueNode?.close()
  }

  /// Resolves active continue node for Journey id.
  ///
  /// - Parameter journeyId: Journey id.
  /// - Returns: Active continue node when available.
  func activeContinueNode(for journeyId: String) -> ContinueNode? {
    lock.lock()
    defer { lock.unlock() }
    return continueNodeMap[journeyId]
  }

  /// Resolves active callbacks for Journey id.
  ///
  /// - Parameter journeyId: Journey id.
  /// - Returns: Active callback list.
  func callbacks(for journeyId: String) -> [Any]? {
    lock.lock()
    defer { lock.unlock() }
    return continueNodeMap[journeyId]?.callbacks.map { $0 }
  }

  /// Clears node state for Journey id.
  ///
  /// - Parameter journeyId: Journey id.
  func clearNodeState(for journeyId: String) {
    lock.lock()
    nodeMap.removeValue(forKey: journeyId)
    let previousContinueNode = continueNodeMap.removeValue(forKey: journeyId)
    lock.unlock()
    previousContinueNode?.close()
  }

  /// Removes Journey instance and associated node state.
  ///
  /// - Parameter journeyId: Journey id.
  func removeJourney(for journeyId: String) {
    clearNodeState(for: journeyId)
    lock.lock()
    journeyMap.removeValue(forKey: journeyId)
    lock.unlock()
  }

  /// Clears all Journey runtime state.
  func removeAll() {
    lock.lock()
    let continueNodes = Array(continueNodeMap.values)
    continueNodeMap.removeAll()
    nodeMap.removeAll()
    journeyMap.removeAll()
    lock.unlock()
    continueNodes.forEach { continueNode in
      continueNode.close()
    }
  }
}
