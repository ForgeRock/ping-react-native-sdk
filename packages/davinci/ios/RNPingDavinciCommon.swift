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

/// Seam allowing `pollDaVinci` to be exercised in bridge-level unit tests without
/// invoking `PollingCollector`'s real network/timing logic. `PollingCollector` is
/// declared `public` (not `open`) in the iOS SDK, so it cannot be subclassed
/// cross-module — conforming it to this protocol via the extension below lets test
/// doubles substitute for it with no production behavior change (`id`/`poll()` are
/// already implemented identically on the real type).
protocol PollableCollector: Sendable {
  var id: String { get }
  func poll() -> AsyncStream<PollingStatus>
}

extension PollingCollector: PollableCollector {}


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
  /// Promise resolver for poll subscription payloads.
  public typealias PollResolver = @Sendable (NSDictionary) -> Void
  /// Promise resolver for validation error array payloads.
  public typealias ErrorsResolver = @Sendable (NSArray) -> Void
  /// Promise rejecter closure type used by the DaVinci Swift bridge.
  public typealias PromiseRejecter = @Sendable (String, String, NSError?) -> Void

  /// Shared state store keyed by generated DaVinci id.
  private static let stateStore = DaVinciStateStore()
  /// Shared core registry for DaVinci instances.
  private static let davinciRegistry: Registry = CoreRuntime.davinciRegistry
  /// Lifecycle coordinator ensuring ordered configure/cleanup execution.
  private static let lifecycleCoordinator = DaVinciLifecycleCoordinator()
  /// In-flight poll tasks keyed by `subscriptionId`, grouped by `davinciId`.
  private static let pollJobStore = PollJobStore()

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
    pollJobStore.removeAll()
    await lifecycleCoordinator.enqueue {
      stateStore.removeAll()
      await davinciRegistry.removeAll()
    }
  }

#if DEBUG
  /// Registers a `ContinueNode` for `davinciId` without a full `configureDaVinci` call.
  ///
  /// - Note: Test-only seam so `pollDaVinci` tests can install a fake `PollingCollector`
  ///   on a node without exercising native workflow construction.
  static func _setContinueNodeForTesting(davinciId: String, node: ContinueNode) {
    stateStore.setNode(davinciId: davinciId, node: node)
  }

  /// Test-only seam exposing the number of poll tasks currently tracked for
  /// `davinciId`, to verify natural-completion cleanup doesn't leak tracking entries.
  static func _trackedPollTaskCount(for davinciId: String) -> Int {
    pollJobStore.trackedTaskCount(for: davinciId)
  }

  /// Stores an arbitrary `Node` for `davinciId`, mirroring what `start`/`next`
  /// persist after a workflow step. Unlike `_setContinueNodeForTesting`, this
  /// accepts non-`ContinueNode` payloads — e.g. an `ErrorNode` whose retryable
  /// `continueNode` the state store must retain as the active node.
  static func _setNodeStateForTesting(davinciId: String, node: Node) {
    stateStore.setNode(davinciId: davinciId, node: node)
  }

  /// Test-only seam resolving the active `ContinueNode` stored for `davinciId`.
  static func _activeContinueNodeForTesting(for davinciId: String) -> ContinueNode? {
    stateStore.activeContinueNode(for: davinciId)
  }
#endif

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
        idRef.value = await davinciRegistry.register(DaVinciHandle(davinci: davinci, loggerId: payload.loggerId, protectLoggerId: payload.protect?.loggerId))
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

  /// Validates a single collector value in isolation, without submitting the form via `next()`.
  ///
  /// Applies `value` onto the live collector identified by `collectorKey` using the same
  /// `DaVinciCollectorValueApplier.apply()` machinery `next()` uses, then runs native
  /// `Validator.validate()` on that collector and returns its errors.
  ///
  /// - Remarks: This is a command-query hybrid, not a pure check — applying `value` mutates the
  ///   live collector backing the in-progress submission, so it becomes part of what a
  ///   subsequent `next()` call submits even if the caller only intended a speculative preview.
  ///   An empty result array means either "no validation errors" or "this collector has no
  ///   `Validator`" — not a positive confirmation the value was checked.
  ///
  /// - Note: iOS naturally serializes concurrent bridge calls onto the `@MainActor`, so a
  ///   `validate()` call cannot race a concurrent `next()`/`validate()` call mutating the same
  ///   node's collectors. Android has no equivalent guard (`launchBridge` runs on the shared
  ///   `Dispatchers.Default` pool with no per-`davinciId` mutex/actor) — see the Android
  ///   `RNPingDavinciCommon.validate` implementation for the documented trade-off.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - collectorKey: Key of the collector to validate.
  ///   - input: Bridge input in the same `{ collectors: [{ key, value }] }` shape `next()`
  ///     uses, containing exactly the single collector entry to validate.
  ///   - resolver: Promise resolver called with the collector's validation error array.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func validate(
    _ davinciId: String,
    collectorKey: String,
    input: NSDictionary,
    resolver: @escaping ErrorsResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSArray>(resolver: resolver, rejecter: rejecter)
    let mutations: [DaVinciCollectorValueApplier.CollectorMutation]
    do {
      mutations = try DaVinciCollectorValueApplier.parseInput(input)
    } catch {
      promise.reject(DaVinciErrorMapper.map(error, code: .validateError))
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
        _ = try DaVinciCollectorValueApplier.apply(currentNode, mutations: mutations)
      } catch {
        promise.reject(DaVinciErrorMapper.map(error, code: .validateError))
        return
      }

      // apply() succeeded above, so collectorKey is guaranteed to resolve to a collector
      // on currentNode — the nil branches below are unreachable in practice.
      guard let collector = currentNode.collectors.first(where: { $0.id == collectorKey }) else {
        promise.resolve([] as NSArray)
        return
      }

      guard let validator = collector as? Validator else {
        promise.resolve([] as NSArray)
        return
      }

      let validationErrors = validator.validate()
      let encodedErrors: [[String: Any]]
      if let booleanCollector = collector as? BooleanCollector,
         booleanCollector.required,
         !booleanCollector.value {
        // TODO-SDK-PARITY: iOS emits REGEX_ERROR for a required unchecked Boolean
        // when errorMessage is present, while Android emits REQUIRED. Normalize
        // the bridge contract to the platform-independent REQUIRED error.
        encodedErrors = [["code": "REQUIRED"]]
      } else {
        encodedErrors = DaVinciNodeMapper.encodeValidationErrors(validationErrors)
      }
      promise.resolve(encodedErrors as NSArray)
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
  /// Also cancels any outstanding poll `Task`s for `davinciId` — a safety net so a
  /// disposed instance never leaves an orphaned poll running after the caller stops
  /// listening for its events.
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
    pollJobStore.cancelAll(for: davinciId)
    Task { @MainActor in
      stateStore.clearNodeState(for: davinciId)
      await davinciRegistry.remove(davinciId)
      promise.resolve(())
    }
  }

  /// Starts streaming polling status updates for the active `PollingCollector`.
  ///
  /// The poll `Task` is registered in the shared job store — keyed by `davinciId` —
  /// before the promise resolves. Swift schedules a `Task`'s body asynchronously
  /// rather than running it inline, so the actual `AsyncStream` consumption (and
  /// therefore the first possible JS event) cannot begin until after this function
  /// returns and the promise has resolved, mirroring the ordering guarantee on the
  /// Android side.
  ///
  /// - Note: `PollingCollector.poll()` exposes no cancellation hook (no
  ///   `onTermination`, no `cancel()`) — a platform constraint of the iOS SDK. Once
  ///   started, this `Task` runs to its own terminal state unless `dispose`/
  ///   `cleanup` cancels it as a teardown safety net.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - options: Bridge map with an optional `key` selecting which
  ///     `PollingCollector` to poll when more than one is present on the active
  ///     node; the first one is used when `key` is absent.
  ///   - resolver: Promise resolver called with `{ subscriptionId }`.
  ///   - rejecter: Promise rejecter called with `GenericError`.
  @objc
  public static func pollDaVinci(
    _ davinciId: String,
    options: NSDictionary,
    resolver: @escaping PollResolver,
    rejecter: @escaping PromiseRejecter
  ) {
    let promise = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let node = stateStore.activeContinueNode(for: davinciId) else {
      promise.reject(
        DaVinciErrorMapper.state(
          code: .pollError,
          message: "No active ContinueNode found for davinci id=\(davinciId)"
        )
      )
      return
    }

    let requestedKey = options["key"] as? String
    let collectors = node.collectors.compactMap { $0 as? any PollableCollector }
    let collector = requestedKey.map { key in collectors.first { $0.id == key } } ?? collectors.first
    guard let collector else {
      promise.reject(
        DaVinciErrorMapper.state(
          code: .pollError,
          message: "No active PollingCollector found for davinci id=\(davinciId)"
            + (requestedKey.map { " with key=\($0)" } ?? "")
        )
      )
      return
    }

    let subscriptionId = UUID().uuidString
    let task = Task {
      for await status in collector.poll() {
        if Task.isCancelled { break }
        emitPollingStatus(davinciId: davinciId, subscriptionId: subscriptionId, status: status)
      }
      pollJobStore.remove(davinciId: davinciId, subscriptionId: subscriptionId)
    }
    pollJobStore.register(davinciId: davinciId, subscriptionId: subscriptionId, task: task)

    promise.resolve(["subscriptionId": subscriptionId] as NSDictionary)
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

  /// Resolves a logger from the core registry by logger handle id.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS.
  /// - Returns: Native logger instance, or `nil` when missing or unresolvable.
  private static func resolveLoggerFromCore(_ loggerId: String?) async -> Logger? {
    guard let loggerId, !loggerId.isEmpty else { return nil }
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

  /// Emits one `PollingStatus` tick to JS via the shared `RNPingDavinci_NativeEmit`
  /// notification, which the architecture-specific bridge module owning the event
  /// emitter gate forwards to `RCTDeviceEventEmitter`.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - subscriptionId: Subscription id returned by `pollDaVinci`.
  ///   - status: Native polling status tick.
  private static func emitPollingStatus(davinciId: String, subscriptionId: String, status: PollingStatus) {
    var body: [String: Any] = ["subscriptionId": subscriptionId, "daVinciId": davinciId]
    switch status {
    case .continue(let retryCount, let maxRetries):
      body["status"] = "continue"
      body["retryCount"] = retryCount
      body["maxRetries"] = maxRetries
    case .complete(let value):
      body["status"] = "complete"
      body["value"] = value
    case .timedOut:
      body["status"] = "timedOut"
    case .expired:
      body["status"] = "expired"
    case .error(let error):
      body["status"] = "error"
      body["error"] = ["message": error.localizedDescription]
    }
    NotificationCenter.default.post(
      name: .pingDavinciNativeEmit,
      object: nil,
      userInfo: ["eventName": RNPingDavinciEvents.pollingStatus, "eventBody": body]
    )
  }
}

/// Tracks in-flight poll `Task`s keyed by `subscriptionId`, grouped by
/// `davinciId`, so `dispose()`/`cleanup()` can cancel every outstanding poll
/// for one instance — a safety net against orphaned polls. There is no public
/// per-poll cancellation surface (neither native SDK exposes a cancellation
/// primitive for an in-flight poll), so tasks are only ever removed here on
/// natural completion or instance-scoped teardown.
///
/// - Note: `@unchecked Sendable` is used because this class owns a mutable map of
///   `Task` handles. All reads/writes are synchronized with `NSLock`.
private final class PollJobStore: @unchecked Sendable {
  private let lock = NSLock()
  private var tasksByDaVinciId = [String: [String: Task<Void, Never>]]()
  /// Tombstones `subscriptionId`s that completed before `register` was called for them.
  private var completedSubscriptions = Set<String>()

  /// Registers a poll task, keyed by `subscriptionId`, before the promise resolves.
  ///
  /// - Note: A no-op if `subscriptionId` already completed and was removed —
  ///   an unstructured `Task` can start running concurrently with the caller
  ///   that spawned it, so completion may race ahead of this call. Without this
  ///   guard, a late `register` would resurrect an already-finished task.
  func register(davinciId: String, subscriptionId: String, task: Task<Void, Never>) {
    lock.lock()
    defer { lock.unlock() }
    if completedSubscriptions.remove(subscriptionId) != nil {
      return
    }
    tasksByDaVinciId[davinciId, default: [:]][subscriptionId] = task
  }

  /// Removes a completed poll task's bookkeeping without cancelling it (it already finished).
  func remove(davinciId: String, subscriptionId: String) {
    lock.lock()
    defer { lock.unlock() }
    if tasksByDaVinciId[davinciId]?.removeValue(forKey: subscriptionId) == nil {
      completedSubscriptions.insert(subscriptionId)
    }
    if tasksByDaVinciId[davinciId]?.isEmpty == true {
      tasksByDaVinciId.removeValue(forKey: davinciId)
    }
  }

  /// Cancels every tracked poll task for `davinciId`.
  func cancelAll(for davinciId: String) {
    lock.lock()
    let tasks = tasksByDaVinciId.removeValue(forKey: davinciId).map { Array($0.values) } ?? []
    lock.unlock()
    tasks.forEach { $0.cancel() }
  }

  /// Cancels every tracked poll task, across all DaVinci instances.
  func removeAll() {
    lock.lock()
    let tasks = tasksByDaVinciId.values.flatMap { $0.values }
    tasksByDaVinciId.removeAll()
    completedSubscriptions.removeAll()
    lock.unlock()
    tasks.forEach { $0.cancel() }
  }

#if DEBUG
  /// Test-only seam returning the number of tracked poll tasks for `davinciId`.
  func trackedTaskCount(for davinciId: String) -> Int {
    lock.lock()
    defer { lock.unlock() }
    return tasksByDaVinciId[davinciId]?.count ?? 0
  }
#endif
}

/// Handle for storing DaVinci client instances.
///
/// - Note: `@unchecked Sendable` is used because upstream `DaVinci` is a reference
///   type not declared `Sendable`. This wrapper is immutable.
private final class DaVinciHandle: NativeHandle, @unchecked Sendable {
  let davinci: DaVinci
  let loggerId: String?
  let protectLoggerId: String?

  init(davinci: DaVinci, loggerId: String?, protectLoggerId: String? = nil) {
    self.davinci = davinci
    self.loggerId = loggerId
    self.protectLoggerId = protectLoggerId
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
  /// - Remarks: When `node` is an `ErrorNode` carrying a retryable continuation (native
  ///   `ErrorNode.continueNode`), that continuation is kept as the active `ContinueNode`
  ///   instead of being closed — matching native SDK behavior, where `validate()` and
  ///   `next()` are independent operations and a recoverable error does not discard the
  ///   in-progress form. The continuation is only closed once a genuinely different
  ///   `ContinueNode` (or a terminal `SuccessNode`/`FailureNode`) displaces it.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - node: Latest node received from the DaVinci workflow.
  func setNode(davinciId: String, node: Node) {
    lock.lock()
    nodeMap[davinciId] = node
    let retainedContinueNode: ContinueNode?
    switch node {
    case let continueNode as ContinueNode:
      retainedContinueNode = continueNode
    case let errorNode as ErrorNode:
      retainedContinueNode = errorNode.continueNode
    default:
      retainedContinueNode = nil
    }
    let previousContinueNode: ContinueNode?
    if let retainedContinueNode {
      previousContinueNode = continueNodeMap.updateValue(retainedContinueNode, forKey: davinciId)
    } else {
      previousContinueNode = continueNodeMap.removeValue(forKey: davinciId)
    }
    lock.unlock()
    if previousContinueNode !== retainedContinueNode {
      previousContinueNode?.close()
    }
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
