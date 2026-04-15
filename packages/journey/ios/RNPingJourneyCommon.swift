/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingJourney
import PingOrchestrate
import RNPingCore
import PingOidc

/// Serializes lifecycle operations that mutate shared Journey runtime state.
private actor JourneyLifecycleCoordinator {
  /// Tail task representing the latest enqueued lifecycle work item.
  private var tail: Task<Void, Never>?

  /// Enqueues one lifecycle operation and waits for it to finish.
  ///
  /// - Parameter operation: Async lifecycle operation.
  func enqueue(_ operation: @escaping @Sendable () async -> Void) async {
    let previous = tail
    let next = Task {
      await previous?.value
      await operation()
    }
    tail = next
    await next.value
  }
}

/// Shared iOS runtime orchestration for Journey bridge calls.
@objcMembers
public final class RNPingJourneyCommon: NSObject {
  /// Promise resolver for Journey identifiers.
  public typealias JourneyIdResolver = @Sendable (String) -> Void
  /// Promise resolver for Journey node payloads.
  public typealias NodeResolver = @Sendable (NSDictionary) -> Void
  /// Promise resolver for optional Journey session payloads.
  public typealias SessionResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for optional userinfo payloads.
  public typealias UserInfoResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for optional SSO token payloads.
  public typealias SSOTokenResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for boolean results.
  public typealias BoolResolver = @Sendable (Bool) -> Void
  /// Promise resolver for void results.
  public typealias VoidResolver = @Sendable () -> Void
  /// Promise rejecter closure type used by the Journey Swift bridge.
  public typealias PromiseRejecter = @Sendable (String, String, NSError?) -> Void

  /// Shared state store keyed by generated Journey id.
  private static let stateStore = JourneyStateStore()
  /// Shared core registry for Journey instances.
  private static let journeyRegistry: Registry = CoreRuntime.journeyRegistry
  /// Lifecycle coordinator ensuring ordered configure/cleanup execution.
  private static let lifecycleCoordinator = JourneyLifecycleCoordinator()

  /// Applies Journey callback resolver registration in serialized lifecycle order.
  private static func configureAsync() async {
    await lifecycleCoordinator.enqueue {
      CoreRuntime.setJourneyCallbackResolver { journeyId in
        stateStore.callbacks(for: journeyId)
      }
    }
  }

  /// Clears Journey runtime state in serialized lifecycle order.
  private static func cleanupAsync() async {
    await lifecycleCoordinator.enqueue {
      CoreRuntime.setJourneyCallbackResolver(nil)
      stateStore.removeAll()
      await journeyRegistry.removeAll()
    }
  }

  /// Initializes common runtime wiring for Journey bridge operations.
  @objc
  public static func configure() {
    Task {
      await configureAsync()
    }
  }

  /// Releases shared runtime state.
  @objc
  public static func cleanup() {
    Task {
      await cleanupAsync()
    }
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
    resolver: @escaping JourneyIdResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<String>(resolver: resolver, rejecter: rejecter)

    let payload: JourneyClientPayload
    do {
      payload = try JourneyConfigParser.parse(config)
    } catch {
      promise.reject(JourneyErrorMapper.map(error, code: .configError))
      return
    }

    Task { @MainActor in
      await configureAsync()
      do {
        let journey = try await JourneyClientFactory().build(payload)
        let journeyId = await journeyRegistry.register(JourneyHandle(journey: journey))
        promise.resolve(journeyId)
      } catch {
        promise.reject(JourneyErrorMapper.map(error, code: .initError))
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
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      promise.reject(
        JourneyErrorMapper.argument(
          code: .startError,
          message: "Journey name must not be empty"
        )
      )
      return
    }

    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
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
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    let mutations: [JourneyCallbackValueApplier.CallbackMutation]
    do {
      mutations = try JourneyCallbackValueApplier.parseInput(input)
    } catch {
      promise.reject(JourneyErrorMapper.map(error, code: .nextError))
      return
    }

    Task { @MainActor in
      guard let currentNode = stateStore.activeContinueNode(for: journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "No active ContinueNode found for journey id=\(journeyId)"
          )
        )
        return
      }

      do {
        if !mutations.isEmpty {
          try await JourneyCallbackValueApplier.apply(currentNode, mutations: mutations)
        }
      } catch {
        promise.reject(JourneyErrorMapper.map(error, code: .nextError))
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
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if uri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      promise.reject(
        JourneyErrorMapper.argument(
          code: .resumeError,
          message: "Resume URI must not be empty"
        )
      )
      return
    }

    guard let resumeURL = URL(string: uri) else {
      promise.reject(
        JourneyErrorMapper.argument(
          code: .resumeError,
          message: "Resume URI is invalid"
        )
      )
      return
    }

    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
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
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
        )
        return
      }

      let user = await resolveJourneyUser(journey)
      guard let user else {
        promise.resolve(nil)
        return
      }

      let tokenResult = await user.token()
      switch tokenResult {
      case .success(let token):
        promise.resolve(await bridgeSessionPayload(user: user, token: token))

      case .failure(let error):
        if isMissingAuthStateError(error) {
          promise.resolve(nil)
          return
        }
        promise.reject(JourneyErrorMapper.map(error, code: .userError))
      }
    }
  }

  /// Refreshes active session data for a Journey user.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with refreshed session payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func refresh(
    _ journeyId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
        )
        return
      }

      let user = await resolveJourneyUser(journey)
      guard let user else {
        promise.resolve(nil)
        return
      }

      let tokenResult = await user.refresh()
      switch tokenResult {
      case .success(let token):
        promise.resolve(await bridgeSessionPayload(user: user, token: token))

      case .failure(let error):
        if isMissingAuthStateError(error) {
          promise.resolve(nil)
          return
        }
        promise.reject(JourneyErrorMapper.map(error, code: .userError))
      }
    }
  }

  /// Revokes active Journey user tokens.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with `true` when revoke succeeds.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func revoke(
    _ journeyId: String,
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Bool>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
        )
        return
      }

      let user = await resolveJourneyUser(journey)
      await user?.revoke()
      promise.resolve(true)
    }
  }

  /// Resolves active Journey userinfo payload.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with userinfo payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func userinfo(
    _ journeyId: String,
    resolver: @escaping UserInfoResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
        )
        return
      }

      let user = await resolveJourneyUser(journey)
      guard let user else {
        promise.resolve(nil)
        return
      }

      let userInfoResult = await user.userinfo(cache: false)
      switch userInfoResult {
      case .success(let userInfo):
        promise.resolve(bridgeUserInfo(userInfo))
      case .failure(let error):
        if isMissingAuthStateError(error) {
          promise.resolve(nil)
          return
        }
        promise.reject(JourneyErrorMapper.map(error, code: .userError))
      }
    }
  }

  /// Resolves active Journey SSO token payload.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - resolver: Promise resolver called with SSO token payload or `nil`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func ssoToken(
    _ journeyId: String,
    resolver: @escaping SSOTokenResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
        )
        return
      }

      guard let token = await journey.session() else {
        promise.resolve(nil)
        return
      }

      let payload: [String: Any] = [
        "value": token.value,
        "successUrl": token.successUrl,
        "realm": token.realm,
      ]
      promise.resolve(payload as NSDictionary)
    }
  }

  /// Resolves the active Journey user from the native Journey instance.
  ///
  /// - Parameter journey: Native Journey instance.
  /// - Returns: Resolved user handle, or `nil` when no user is available.
  private static func resolveJourneyUser(_ journey: Journey) async -> User? {
    return await journey.journeyUser()
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
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Bool>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let journey = await resolveJourney(journeyId) else {
        promise.reject(
          JourneyErrorMapper.state(
            code: .stateError,
            message: "Journey instance not found for id=\(journeyId)"
          )
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
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Void>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      stateStore.clearNodeState(for: journeyId)
      await journeyRegistry.remove(journeyId)
      promise.resolve(())
    }
  }

  /// Resolves a Journey instance from the shared core registry.
  ///
  /// - Parameter journeyId: Native Journey instance id.
  /// - Returns: Journey instance when available.
  private static func resolveJourney(_ journeyId: String) async -> Journey? {
    return (await journeyRegistry.resolve(journeyId) as? JourneyHandle)?.journey
  }

  /// Maps token and optional userinfo into a bridge-safe session payload.
  ///
  /// - Parameters:
  ///   - user: Native Journey user.
  ///   - token: OIDC token payload.
  /// - Returns: Session payload dictionary.
  private static func bridgeSessionPayload(user: User, token: Token) async -> NSDictionary {
    var payload: [String: Any] = [
      "accessToken": token.accessToken,
      "expiresIn": NSNumber(value: token.expiresIn),
    ]
    if let refreshToken = token.refreshToken {
      payload["refreshToken"] = refreshToken
    }
    let userInfoResult = await user.userinfo(cache: false)
    if case let .success(userInfo) = userInfoResult {
      payload["userInfo"] = bridgeUserInfo(userInfo)
    }
    return payload as NSDictionary
  }

  /// Returns whether an OIDC error indicates missing auth/token state.
  ///
  /// - Parameter error: OIDC error emitted by token/userinfo APIs.
  /// - Returns: `true` when no auth code/token state is available yet.
  private static func isMissingAuthStateError(_ error: OidcError) -> Bool {
    let description = String(describing: error).lowercased()
    switch error {
    case .authorizeError(_, let message):
      let normalized = (message ?? "").lowercased()
      return normalized.contains("no authcode is available") ||
        normalized.contains("please start journey to authenticate") ||
        normalized.contains("authorization code not found") ||
        description.contains("no authcode is available") ||
        description.contains("please start journey to authenticate") ||
        description.contains("authorization code not found")
    default:
      return false
    }
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

/// Handle for storing Journey client instances.
///
/// - Note: `@unchecked Sendable` is used because upstream `Journey` is a
///   reference type not declared `Sendable`. This wrapper is immutable.
private final class JourneyHandle: NativeHandle, @unchecked Sendable {
  let journey: Journey

  init(journey: Journey) {
    self.journey = journey
  }
}

/// Thread-safe Journey state store keyed by generated journey id.
///
/// - Note: `@unchecked Sendable` is used because this class owns mutable maps
///   of native Journey state. All map reads/writes are synchronized with `NSLock`.
private final class JourneyStateStore: @unchecked Sendable {
  private let lock = NSLock()
  private var nodeMap = [String: Node]()
  private var continueNodeMap = [String: ContinueNode]()

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

  /// Clears all cached Journey node state.
  func removeAll() {
    lock.lock()
    let continueNodes = Array(continueNodeMap.values)
    continueNodeMap.removeAll()
    nodeMap.removeAll()
    lock.unlock()
    continueNodes.forEach { continueNode in
      continueNode.close()
    }
  }
}
