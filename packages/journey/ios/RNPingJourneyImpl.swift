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
  }

  private var journey: Journey?
  private var lastNode: Node?
  
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
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingJourney: configureJourney called with \(config)")
    StorageRegistry.shared.printAllRegisteredIds()
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

    // Create and configure Journey
    self.journey = Journey.createJourney { journeyConfig in
      journeyConfig.serverUrl = serverUrl
      if let realm = realm { journeyConfig.realm = realm }
      if let cookie = cookieName { journeyConfig.cookie = cookie }
      journeyConfig.timeout = 30
      journeyConfig.logger = LogManager.standard

      // Optional OIDC configuration
      if let clientId = clientId,
         let discoveryEndpoint = discoveryEndpoint,
         let redirectUri = redirectUri {
        journeyConfig.module(PingJourney.OidcModule.config) { oidc in
          oidc.clientId = clientId
          oidc.discoveryEndpoint = discoveryEndpoint
          oidc.redirectUri = redirectUri
          oidc.scopes = Set(scopes)
        }
      }
    }

    if let journey = self.journey {
      print("✅ Journey configured successfully")
      resolve(true)
    } else {
      let error = NSError(
        domain: "RNPingJourney",
        code: 500,
        userInfo: [NSLocalizedDescriptionKey: "Failed to configure Journey"]
      )
      reject("E_CONFIGURE_FAILED", "Failed to configure Journey", error)
    }
  }

  // MARK: - Start
  @objc(start:options:resolver:rejecter:)
  public func start(_ journeyName: String,
             options: NSDictionary?,
             resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let journey = self.journey else {
      reject("500", "Journey not configured", nil)
      return
    }
    let forceAuth = options?["forceAuth"] as? Bool ?? false
    let noSession = options?["noSession"] as? Bool ?? false
    Task {
      let node = await journey.start(journeyName) { $0.forceAuth = forceAuth; $0.noSession = noSession }
      self.lastNode = node
      resolve(self.serializeNode(node))
    }
  }

  // MARK: - Next
  @objc(next:input:resolver:rejecter:)
  public func next(_ nodeId: NSString,
            input: NSDictionary,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let current = self.lastNode as? ContinueNode else {
      reject("404", "No active ContinueNode", nil)
      return
    }
    if let callbacks = input["callbacks"] as? [[String: Any]] {
      for cb in callbacks {
        switch cb["type"] as? String {
        case "NameCallback":
          (current.callbacks.first { $0 is NameCallback } as? NameCallback)?.name = cb["value"] as? String ?? ""
        case "PasswordCallback":
          (current.callbacks.first { $0 is PasswordCallback } as? PasswordCallback)?.password = cb["value"] as? String ?? ""
        default: break
        }
      }
    }
    Task {
      let nextNode = await current.next()
      self.lastNode = nextNode
      resolve(self.serializeNode(nextNode))
    }
  }

  // MARK: - Resume
  @objc(resume:resolver:rejecter:)
  public func resume(_ uri: NSString,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let journey = self.journey else {
      reject("400", "Journey not configured", nil)
      return
    }
    guard let resumeUrl = URL(string: uri as String) else {
      reject("422", "Invalid resume URI", nil)
      return
    }
    Task {
      let node = await journey.resume(resumeUrl)
      self.lastNode = node
      resolve(self.serializeNode(node))
    }
  }

  // MARK: - Get Session
  @objc(getSession:rejecter:)
  public func getSession(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let journey = self.journey else {
      reject("400", "Journey not configured", nil)
      return
    }
    Task {
      let user = await journey.journeyUser()
      let token = await user?.token()
      switch token {
      case .success(let t): resolve(["accessToken": t.accessToken])
      case .failure(let e): reject("401", e.localizedDescription, e)
      case .none: resolve(nil)
      }
    }
  }

  // MARK: - Logout
  @objc(logout:rejecter:)
  public func logout(_ resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let journey = self.journey else {
      reject("400", "Journey not configured", nil)
      return
    }
    Task {
      let user = await journey.journeyUser()
      await user?.logout()
      resolve(true)
    }
  }
}
