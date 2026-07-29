/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDavinci
import PingDavinciPlugin
import PingLogger
import PingOidc
import PingOrchestrate
import RNPingCore

/// Serializes lifecycle operations that mutate shared DaVinci runtime state.
private actor DaVinciLifecycleCoordinator {
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

/// Thread-safe value box for passing results across `@Sendable` closure boundaries
/// where access is guaranteed to be sequential (write inside an awaited coordinator
/// enqueue, read after the enqueue returns).
private final class Ref<T>: @unchecked Sendable {
  var value: T?
}

/// Shared iOS runtime orchestration for DaVinci bridge calls.
@objcMembers
public final class RNPingDavinciCommon: NSObject {
  /// Promise resolver for DaVinci identifiers.
  public typealias DaVinciIdResolver = @Sendable (String) -> Void
  /// Promise resolver for DaVinci node payloads.
  public typealias NodeResolver = @Sendable (NSDictionary) -> Void
  /// Promise resolver for optional DaVinci session payloads.
  public typealias SessionResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for optional userinfo payloads.
  public typealias UserInfoResolver = @Sendable (NSDictionary?) -> Void
  /// Promise resolver for boolean results.
  public typealias BoolResolver = @Sendable (Bool) -> Void
  /// Promise resolver for void results.
  public typealias VoidResolver = @Sendable () -> Void
  /// Promise rejecter closure type used by the DaVinci Swift bridge.
  public typealias PromiseRejecter = @Sendable (String, String, NSError?) -> Void

  /// Shared state store keyed by generated DaVinci id.
  private static let stateStore = DaVinciStateStore()
  /// Shared core registry for DaVinci instances.
  private static let davinciRegistry: Registry = CoreRuntime.davinciRegistry
  /// Lifecycle coordinator ensuring ordered configure/cleanup execution.
  private static let lifecycleCoordinator = DaVinciLifecycleCoordinator()

  /// Releases shared runtime state.
  @objc
  public static func cleanup() {
    Task {
      await cleanupAsync()
    }
  }

  /// Clears DaVinci runtime state in serialized lifecycle order.
  private static func cleanupAsync() async {
    CoreRuntime.setDaVinciCollectorResolver(nil)
    await lifecycleCoordinator.enqueue {
      stateStore.removeAll()
      await davinciRegistry.removeAll()
    }
  }

  // MARK: - Bridge methods

  /// Configures a native DaVinci workflow from JS configuration.
  ///
  /// - Parameters:
  ///   - config: Bridge config payload.
  ///   - resolver: Promise resolver called with DaVinci id.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func configureDaVinci(
    _ config: NSDictionary,
    resolver: @escaping DaVinciIdResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<String>(resolver: resolver, rejecter: rejecter)

    let payload: DaVinciClientPayload
    do {
      payload = try DaVinciConfigParser.parse(config)
    } catch {
      promise.reject(DaVinciErrorMapper.map(error, code: .configError))
      return
    }

    Task { @MainActor in
      let davinci: DaVinci
      do {
        davinci = try await DaVinciClientFactory().build(payload)
      } catch {
        promise.reject(DaVinciErrorMapper.map(error, code: .initError))
        return
      }

      let idRef = Ref<String>()
      await lifecycleCoordinator.enqueue {
        CoreRuntime.setDaVinciCollectorResolver { davinciId in
          stateStore.activeContinueNode(for: davinciId).map { Array($0.collectors) }
        }
        idRef.value = await davinciRegistry.register(DaVinciHandle(davinci: davinci, loggerId: payload.loggerId))
      }
      guard let davinciId = idRef.value else {
        promise.reject(DaVinciErrorMapper.state(code: .initError, message: "Failed to register DaVinci instance"))
        return
      }
      promise.resolve(davinciId)
    }
  }

  /// Starts the DaVinci flow.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with the first node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func start(
    _ davinciId: String,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      let node = await davinci.start()
      stateStore.setNode(davinciId: davinciId, node: node)
      let logger = await resolveLogger(davinciId)
      promise.resolve(DaVinciNodeMapper.mapNode(node, logger: logger))
    }
  }

  /// Advances the active DaVinci flow node by applying collector values and calling next().
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - input: Key-indexed collector values.
  ///   - resolver: Promise resolver called with the next node payload.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func next(
    _ davinciId: String,
    input: NSDictionary,
    resolver: @escaping NodeResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    let mutations: [DaVinciCollectorValueApplier.CollectorMutation]
    do {
      mutations = try DaVinciCollectorValueApplier.parseInput(input)
    } catch {
      promise.reject(DaVinciErrorMapper.map(error, code: .nextError))
      return
    }

    Task { @MainActor in
      guard let currentNode = stateStore.activeContinueNode(for: davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "No active ContinueNode found for davinci id=\(davinciId)"
          )
        )
        return
      }

      do {
        if !mutations.isEmpty {
          _ = try DaVinciCollectorValueApplier.apply(currentNode, mutations: mutations)
        }
      } catch {
        promise.reject(DaVinciErrorMapper.map(error, code: .nextError))
        return
      }

      let nextNode = await currentNode.next()
      stateStore.setNode(davinciId: davinciId, node: nextNode)
      let logger = await resolveLogger(davinciId)
      promise.resolve(DaVinciNodeMapper.mapNode(nextNode, logger: logger))
    }
  }

  /// Resolves active session data for a DaVinci user.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with session payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func getSession(
    _ davinciId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      guard let user = await davinci.daVinciUser() else {
        promise.resolve(nil)
        return
      }

      let tokenResult = await user.token()
      switch tokenResult {
      case .success(let token):
        promise.resolve(await bridgeSessionPayload(user: user, token: token))
      case .failure(let error):
        promise.reject(DaVinciErrorMapper.map(error, code: .sessionError))
      }
    }
  }

  /// Refreshes the active DaVinci user session tokens.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with refreshed session payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func refresh(
    _ davinciId: String,
    resolver: @escaping SessionResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      guard let user = await davinci.daVinciUser() else {
        promise.resolve(nil)
        return
      }

      let tokenResult = await user.refresh()
      switch tokenResult {
      case .success(let token):
        promise.resolve(await bridgeSessionPayload(user: user, token: token))
      case .failure(let error):
        promise.reject(DaVinciErrorMapper.map(error, code: .sessionError))
      }
    }
  }

  /// Revokes active DaVinci user tokens.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with `true` when revoke completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func revoke(
    _ davinciId: String,
    resolver: @escaping BoolResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Bool>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      let user = await davinci.daVinciUser()
      await user?.revoke()
      promise.resolve(true)
    }
  }

  /// Resolves userinfo claims for the active DaVinci session.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called with userinfo payload or `nil` when no user is signed in.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func userinfo(
    _ davinciId: String,
    resolver: @escaping UserInfoResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary?>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      guard let user = await davinci.daVinciUser() else {
        promise.resolve(nil)
        return
      }

      let userInfoResult = await user.userinfo(cache: false)
      switch userInfoResult {
      case .success(let userInfo):
        promise.resolve(bridgeUserInfo(userInfo))
      case .failure(let error):
        promise.reject(DaVinciErrorMapper.map(error, code: .sessionError))
      }
    }
  }

  /// Logs out the active DaVinci user using `workflow.signOff()` which clears cookies
  /// and the OIDC session, then clears in-memory node state.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called when sign-off completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func logout(
    _ davinciId: String,
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Void>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      guard let davinci = await resolveDaVinci(davinciId) else {
        promise.reject(
          DaVinciErrorMapper.state(
            code: .stateError,
            message: "DaVinci instance not found for id=\(davinciId)"
          )
        )
        return
      }

      let result = await davinci.signOff()
      stateStore.clearNodeState(for: davinciId)
      switch result {
      case .success:
        promise.resolve(())
      case .failure(let error):
        promise.reject(DaVinciErrorMapper.map(error, code: .logoutError))
      }
    }
  }

  /// Disposes a DaVinci workflow and clears native state for that client.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - resolver: Promise resolver called when dispose completes.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func dispose(
    _ davinciId: String,
    resolver: @escaping VoidResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<Void>(resolver: resolver, rejecter: rejecter)
    Task { @MainActor in
      stateStore.clearNodeState(for: davinciId)
      await davinciRegistry.remove(davinciId)
      promise.resolve(())
    }
  }

  // MARK: - Helpers

  /// Resolves a DaVinci instance from the shared core registry.
  ///
  /// - Parameter davinciId: Native DaVinci instance id.
  /// - Returns: Native DaVinci instance, or `nil` when not registered.
  private static func resolveDaVinci(_ davinciId: String) async -> DaVinci? {
    return (await davinciRegistry.resolve(davinciId) as? DaVinciHandle)?.davinci
  }

  /// Resolves the logger configured for a DaVinci instance.
  ///
  /// - Parameter davinciId: Native DaVinci instance id.
  /// - Returns: Native logger instance, or `nil` when no logger id is registered.
  private static func resolveLogger(_ davinciId: String) async -> Logger? {
    guard
      let loggerId = (await davinciRegistry.resolve(davinciId) as? DaVinciHandle)?.loggerId,
      !loggerId.isEmpty
    else {
      return nil
    }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else {
      return nil
    }
    return handle.nativeLogger as? Logger
  }

  /// Maps token and optional userinfo into a bridge-safe session payload.
  ///
  /// - Parameters:
  ///   - user: Authenticated DaVinci user for userinfo lookup.
  ///   - token: Active OIDC token set.
  /// - Returns: Bridge-safe session dictionary containing token fields and optional userinfo.
  private static func bridgeSessionPayload(user: User, token: Token) async -> NSDictionary {
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
    return payload as NSDictionary
  }

  /// Bridges OIDC userinfo dictionaries to React Native-safe values.
  ///
  /// - Parameter userInfo: OIDC userinfo claims dictionary.
  /// - Returns: Bridge-safe NSDictionary with all values converted to primitive-compatible types.
  private static func bridgeUserInfo(_ userInfo: UserInfo) -> NSDictionary {
    var payload = [String: Any]()
    userInfo.forEach { key, value in
      payload[key] = bridgeValue(value)
    }
    return payload as NSDictionary
  }

  /// Converts values to bridge-safe dictionary/list primitive payloads.
  ///
  /// - Parameter value: Any value from the OIDC userinfo claim set.
  /// - Returns: Bridge-safe equivalent — String, NSNumber, NSDictionary, Array, NSNull, or stringified fallback.
  private static func bridgeValue(_ value: Any) -> Any {
    switch value {
    case let string as String:
      return string
    case let number as NSNumber:
      return number
    case let dictionary as [String: Any]:
      var mapped = [String: Any]()
      dictionary.forEach { key, nestedValue in
        mapped[key] = bridgeValue(nestedValue)
      }
      return mapped
    case let array as [Any]:
      return array.map { bridgeValue($0) }
    case is NSNull:
      return NSNull()
    default:
      return String(describing: value)
    }
  }
}

/// Handle for storing DaVinci client instances.
///
/// - Note: `@unchecked Sendable` is used because upstream `DaVinci` is a reference
///   type not declared `Sendable`. This wrapper is immutable.
private final class DaVinciHandle: NativeHandle, @unchecked Sendable {
  let davinci: DaVinci
  let loggerId: String?

  init(davinci: DaVinci, loggerId: String?) {
    self.davinci = davinci
    self.loggerId = loggerId
  }
}

/// Thread-safe DaVinci state store keyed by generated davinci id.
///
/// - Note: `@unchecked Sendable` is used because this class owns mutable maps of
///   native DaVinci state. All map reads/writes are synchronized with `NSLock`.
private final class DaVinciStateStore: @unchecked Sendable {
  private let lock = NSLock()
  private var nodeMap = [String: Node]()
  private var continueNodeMap = [String: ContinueNode]()

  /// Stores node state for a DaVinci id.
  ///
  /// Closes the previous ContinueNode when transitioning to a new node, mirroring the
  /// Android bridge: this clears `PasswordCollector.value` and `FlowCollector.value`
  /// before the new node takes over.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - node: Latest node received from the DaVinci workflow.
  func setNode(davinciId: String, node: Node) {
    lock.lock()
    nodeMap[davinciId] = node
    let previousContinueNode: ContinueNode?
    if let continueNode = node as? ContinueNode {
      previousContinueNode = continueNodeMap.updateValue(continueNode, forKey: davinciId)
    } else {
      previousContinueNode = continueNodeMap.removeValue(forKey: davinciId)
    }
    lock.unlock()
    previousContinueNode?.close()
  }

  /// Resolves active continue node for a DaVinci id.
  ///
  /// - Parameter davinciId: Native DaVinci instance id.
  /// - Returns: Active `ContinueNode`, or `nil` when none is stored.
  func activeContinueNode(for davinciId: String) -> ContinueNode? {
    lock.lock()
    defer { lock.unlock() }
    return continueNodeMap[davinciId]
  }

  /// Clears node state for a DaVinci id.
  ///
  /// - Parameter davinciId: Native DaVinci instance id.
  func clearNodeState(for davinciId: String) {
    lock.lock()
    nodeMap.removeValue(forKey: davinciId)
    let previousContinueNode = continueNodeMap.removeValue(forKey: davinciId)
    lock.unlock()
    previousContinueNode?.close()
  }

  /// Clears all cached DaVinci node state.
  func removeAll() {
    lock.lock()
    let continueNodes = Array(continueNodeMap.values)
    continueNodeMap.removeAll()
    nodeMap.removeAll()
    lock.unlock()
    continueNodes.forEach { $0.close() }
  }
}
