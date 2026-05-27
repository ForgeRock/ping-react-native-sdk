/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingLogger
import PingPush
import PingStorage
import RNPingCore
import React

/// Shared push MFA execution logic for React Native iOS bridges.
///
/// Maintains a handle-keyed registry of `PushClient` instances via `PushClientStore` (actor).
/// `initialize` returns an opaque UUID handle; every subsequent method takes that handle as its
/// first argument. Both the TurboModule (`RNPingPush.mm`) and the classic bridge
/// (`RNPingPushClassic.mm`) delegate through `RNPingPushImpl` to the static methods defined here.
@objcMembers
public class RNPingPushCommon: NSObject {

  // MARK: - Private State

  private static let defaultKeychainService = "com.pingidentity.rnpush.storage"

  // pendingMessages and pendingAPNsToken are written from AppDelegate (synchronous, outside any
  // Task), so they cannot use the actor pattern. NSLock is the correct primitive here.
  private nonisolated(unsafe) static var pendingMessages: [[AnyHashable: Any]] = []
  private nonisolated(unsafe) static var pendingAPNsToken: String? = nil
  private static let messagesLock = NSLock()

  // MARK: - Lifecycle

  /// Cancels all active push clients and clears the handle registry.
  ///
  /// Called when the native module is invalidated. Each registered `PushClient` is
  /// closed asynchronously before its reference is released.
  @objc public static func cleanup() {
    Task {
      let clients = await PushClientStore.shared.removeAll()
      for client in clients { await client.close() }
    }
    messagesLock.lock()
    pendingMessages.removeAll()
    pendingAPNsToken = nil
    messagesLock.unlock()
  }

  // MARK: - Pending APNs Token

  /// Stores the APNs token that arrived before the RN module was instantiated.
  /// Called by `RNPingPushBridge.forwardToken` as a fallback for the race where
  /// `NotificationCenter` has no observer yet.
  @objc public static func setPendingToken(_ token: String) {
    messagesLock.lock()
    pendingAPNsToken = token
    messagesLock.unlock()
  }

  /// Drains and returns the buffered APNs token, or nil if none was stored.
  /// Called by `RNPingPush.mm` in `setCallableJSModules:` after the NotificationCenter
  /// observer is registered.
  @objc public static func consumePendingToken() -> String? {
    messagesLock.lock()
    let token = pendingAPNsToken
    pendingAPNsToken = nil
    messagesLock.unlock()
    return token
  }

  // MARK: - Pending Messages

  /// Called from the NSNotificationCenter observer when a remote notification arrives
  /// but the JS push client hasn't been created yet. JS drains via consumePendingMessages().
  @objc public static func enqueuePendingMessage(_ userInfo: [AnyHashable: Any]) {
    messagesLock.lock()
    pendingMessages.append(userInfo)
    messagesLock.unlock()
  }

  @objc public static func consumePendingMessages(
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    messagesLock.lock()
    let messages = pendingMessages
    pendingMessages.removeAll()
    messagesLock.unlock()
    resolver(messages)
  }

  // MARK: - Token Refresh

  /// Resolves with `{ token: NSNull() }` — APNs token delivery is handled via `AppDelegate`,
  /// so there is nothing to fetch proactively on iOS.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `{ token: NSNull() }` immediately.
  ///   - rejecter: Unused on iOS.
  @objc public static func refreshToken(
    clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    // APNs token is delivered via AppDelegate — nothing to fetch proactively on iOS.
    resolver(["token": NSNull()])
  }

  // MARK: - Initialization

  /// Creates a new `PushClient` from the bridge config dictionary, stores it in the registry,
  /// and resolves with an opaque UUID client handle.
  ///
  /// - Parameters:
  ///   - config: Push configuration dictionary (storageId, loggerId, enableCredentialCache,
  ///     timeoutMs, cleanupMode, etc.).
  ///   - resolver: Called with the opaque client handle string on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func initialize(
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let loggerId = (config["loggerId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let storageId = config["storageId"] as? String
    let enableCredentialCache = config["enableCredentialCache"] as? Bool ?? false
    let timeoutMs = (config["timeoutMs"] as? NSNumber)?.intValue ?? 15000
    let encryptionEnabled = config["encryptionEnabled"] as? Bool ?? true
    let cleanupMode = config["cleanupMode"] as? String
    let maxStoredNotifications = (config["maxStoredNotifications"] as? NSNumber)?.intValue
    let maxNotificationAgeDays = (config["maxNotificationAgeDays"] as? NSNumber)?.intValue

    let handlers = PromiseBridge<NSString>(resolver: resolver, rejecter: rejecter)
    Task {
      do {
        let logger = await resolveLogger(id: loggerId)
        let pushStorage = try await resolvePushStorage(storageId: storageId, encryptionEnabled: encryptionEnabled)
        let cleanupConfig = buildCleanupConfig(
          mode: cleanupMode,
          maxCount: maxStoredNotifications,
          maxAgeDays: maxNotificationAgeDays
        )

        let client = try await PushClient.createClient { @Sendable clientConfig in
          clientConfig.enableCredentialCache = enableCredentialCache
          clientConfig.timeoutMs = timeoutMs
          if let storage = pushStorage {
            clientConfig.storage = storage
          }
          if let cleanup = cleanupConfig {
            clientConfig.notificationCleanupConfig = cleanup
          }
          if let logger {
            clientConfig.logger = logger
          }
        }

        let clientId = UUID().uuidString
        await PushClientStore.shared.store(client, id: clientId)
        handlers.resolve(clientId as NSString)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Credential Operations

  /// Enrolls a new push credential by parsing the given `pushauth://` URI.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - uri: The `pushauth://` enrollment URI received from the server.
  ///   - resolver: Called with the serialized credential dictionary on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func addCredentialFromUri(
    _ clientId: String,
    uri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let credential = try await client.addCredentialFromUri(uri)
        handlers.resolve(serializeCredential(credential) as NSDictionary)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Saves an updated push credential back to native storage.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - credential: Dictionary representing the credential fields to persist.
  ///   - resolver: Called with the updated serialized credential dictionary on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func saveCredential(
    _ clientId: String,
    credential: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    let nativeCredentialResult = Result { try deserializeCredential(credential) }
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let nativeCredential = try nativeCredentialResult.get()
        let saved = try await client.saveCredential(nativeCredential)
        handlers.resolve(serializeCredential(saved) as NSDictionary)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Returns all stored push credentials as `{ credentials: [...] }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `{ credentials: [...] }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getCredentials(
    _ clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let credentials = try await client.getCredentials()
        let serialized = credentials.map { serializeCredential($0) }
        handlers.resolve(["credentials": serialized] as NSDictionary)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Returns a single push credential by its identifier as `{ credential: PushCredential | null }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - credentialId: The identifier of the credential to retrieve.
  ///   - resolver: Called with `{ credential: PushCredential | null }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getCredential(
    _ clientId: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let credential = try await client.getCredential(credentialId: credentialId)
        if let credential {
          handlers.resolve(["credential": serializeCredential(credential)] as NSDictionary)
        } else {
          handlers.resolve(["credential": NSNull()] as NSDictionary)
        }
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Deletes a push credential from native storage.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - credentialId: The identifier of the credential to delete.
  ///   - resolver: Called with a boolean indicating whether the credential was deleted.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func deleteCredential(
    _ clientId: String,
    credentialId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let deleted = try await client.deleteCredential(credentialId: credentialId)
        handlers.resolve(NSNumber(value: deleted))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Device Token Operations

  /// Updates the APNs/FCM device token, optionally scoped to a specific credential.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - token: The new device registration token.
  ///   - credentialId: When non-nil, limits the token update to this credential only.
  ///   - resolver: Called with the operation result on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func setDeviceToken(
    _ clientId: String,
    token: String,
    credentialId: String?,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let result = try await client.setDeviceToken(token, credentialId: credentialId)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Returns the stored device token as `{ token: string | null }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `{ token: string | null }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getDeviceToken(
    _ clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let token = try await client.getDeviceToken()
        if let token {
          handlers.resolve(["token": token] as NSDictionary)
        } else {
          handlers.resolve(["token": NSNull()] as NSDictionary)
        }
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Notification Processing

  /// Parses a push notification from a remote message data payload dictionary.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - messageData: The remote message data payload key-value dictionary.
  ///   - resolver: Called with `{ notification: PushNotification | null }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func processNotification(
    _ clientId: String,
    messageData: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    // Cast to [AnyHashable: Any] so we can use processNotification(userInfo:), which handles
    // APNs aps-wrapping automatically (extracts aps["data"] → "message", aps["messageId"], etc.)
    let userInfo = messageData as? [AnyHashable: Any] ?? [:]
    let userInfoBox = UnsafeSendable(userInfo)
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let notification = try await client.processNotification(userInfo: userInfoBox.value)
        if let notification {
          handlers.resolve(["notification": serializeNotification(notification)] as NSDictionary)
        } else {
          handlers.resolve(["notification": NSNull()] as NSDictionary)
        }
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Parses a push notification from a raw string or JWT message body.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - message: The raw string or JWT received as the push message body.
  ///   - resolver: Called with `{ notification: PushNotification | null }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func processNotificationFromMessage(
    _ clientId: String,
    message: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let notification = try await client.processNotification(message: message)
        if let notification {
          handlers.resolve(["notification": serializeNotification(notification)] as NSDictionary)
        } else {
          handlers.resolve(["notification": NSNull()] as NSDictionary)
        }
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Notification Response Operations

  /// Approves a pending push notification.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - notificationId: The identifier of the notification to approve.
  ///   - resolver: Called with the operation result on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func approveNotification(
    _ clientId: String,
    notificationId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let result = try await client.approveNotification(notificationId)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Approves a challenge-type push notification with the user-supplied response.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - notificationId: The identifier of the challenge notification to approve.
  ///   - challengeResponse: The user's answer to the challenge presented in the notification.
  ///   - resolver: Called with the operation result on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func approveChallengeNotification(
    _ clientId: String,
    notificationId: String,
    challengeResponse: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let result = try await client.approveChallengeNotification(notificationId, challengeResponse: challengeResponse)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Approves a biometric push notification using the given authentication method.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - notificationId: The identifier of the biometric notification to approve.
  ///   - authenticationMethod: The biometric method used (e.g. `"FACE_ID"`, `"TOUCH_ID"`).
  ///   - resolver: Called with the operation result on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func approveBiometricNotification(
    _ clientId: String,
    notificationId: String,
    authenticationMethod: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let result = try await client.approveBiometricNotification(notificationId, authenticationMethod: authenticationMethod)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Denies a pending push notification.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - notificationId: The identifier of the notification to deny.
  ///   - resolver: Called with the operation result on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func denyNotification(
    _ clientId: String,
    notificationId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let result = try await client.denyNotification(notificationId)
        handlers.resolve(NSNumber(value: result))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Notification Query Operations

  /// Returns all notifications currently awaiting a user response as `{ notifications: [...] }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `{ notifications: [...] }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getPendingNotifications(
    _ clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let notifications = try await client.getPendingNotifications()
        let serialized = notifications.map { serializeNotification($0) }
        handlers.resolve(["notifications": serialized] as NSDictionary)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Returns all stored push notifications regardless of their response state as `{ notifications: [...] }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `{ notifications: [...] }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getAllNotifications(
    _ clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let notifications = try await client.getAllNotifications()
        let serialized = notifications.map { serializeNotification($0) }
        handlers.resolve(["notifications": serialized] as NSDictionary)
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Returns a single push notification by its identifier as `{ notification: PushNotification | null }`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - notificationId: The identifier of the notification to retrieve.
  ///   - resolver: Called with `{ notification: PushNotification | null }` on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func getNotification(
    _ clientId: String,
    notificationId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let notification = try await client.getNotification(notificationId: notificationId)
        if let notification {
          handlers.resolve(["notification": serializeNotification(notification)] as NSDictionary)
        } else {
          handlers.resolve(["notification": NSNull()] as NSDictionary)
        }
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  /// Runs the configured notification cleanup strategy and removes expired or excess notifications.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - credentialId: When non-nil, limits cleanup to this credential's notifications.
  ///   - resolver: Called with the number of notifications removed on success.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func cleanupNotifications(
    _ clientId: String,
    credentialId: String?,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNumber>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await getClient(clientId) else {
        handlers.reject(GenericError(type: .stateError, error: PushErrorCode.notInitialized.rawValue, message: "Push client not found for id: \(clientId)"))
        return
      }
      do {
        let count = try await client.cleanupNotifications(credentialId: credentialId)
        handlers.resolve(NSNumber(value: count))
      } catch {
        handlers.reject(pushGenericError(error))
      }
    }
  }

  // MARK: - Close

  /// Removes the push client from the registry and releases its resources.
  ///
  /// If the client handle is not found, the promise resolves immediately with `nil`.
  ///
  /// - Parameters:
  ///   - clientId: Opaque handle returned by `initialize`.
  ///   - resolver: Called with `nil` when the client is successfully closed.
  ///   - rejecter: Called with a `PushErrorCode` on failure.
  @objc public static func close(
    _ clientId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    Task {
      guard let client = await PushClientStore.shared.remove(clientId) else {
        handlers.resolve(NSNull())
        return
      }
      await client.close()
      handlers.resolve(NSNull())
    }
  }

  // MARK: - Private Helpers

  /// Returns the `PushClient` registered under `clientId`, or `nil` if no such handle exists.
  private static func getClient(_ clientId: String) async -> PushClient? {
    await PushClientStore.shared.get(clientId)
  }

  /// Resolves an optional `Logger` from the CoreRuntime logger registry.
  ///
  /// - Parameter id: The opaque logger handle identifier, or `nil`/empty to skip lookup.
  /// - Returns: The resolved `Logger`, or `nil` if `id` is absent or the handle cannot be
  ///   cast to a compatible logger type.
  private static func resolveLogger(id: String?) async -> PingLogger.Logger? {
    guard let id, !id.isEmpty else { return nil }
    return (await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract)?.nativeLogger as? PingLogger.Logger
  }

  /// Resolves an optional `PushStorage` instance from the CoreRuntime push storage registry.
  ///
  /// - Parameters:
  ///   - storageId: The opaque storage config handle identifier, or `nil`/empty to skip.
  ///   - encryptionEnabled: Fallback encryption flag when the resolved handle doesn't specify one.
  /// - Returns: A configured `PushKeychainStorage`, or `nil` if `storageId` is absent.
  /// - Throws: `PushError.storageFailure` if `storageId` is set but cannot be resolved.
  private static func resolvePushStorage(
    storageId: String?,
    encryptionEnabled: Bool
  ) async throws -> (any PushStorage)? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    guard let handle = await CoreRuntime.pushStorageConfigRegistry.resolve(storageId)
      as? StorageConfigHandleContract else {
      throw PushError.storageFailure("No push storage config registered for id=\(storageId)", nil)
    }
    let account = handle.account?.trimmingCharacters(in: .whitespacesAndNewlines)
    let resolvedAccount = (account?.isEmpty == false)
      ? (account ?? RNPingPushCommon.defaultKeychainService)
      : RNPingPushCommon.defaultKeychainService
    return PushKeychainStorage(credentialService: resolvedAccount)
  }

  /// Builds a `PushNotificationCleanupConfig` from the supplied parameters.
  ///
  /// - Parameters:
  ///   - mode: Cleanup mode string (e.g. `"COUNT"`, `"AGE"`). Returns `nil` when absent.
  ///   - maxCount: Optional cap on the total number of stored notifications.
  ///   - maxAgeDays: Optional maximum age in days before a notification is removed.
  /// - Returns: A populated `PushNotificationCleanupConfig`, or `nil` if `mode` is absent.
  private static func buildCleanupConfig(
    mode: String?,
    maxCount: Int?,
    maxAgeDays: Int?
  ) -> NotificationCleanupConfig? {
    guard let mode, !mode.isEmpty else { return nil }
    let cleanupMode = NotificationCleanupConfig.CleanupMode(rawValue: mode) ?? .countBased
    return NotificationCleanupConfig(
      cleanupMode: cleanupMode,
      maxStoredNotifications: maxCount ?? 100,
      maxNotificationAgeDays: maxAgeDays ?? 30
    )
  }

}

// [AnyHashable: Any] is not Sendable because Any can hold mutable types. In practice the RN bridge
// only ever delivers immutable property-list values (NSString, NSNumber, NSDictionary, NSArray),
// so crossing the actor boundary here is safe. The wrapper suppresses the compiler warning at that
// one call site without widening the suppression to the whole function.
private struct UnsafeSendable<T>: @unchecked Sendable {
  let value: T
  init(_ value: T) { self.value = value }
}
