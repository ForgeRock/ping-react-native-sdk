/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the Push native module.
///
/// Singleton instance called by both the TurboModule (`RNPingPush.mm`) and the classic
/// bridge (`RNPingPushClassic.mm`) via `[RNPingPushImpl shared]`. All work is delegated
/// to `RNPingPushCommon`.
@objcMembers
public class RNPingPushImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingPushImpl()

  @objc private override init() {
    super.init()
  }

  // MARK: - Lifecycle

  @objc public func invalidate() {
    RNPingPushCommon.cleanup()
  }

  // MARK: - Initialization

  @objc public func initialize(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.initialize(config: config, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Credential Operations

  @objc public func addCredentialFromUri(
    _ clientId: String,
    uri: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.addCredentialFromUri(clientId, uri: uri, resolver: resolve, rejecter: rejecter)
  }

  @objc public func saveCredential(
    _ clientId: String,
    credential: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.saveCredential(clientId, credential: credential, resolver: resolve, rejecter: rejecter)
  }

  @objc public func getCredentials(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getCredentials(clientId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func getCredential(
    _ clientId: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getCredential(clientId, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func deleteCredential(
    _ clientId: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.deleteCredential(clientId, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Device Token Operations

  @objc public func setDeviceToken(
    _ clientId: String,
    token: String,
    credentialId: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.setDeviceToken(clientId, token: token, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func getDeviceToken(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getDeviceToken(clientId, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Notification Processing

  @objc public func processNotification(
    _ clientId: String,
    messageData: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.processNotification(clientId, messageData: messageData, resolver: resolve, rejecter: rejecter)
  }

  @objc public func processNotificationFromMessage(
    _ clientId: String,
    message: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.processNotificationFromMessage(clientId, message: message, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Notification Response Operations

  @objc public func approveNotification(
    _ clientId: String,
    notificationId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.approveNotification(clientId, notificationId: notificationId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func approveChallengeNotification(
    _ clientId: String,
    notificationId: String,
    challengeResponse: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.approveChallengeNotification(clientId, notificationId: notificationId, challengeResponse: challengeResponse, resolver: resolve, rejecter: rejecter)
  }

  @objc public func approveBiometricNotification(
    _ clientId: String,
    notificationId: String,
    authenticationMethod: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.approveBiometricNotification(clientId, notificationId: notificationId, authenticationMethod: authenticationMethod, resolver: resolve, rejecter: rejecter)
  }

  @objc public func denyNotification(
    _ clientId: String,
    notificationId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.denyNotification(clientId, notificationId: notificationId, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Notification Query Operations

  @objc public func getPendingNotifications(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getPendingNotifications(clientId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func getAllNotifications(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getAllNotifications(clientId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func getNotification(
    _ clientId: String,
    notificationId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.getNotification(clientId, notificationId: notificationId, resolver: resolve, rejecter: rejecter)
  }

  @objc public func cleanupNotifications(
    _ clientId: String,
    credentialId: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.cleanupNotifications(clientId, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Close

  @objc public func close(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.close(clientId, resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Pending Messages

  @objc public func consumePendingMessages(
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.consumePendingMessages(resolver: resolve, rejecter: rejecter)
  }

  // MARK: - Token Refresh

  @objc public func refreshToken(
    _ clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingPushCommon.refreshToken(clientId: clientId, resolver: resolve, rejecter: rejecter)
  }
}
