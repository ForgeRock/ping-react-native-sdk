/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
import Foundation
import PingJourney
import PingLogger
import PingOrchestrate
import React
import RNPingCore

@available(iOS 16.0.0, *) // Keeping 16 for POC
@objc(RNPingJourneyImpl)
public class RNPingJourneyImpl: NSObject {

  // Singleton instance
  @objc public static let shared = RNPingJourneyImpl()
  // Private initializer to enforce singleton
  @objc private override init() {
    super.init()
    /// TODO: Remove once journey module matures and types package is available.
    CoreRuntime.journeyCallbackResolver = { [weak self] journeyId in
      guard let node = self?.continueNodeMap[journeyId] else {
        return nil
      }
      return node.callbacks
    }
  }

  // Local registry of Journey instances keyed by generated id
  private var journeyMap: [String: Journey] = [:]
  // Store nodes per journey instance
  private var nodeMap: [String: Node] = [:]
  // Store ContinueNode instances for handling callbacks and progression
  /// TODO: Remove once journey module matures and types package is available.
  private var continueNodeMap: [String: ContinueNode] = [:]
  /// Clear the current node when the Journey node flow completes.
  /// TODO: Remove once journey module matures and types package is available.
  private func clearIfFinished(_ journeyId: String, node: Node) async {
    if node is SuccessNode || node is FailureNode || node is ErrorNode {
      nodeMap.removeValue(forKey: journeyId)
      continueNodeMap.removeValue(forKey: journeyId)
    }
  }

  // MARK: - Node Serialization 
  private func serializeNode(_ node: Node) -> NSDictionary {
    var dict: [String: Any] = ["id": UUID().uuidString]
    switch node {
    case let c as ContinueNode:
      dict["type"] = "ContinueNode"
      dict["callbacks"] = c.callbacks.map { cb in
        ["type": String(describing: type(of: cb)),
          "prompt": (cb as? TextOutputCallback)?.message ?? "",
         "value": NSNull()]
      }
    case let e as ErrorNode:
      dict["type"] = "ErrorNode"; dict["message"] = e.message
    case let f as FailureNode:
      dict["type"] = "FailureNode"; dict["cause"] = f.cause.localizedDescription
    case let s as SuccessNode:
      dict["type"] = "SuccessNode"; dict["session"] = s.session
    default: dict["type"] = "Unknown"
    }
    return dict as NSDictionary
  }

  // MARK: - Configure
  @objc(configureJourney:resolver:rejecter:)
  public func configureJourney(
    _ config: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingJourney: configureJourney called with \(config)")
    guard let serverUrl = config["serverUrl"] as? String else {
      let error = NSError(
        domain: "RNPingJourney",
        code: 400,
        userInfo: [NSLocalizedDescriptionKey: "Missing serverUrl"]
      )
      reject("E_MISSING_SERVER_URL", "Missing serverUrl", error)
      return
    }

    let realm = config["realm"] as? String
    let cookieName = config["cookie"] as? String
    let clientId = config["clientId"] as? String
    let discoveryEndpoint = config["discoveryEndpoint"] as? String
    let redirectUri = config["redirectUri"] as? String
    let scopes = config["scopes"] as? [String] ?? ["openid", "email", "profile"]

    // Create Journey instance 
    let journey = Journey.createJourney { j in
      j.serverUrl = serverUrl
      if let realm = realm { j.realm = realm }
      if let cookie = cookieName { j.cookie = cookie }
      j.timeout = 30
      j.logger = LogManager.standard

      // Optional OIDC block
      if let clientId = clientId,
        let discoveryEndpoint = discoveryEndpoint,
        let redirectUri = redirectUri
      {
        j.module(PingJourney.OidcModule.config) { oidc in
          oidc.clientId = clientId
          oidc.discoveryEndpoint = discoveryEndpoint
          oidc.redirectUri = redirectUri
          oidc.scopes = Set(scopes)
        }
      }
    }

    // Register instance locally
    let journeyId = UUID().uuidString
    journeyMap[journeyId] = journey

    Task {
      print("RNPingJourney: Journey registered → \(journeyId)")
      resolve(journeyId)
    }
  }

  // MARK: - Start Journey
  @objc(start:journeyName:options:resolver:rejecter:)
  public func start(
    _ journeyId: String,
    journeyName: String,
    options: NSDictionary?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let journey = journeyMap[journeyId] else {
      reject("NOT_CONFIGURED", "Journey not found for id \(journeyId)", nil)
      return
    }

    let forceAuth = options?["forceAuth"] as? Bool ?? false
    let noSession = options?["noSession"] as? Bool ?? false

    Task {
      let node = await journey.start(journeyName) { $0.forceAuth = forceAuth; $0.noSession = noSession }
      nodeMap[journeyId] = node
      if let continueNode = node as? ContinueNode {
        continueNodeMap[journeyId] = continueNode
      } else {
        continueNodeMap.removeValue(forKey: journeyId)
      }
      await clearIfFinished(journeyId, node: node)
      resolve(self.serializeNode(node))
    }
  }

  // MARK: - Next
  @objc(next:nodeId:input:resolver:rejecter:)
  public func next(
    _ journeyId: NSString,
    nodeId: NSString,
    input: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let id = journeyId as String

    // Get the current node for this journey
    guard let current = continueNodeMap[id] else {
      reject("NO_ACTIVE_JOURNEY", "No active ContinueNode for journeyId=\(id)", nil)
      return
    }
    if let callbacks = input["callbacks"] as? [[String: Any]] {
      for cb in callbacks {
        switch cb["type"] as? String {
        case "NameCallback":
          (current.callbacks.first { $0 is NameCallback } as? NameCallback)?
            .name = cb["value"] as? String ?? ""
        case "PasswordCallback":
          (current.callbacks.first { $0 is PasswordCallback } as? PasswordCallback)?
            .password = cb["value"] as? String ?? ""
        default:
          break
        }
      }
    }

    Task {
      let nextNode = await current.next()
      nodeMap[id] = nextNode
      if let continueNode = nextNode as? ContinueNode {
        continueNodeMap[id] = continueNode
      } else {
        continueNodeMap.removeValue(forKey: id)
      }
      await clearIfFinished(id, node: nextNode)
      resolve(self.serializeNode(nextNode))
    }
  }

  // MARK: - Resume
  @objc(resume:uri:resolver:rejecter:)
  public func resume(
    _ journeyId: NSString,
    uri: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let id = journeyId as String

    guard let journey = journeyMap[id] else {
      reject("NOT_CONFIGURED", "Journey not configured for id=\(id)", nil)
      return
    }

    guard let resumeUrl = URL(string: uri as String) else {
      reject("422", "Invalid resume URI", nil)
      return
    }

    Task {
      let node = await journey.resume(resumeUrl)
      nodeMap[id] = node
      if let continueNode = node as? ContinueNode {
        continueNodeMap[id] = continueNode
      } else {
        continueNodeMap.removeValue(forKey: id)
      }

      await clearIfFinished(id, node: node)
      resolve(self.serializeNode(node))
    }
  }

  // MARK: - Get Session
  @objc(getSession:resolver:rejecter:)
  public func getSession(
    _ journeyId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let journey = journeyMap[journeyId] else {
      reject("NOT_CONFIGURED", "Journey not found", nil)
      return
    }

    Task {
      let user = await journey.journeyUser()
      let token = await user?.token()

      switch token {
      case .success(let t):
        resolve(["accessToken": t.accessToken])
      case .failure(let err):
        reject("NO_SESSION", err.localizedDescription, err)
      case .none:
        resolve(nil)
      }
    }
  }

  // MARK: - Logout
  @objc(logout:resolver:rejecter:)
  public func logout(
    _ journeyId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let journey = journeyMap[journeyId] else {
      reject("NOT_CONFIGURED", "Journey not found", nil)
      return
    }
    Task {
      let user = await journey.journeyUser()
      await user?.logout()
      nodeMap.removeValue(forKey: journeyId)
      continueNodeMap.removeValue(forKey: journeyId)
      resolve(true)
    }
  }

  // MARK: - List Registered Storages
  @objc
  public func listRegisteredStoragesFromCore(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      //let ids = await StorageRegistry.shared.listIds()
      resolve([""])
    }
  }
}
