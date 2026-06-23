/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingCommons
import PingLogger
import PingOath
import PingTamperDetector
import React
import RNPingCore

/// Shared execution logic for the OATH React Native iOS bridge.
///
/// This class maintains a handle-based registry that maps opaque `String`
/// handles (UUIDs) to live `OathClient` instances. The registry pattern
/// allows a single React Native app to own multiple clients simultaneously.
/// Each JS `create` call produces exactly one registry entry; `close` removes it.
///
/// All public entry points are `@objc static` so they can be called from
/// both the TurboModule (`RNPingOath.mm`) and the classic bridge
/// (`RNPingOathClassic.mm`) without duplicating logic.
///
/// Ancillary logic lives in sibling files:
/// - ``OathErrorMapper`` — maps native errors to `GenericError`
/// - ``OathErrorCodes`` — stable error code strings
@objcMembers
public class RNPingOathCommon: NSObject {

  /// Lock that serializes all access to ``registry``.
  ///
  /// React Native may invoke bridge methods on a background serial queue
  /// while `close` runs on the main thread, so every read/write of
  /// ``registry`` must be guarded by this lock.
  private static let registryLock = NSLock()

  /// Handle-keyed registry of live `OathClient` instances.
  ///
  /// Marked `nonisolated(unsafe)` because Swift 6 strict concurrency
  /// checking cannot see the manual `registryLock` protection. Access is
  /// always serialized through ``registryLock``.
  private nonisolated(unsafe) static var registry: [String: OathClient] = [:]

  // MARK: - Registry management

  /// Closes all live `OathClient` instances and removes them from the handle registry.
  ///
  /// Each client's `close()` is called before the registry is cleared so that any
  /// in-memory caches, native observers, or other resources held by future SDK versions
  /// are released explicitly, mirroring the Android implementation which cancels its
  /// coroutine scope before clearing the registry.
  ///
  /// Call this during module teardown (from `invalidate()` in both the TurboModule and
  /// classic bridge implementations).
  @objc
  public static func cleanup() {
    registryLock.lock()
    let clients = Array(registry.values)
    registry.removeAll()
    registryLock.unlock()
    Task {
      for client in clients {
        try? await client.close()
      }
    }
  }

  // MARK: - Public entry points

  /// Resolves a `PingLogger.Logger` from the shared `CoreRuntime` logger registry.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS, or `nil` when no logger
  ///   was provided.
  /// - Returns: Native logger instance, or `nil` when `loggerId` is blank or no
  ///   matching handle is registered.
  private static func resolveLoggerFromCore(_ loggerId: String?) async -> PingLogger.Logger? {
    guard let loggerId, !loggerId.isEmpty else { return nil }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else {
      return nil
    }
    return handle.nativeLogger as? PingLogger.Logger
  }

  /// Creates a new `OathClient` and stores it in the handle registry.
  ///
  /// The returned handle is an opaque UUID string that JS must pass to every
  /// subsequent operation call.
  ///
  /// - Parameters:
  ///   - config: NSDictionary bridged from JS. Consumes `loggerId`,
  ///     `timeout` (seconds — assigned directly to `OathConfiguration.timeoutMs` which,
  ///     despite the misleading name, stores seconds as `TimeInterval`),
  ///     `enableCredentialCache`, `encryptionEnabled`, `storageId`, and `policyEvaluatorId`.
  ///     The iOS-only `encryptionEnabled` key is already filtered by the JS layer on Android
  ///     and will not be present in Android calls.
  ///   - resolver: Promise resolver — receives the handle `String` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func create(
    _ config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSString>(resolver: resolver, rejecter: rejecter)
    let loggerId = config["loggerId"] as? String
    let timeoutSeconds: Double? = (config["timeout"] as? NSNumber)?.doubleValue
    // Note: RN bridges JS booleans as __NSCFBoolean — a tagged NSNumber subclass.
    // `as? NSNumber` then `.boolValue` is intentional: switching to `as? Bool`
    // returns nil for NSNumber-wrapped booleans on the classic bridge invocation
    // path, which would silently drop these fields.
    let enableCredentialCacheValue: Bool? = (config["enableCredentialCache"] as? NSNumber)?.boolValue
    let encryptionEnabledValue: Bool? = (config["encryptionEnabled"] as? NSNumber)?.boolValue
    let storageId = config["storageId"] as? String
    let policyEvaluatorId = config["policyEvaluatorId"] as? String
    Task {
      do {
        let resolvedLogger = await resolveLoggerFromCore(loggerId)

        // Resolve OATH storage from the CoreRuntime registry when a storageId is present.
        // When absent, OathClient uses its own default OathKeychainStorage.
        let resolvedStorage: (any OathStorage)?
        if let storageId {
          guard let handle = await CoreRuntime.oathStorageConfigRegistry.resolve(storageId) as? OathStorageConfigHandleContract else {
            handlers.reject(GenericError(
              type: .argumentError,
              error: OathErrorCodes.initializationFailed.rawValue,
              message: "Unresolvable storageId: \(storageId)"
            ))
            return
          }
          let securityOptions = OathKeychainSecurityOptions(
            requireBiometrics: handle.requireBiometrics ?? false,
            requireDevicePasscode: handle.requireDevicePasscode ?? false,
            biometricPrompt: handle.biometricPrompt,
            accessGroup: handle.accessGroup
          )
          resolvedStorage = OathKeychainStorage(
            service: handle.service ?? "com.pingidentity.oath",
            securityOptions: securityOptions
          )
        } else {
          resolvedStorage = nil
        }

        // Resolve the policy evaluator descriptor from the registry and build a native
        // MfaPolicyEvaluator. When the descriptor's loggerId is nil, the evaluator
        // inherits the logger resolved from OathClientConfig.loggerId (logger inheritance).
        // Unresolvable ids are rejected eagerly — passing a stale handle is a caller mistake.
        let resolvedPolicyEvaluator: MfaPolicyEvaluator?
        if let policyEvaluatorId {
          guard let handle = await CoreRuntime.oathPolicyEvaluatorRegistry.resolve(policyEvaluatorId)
            as? OathPolicyEvaluatorConfigHandleContract else {
            handlers.reject(GenericError(
              type: .argumentError,
              error: OathErrorCodes.initializationFailed.rawValue,
              message: "Unresolvable policyEvaluatorId: \(policyEvaluatorId)"
            ))
            return
          }
          // When the descriptor carries a loggerId, use that logger for the evaluator.
          // Otherwise fall back to the logger resolved from OathClientConfig.loggerId.
          let evaluatorLogger = await resolveLoggerFromCore(handle.loggerId) ?? resolvedLogger
          let nativePolicies: [any MfaPolicy] = handle.policies.map { policy in
            switch policy {
            case .biometricAvailable: return BiometricAvailablePolicy()
            case .deviceTampering: return DeviceTamperingPolicy()
            }
          }
          resolvedPolicyEvaluator = MfaPolicyEvaluator.create { config in
            config.policies = nativePolicies
            if let evaluatorLogger {
              config.logger = evaluatorLogger
            }
          }
        } else {
          resolvedPolicyEvaluator = nil
        }

        let client = try await OathClient.createClient { oathConfig in
          if let resolvedLogger {
            oathConfig.logger = resolvedLogger
          }
          if let timeoutSeconds {
            // Direct assignment — JS sends seconds and `OathConfiguration.timeoutMs`
            // stores seconds (TimeInterval), so no conversion needed. The field name
            // is misleading (it has `Ms` suffix) but the unit is seconds.
            oathConfig.timeoutMs = timeoutSeconds
          }
          if let enableCredentialCacheValue {
            oathConfig.enableCredentialCache = enableCredentialCacheValue
          }
          if let encryptionEnabledValue {
            oathConfig.encryptionEnabled = encryptionEnabledValue
          }
          if let resolvedStorage {
            oathConfig.storage = resolvedStorage
          }
          if let resolvedPolicyEvaluator {
            oathConfig.policyEvaluator = resolvedPolicyEvaluator
          }
        }
        let handle = UUID().uuidString
        registryLock.withLock {
          registry[handle] = client
        }
        handlers.resolve(handle as NSString)
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Adds a new OATH credential from an `otpauth://` URI.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - uri: The `otpauth://` URI string encoding the credential parameters.
  ///   - resolver: Promise resolver — receives the encoded credential `NSDictionary` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func addCredentialFromUri(
    _ handle: String,
    uri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        let credential = try await client.addCredentialFromUri(uri)
        handlers.resolve(encodeCredential(credential))
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Retrieves a single OATH credential by its identifier.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - credentialId: The unique identifier of the credential to retrieve.
  ///   - resolver: Promise resolver — receives the encoded credential `NSDictionary`, or `NSNull` if not found.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func getCredential(
    _ handle: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<AnyObject>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        if let credential = try await client.getCredential(credentialId) {
          handlers.resolve(encodeCredential(credential))
        } else {
          handlers.resolve(NSNull())
        }
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Retrieves all OATH credentials stored in the client.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - resolver: Promise resolver — receives an `NSArray` of encoded credential dictionaries.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func getCredentials(
    _ handle: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSArray>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        let credentials = try await client.getCredentials()
        let encoded = credentials.map { encodeCredential($0) } as NSArray
        handlers.resolve(encoded)
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Saves (updates) an existing OATH credential.
  ///
  /// The `credential` dictionary is decoded to extract the credential `id` and
  /// the mutable display fields (`displayIssuer`, `displayAccountName`). The
  /// stored credential is then fetched from the native client — which carries
  /// the real `secretKey` already loaded from keychain — and only its mutable
  /// display fields are overwritten before being forwarded to `client.saveCredential`.
  /// This ensures `OathCredential.validate()` is satisfied and the secret is never
  /// lost or re-encoded across the bridge.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - credential: JS credential payload to decode and save.
  ///   - resolver: Promise resolver — receives the saved credential `NSDictionary` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func saveCredential(
    _ handle: String,
    credential: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    guard let decoded = decodeCredential(credential, rejecter: rejecter) else {
      return
    }
    Task {
      do {
        guard var stored = try await client.getCredential(decoded.id) else {
          handlers.reject(OathErrorMapper.mapError(OathError.credentialNotFound(decoded.id)))
          return
        }
        stored.displayIssuer = decoded.displayIssuer
        stored.displayAccountName = decoded.displayAccountName
        let saved = try await client.saveCredential(stored)
        handlers.resolve(encodeCredential(saved))
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Deletes an OATH credential by its identifier.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - credentialId: The unique identifier of the credential to delete.
  ///   - resolver: Promise resolver — receives `NSNumber(value: true)` if deleted, `NSNumber(value: false)` otherwise.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func deleteCredential(
    _ handle: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        let result = try await client.deleteCredential(credentialId)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Generates an OATH code for the specified credential.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - credentialId: The unique identifier of the credential.
  ///   - resolver: Promise resolver — receives the generated code as `NSString`.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func generateCode(
    _ handle: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSString>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        let code = try await client.generateCode(credentialId)
        handlers.resolve(code as NSString)
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Generates an OATH code with validity metadata for the specified credential.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - credentialId: The unique identifier of the credential.
  ///   - resolver: Promise resolver — receives an `NSDictionary` with keys:
  ///     `code`, `timeRemaining`, `counter`, `progress`, `totalPeriod`.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func generateCodeWithValidity(
    _ handle: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handle) else {
      handlers.reject(stateError())
      return
    }
    Task {
      do {
        let info = try await client.generateCodeWithValidity(credentialId)
        handlers.resolve(RNPingOathCommon.encodeCodeInfo(info))
      } catch {
        handlers.reject(OathErrorMapper.mapError(error))
      }
    }
  }

  /// Closes the `OathClient` and removes it from the handle registry.
  ///
  /// The client is removed from the registry under lock before `close()` is
  /// called on the native instance. If the handle is not found, the promise
  /// resolves immediately with `NSNull`.
  ///
  /// After this call, any subsequent operation using the same handle will
  /// receive an `OATH_STATE_ERROR`.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - resolver: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter (unused; close never fails from the JS perspective).
  @objc
  public static func close(
    _ handle: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    registryLock.lock()
    let client = registry.removeValue(forKey: handle)
    registryLock.unlock()
    guard let client else {
      handlers.resolve(NSNull())
      return
    }
    Task {
      try? await client.close()
      handlers.resolve(NSNull())
    }
  }

  // MARK: - Policy evaluator registry

  /// Dispatch-specific key for identifying the policy evaluator queue.
  private static let policyEvaluatorQueueKey = DispatchSpecificKey<Void>()

  /// Dedicated serial queue for synchronous policy evaluator registry operations.
  private static let policyEvaluatorQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.oath.policyEvaluator", qos: .userInitiated)
    q.setSpecific(key: policyEvaluatorQueueKey, value: ())
    return q
  }()

  /// Concrete implementation of `OathPolicyEvaluatorConfigHandleContract` stored in the registry.
  ///
  /// - Note: `@unchecked Sendable` is safe here — all fields are immutable value types.
  private final class OathPolicyEvaluatorHandle: OathPolicyEvaluatorConfigHandleContract, @unchecked Sendable {
    let policies: [OathPolicyDescriptor]
    let loggerId: String?

    init(policies: [OathPolicyDescriptor], loggerId: String?) {
      self.policies = policies
      self.loggerId = loggerId
    }
  }

  /// Registers an OATH policy evaluator configuration in `CoreRuntime.oathPolicyEvaluatorRegistry`.
  ///
  /// The `config` dictionary must contain a `policies` array of kind strings
  /// (`"biometricAvailable"`, `"deviceTampering"`). An optional `loggerId` string may be
  /// included; when absent the evaluator inherits the logger resolved from
  /// `OathClientConfig.loggerId` at client creation time.
  ///
  /// Unrecognised policy kind strings are silently ignored at the bridge layer; validation that
  /// the array is non-empty is performed in the JS facade before this is called.
  ///
  /// - Parameter config: NSDictionary containing `policies` (NSArray of kind strings) and
  ///   optionally `loggerId` (NSString).
  /// - Returns: Opaque UUID id string for the registered evaluator descriptor.
  @objc
  public static func registerOathPolicyEvaluator(_ config: NSDictionary) -> String {
    return policyEvaluatorQueue.sync {
      var descriptors: [OathPolicyDescriptor] = []
      if let rawPolicies = config["policies"] as? [String] {
        for kind in rawPolicies {
          switch kind {
          case "biometricAvailable":
            descriptors.append(.biometricAvailable)
          case "deviceTampering":
            descriptors.append(.deviceTampering)
          default:
            // Unrecognised kinds are silently skipped — JS validates before calling native.
            break
          }
        }
      }
      let loggerId = config["loggerId"] as? String
      let handle = OathPolicyEvaluatorHandle(policies: descriptors, loggerId: loggerId)
      return RegistrySync.registerSync(
        handle,
        registry: CoreRuntime.oathPolicyEvaluatorRegistry,
        queueKey: policyEvaluatorQueueKey,
        context: "RNPingOathCommon.registerOathPolicyEvaluator"
      )
    }
  }

  /// Retrieves a previously registered policy evaluator descriptor from
  /// `CoreRuntime.oathPolicyEvaluatorRegistry` and encodes it as a bridge-safe `NSDictionary`.
  ///
  /// - Parameter id: The registry id returned by ``registerOathPolicyEvaluator(_:)``.
  /// - Returns: An `NSDictionary` with `policies` (NSArray of kind strings) and optionally
  ///   `loggerId`.
  @objc
  public static func configureOathPolicyEvaluator(_ id: String) -> NSDictionary {
    return policyEvaluatorQueue.sync {
      let handle = RegistrySync.resolveSync(
        id,
        registry: CoreRuntime.oathPolicyEvaluatorRegistry,
        queueKey: policyEvaluatorQueueKey,
        context: "RNPingOathCommon.configureOathPolicyEvaluator"
      ) as? OathPolicyEvaluatorConfigHandleContract

      var result: [String: Any] = [:]
      if let handle {
        let kindStrings: [String] = handle.policies.map { policy in
          switch policy {
          case .biometricAvailable: return "biometricAvailable"
          case .deviceTampering: return "deviceTampering"
          }
        }
        result["policies"] = kindStrings
        if let loggerId = handle.loggerId {
          result["loggerId"] = loggerId
        }
      } else {
        result["policies"] = [String]()
      }
      return result as NSDictionary
    }
  }

  // MARK: - Registry

  /// Thread-safe lookup of an `OathClient` by its handle.
  ///
  /// - Parameter handle: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  /// - Returns: The `OathClient` if present, or `nil` if the handle is unknown.
  private static func lookup(_ handle: String) -> OathClient? {
    registryLock.lock()
    defer { registryLock.unlock() }
    return registry[handle]
  }

  // MARK: - Error helpers

  /// Creates the standard "handle not found" state error.
  ///
  /// Returned when a JS call references a handle that does not exist in the
  /// registry — typically because the client was already closed.
  ///
  /// - Returns: A `GenericError` with the `.stateError` type and `OATH_STATE_ERROR` code.
  private static func stateError() -> GenericError {
    GenericError(
      type: .stateError,
      error: OathErrorCodes.stateError.rawValue,
      message: "OATH client handle not found. The client may have been closed."
    )
  }

  // MARK: - Codec helpers

  /// Encodes an `OathCredential` into a bridge-safe `NSDictionary`.
  ///
  /// The `secretKey` field is intentionally excluded as it is `internal` in
  /// the `PingOath` SDK and must not be exposed across the bridge.
  /// The `oathType` raw value is uppercased so JS receives `"TOTP"` / `"HOTP"`.
  ///
  /// - Parameter c: The `OathCredential` to encode.
  /// - Returns: An `NSDictionary` suitable for passing through the React Native bridge.
  static func encodeCredential(_ c: OathCredential) -> NSDictionary {
    [
      "id": c.id,
      "issuer": c.issuer,
      "displayIssuer": c.displayIssuer,
      "accountName": c.accountName,
      "displayAccountName": c.displayAccountName,
      "type": c.oathType.rawValue.uppercased(),
      "userId": c.userId as Any,
      "resourceId": c.resourceId as Any,
      "digits": c.digits,
      "period": c.period,
      "counter": NSNumber(value: Double(c.counter)), // Double-backed to match Android's putDouble encoding
      "imageURL": c.imageURL as Any,
      "backgroundColor": c.backgroundColor as Any,
      "isLocked": c.isLocked,
      "algorithm": c.oathAlgorithm.rawValue, // raw values are already uppercase: "SHA1"/"SHA256"/"SHA512"
      "createdAt": NSNumber(value: c.createdAt.timeIntervalSince1970 * 1000), // ms since epoch
      "policies": c.policies as Any,
      "lockingPolicy": c.lockingPolicy as Any,
    ]
  }

  /// Encodes an `OathCodeInfo` into a bridge-safe `NSDictionary`.
  ///
  /// `counter` is encoded as `NSNumber(Double)` to match Android's `putDouble` encoding.
  ///
  /// - Parameter info: The `OathCodeInfo` to encode.
  /// - Returns: An `NSDictionary` suitable for passing through the React Native bridge.
  static func encodeCodeInfo(_ info: OathCodeInfo) -> NSDictionary {
    [
      "code": info.code,
      "timeRemaining": NSNumber(value: info.timeRemaining),
      "counter": NSNumber(value: Double(info.counter)),
      "progress": NSNumber(value: info.progress),
      "totalPeriod": NSNumber(value: info.totalPeriod),
    ]
  }

  /// Decodes a bridge `NSDictionary` into an `OathCredential`.
  ///
  /// All optional fields fall back to safe defaults. The `secret` parameter is
  /// set to an empty string; callers that need the real secret (i.e. `saveCredential`)
  /// must fetch the stored credential from the native client and apply only the mutable
  /// display fields from the decoded value. The `algorithm` field is decoded from its
  /// uppercase raw value (e.g. `"SHA256"`) using `OathAlgorithm(rawValue:)`; missing or
  /// unrecognised values default to `.sha1`. The `createdAt` field is decoded from
  /// milliseconds since epoch (matching `encodeCredential`'s encoding); missing values
  /// default to `Date()`.
  ///
  /// If required fields (`issuer`, `accountName`) are missing, this method
  /// rejects through `rejecter` and returns `nil`.
  ///
  /// - Parameters:
  ///   - credential: Raw JS dictionary containing credential fields.
  ///   - rejecter: Promise rejecter to call when required fields are absent.
  /// - Returns: A decoded `OathCredential`, or `nil` if required fields are missing.
  private static func decodeCredential(
    _ credential: NSDictionary,
    rejecter: @escaping RCTPromiseRejectBlock
  ) -> OathCredential? {
    guard let issuer = credential["issuer"] as? String, !issuer.isEmpty else {
      rejecter(
        OathErrorCodes.missingParameter.rawValue,
        "Missing required field: issuer",
        nil
      )
      return nil
    }
    guard let accountName = credential["accountName"] as? String, !accountName.isEmpty else {
      rejecter(
        OathErrorCodes.missingParameter.rawValue,
        "Missing required field: accountName",
        nil
      )
      return nil
    }

    let id = credential["id"] as? String ?? UUID().uuidString
    let displayIssuer = credential["displayIssuer"] as? String ?? issuer
    let displayAccountName = credential["displayAccountName"] as? String ?? accountName
    let typeString = (credential["type"] as? String ?? "totp").lowercased()
    let oathType = OathType(rawValue: typeString) ?? .totp
    let algorithmStr = credential["algorithm"] as? String ?? "SHA1"
    let oathAlgorithm = OathAlgorithm(rawValue: algorithmStr) ?? .sha1
    // Use NSNumber.intValue instead of `as? Int` — RN bridges JS numbers as NSNumber,
    // whose backing type may be Double even for whole-number values. `as? Int` returns nil
    // for Double-backed NSNumbers, silently discarding the value.
    let digits = (credential["digits"] as? NSNumber)?.intValue ?? 6
    let period = (credential["period"] as? NSNumber)?.intValue ?? 30
    let counter = (credential["counter"] as? NSNumber)?.intValue ?? 0
    let userId = credential["userId"] as? String
    let resourceId = credential["resourceId"] as? String
    let imageURL = credential["imageURL"] as? String
    let backgroundColor = credential["backgroundColor"] as? String
    let isLocked = credential["isLocked"] as? Bool ?? false
    // Decode createdAt from milliseconds since epoch (matching encodeCredential's encoding).
    // Falls back to Date() when the field is absent or non-numeric.
    let createdAt: Date
    if let ms = (credential["createdAt"] as? NSNumber)?.doubleValue {
      createdAt = Date(timeIntervalSince1970: ms / 1000)
    } else {
      createdAt = Date()
    }

    return OathCredential(
      id: id,
      userId: userId,
      resourceId: resourceId,
      issuer: issuer,
      displayIssuer: displayIssuer,
      accountName: accountName,
      displayAccountName: displayAccountName,
      oathType: oathType,
      oathAlgorithm: oathAlgorithm,
      digits: digits,
      period: period,
      counter: counter,
      createdAt: createdAt,
      imageURL: imageURL,
      backgroundColor: backgroundColor,
      isLocked: isLocked,
      secretKey: ""
    )
  }
}
